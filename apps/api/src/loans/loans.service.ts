import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { RealtimeService } from '../realtime/realtime.service';
import { audit, idempotent, transaction } from '../common/database';
import { loanResponse, overdueFine } from '../common/mapping';
import type { CreateLoanDto, LoanQuery } from '../common/dto';
const include = { book: true, member: true } as const;
@Injectable()
export class LoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}
  async findAll(q: LoanQuery) {
    const now = new Date();
    const where: Prisma.LoanWhereInput = {
      ...(q.bookId ? { bookId: q.bookId } : {}),
      ...(q.memberId ? { memberId: q.memberId } : {}),
      ...(q.status === 'returned'
        ? { returnDate: { not: null } }
        : q.status === 'overdue'
          ? { returnDate: null, dueDate: { lt: now } }
          : q.status === 'active'
            ? { returnDate: null, dueDate: { gte: now } }
            : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.loan.findMany({
        where,
        include,
        orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.loan.count({ where }),
    ]);
    return {
      data: data.map((l) => loanResponse(l, now)),
      total,
      page: q.page,
      limit: q.limit,
    };
  }
  async findOne(id: string) {
    const loan = await this.prisma.loan.findUnique({ where: { id }, include });
    if (!loan) throw new NotFoundException('Loan not found');
    return loanResponse(loan);
  }
  async create(dto: CreateLoanDto, actor: string, key?: string) {
    const response = await transaction(this.prisma, (tx) =>
      idempotent(tx, actor, 'loans', key, dto, async () => {
        await tx.$queryRaw`SELECT id FROM "Member" WHERE id = ${dto.memberId} FOR UPDATE`;
        const member = await tx.member.findFirst({
          where: { id: dto.memberId, deletedAt: null },
        });
        if (!member) throw new NotFoundException('Member not found');
        if (member.status !== 'active')
          throw new ConflictException('Member must be active');
        const book = await tx.book.findFirst({
          where: { id: dto.bookId, deletedAt: null },
        });
        if (!book) throw new NotFoundException('Book not found');
        const changed = await tx.book.updateMany({
          where: {
            id: dto.bookId,
            deletedAt: null,
            availableCopies: { gt: 0 },
          },
          data: { availableCopies: { decrement: 1 } },
        });
        if (!changed.count) throw new ConflictException('No available copies');
        const now = new Date();
        const dueDate = new Date(now.getTime() + dto.days * 86400000);
        const loan = await tx.loan.create({
          data: {
            bookId: dto.bookId,
            memberId: dto.memberId,
            notes: dto.notes,
            borrowDate: now,
            dueDate,
          },
          include,
        });
        await audit(tx, 'borrow', actor, loan.id, 'Book checked out');
        return loanResponse(loan, now);
      }),
    );
    this.realtime.emit('loan.created', { loan: response });
    this.realtime.emit('book.updated', { id: dto.bookId });
    return response;
  }
  async returnLoan(id: string, actor: string) {
    const response = await transaction(this.prisma, async (tx) => {
      const old = await tx.loan.findUnique({ where: { id }, include });
      if (!old) throw new NotFoundException('Loan not found');
      if (old.returnDate) return loanResponse(old);
      const now = new Date();
      const fineAmount = overdueFine(old.dueDate, now);
      const changed = await tx.loan.updateMany({
        where: { id, returnDate: null },
        data: { returnDate: now, status: 'returned', fineAmount },
      });
      if (changed.count) {
        await tx.book.update({
          where: { id: old.bookId },
          data: { availableCopies: { increment: 1 } },
        });
        await audit(tx, 'return', actor, id, 'Book returned');
      }
      return loanResponse(
        await tx.loan.findUniqueOrThrow({ where: { id }, include }),
      );
    });
    this.realtime.emit('loan.updated', { loan: response });
    this.realtime.emit('book.updated', { id: response.bookId });
    return response;
  }
  async renew(id: string, days: number, actor: string) {
    const response = await transaction(this.prisma, async (tx) => {
      const old = await tx.loan.findUnique({ where: { id }, include });
      if (!old) throw new NotFoundException('Loan not found');
      if (old.returnDate || old.dueDate < new Date() || old.renewalCount >= 2)
        throw new ConflictException(
          'Only non-overdue open loans may renew, at most twice',
        );
      if (old.member.deletedAt || old.member.status !== 'active')
        throw new ConflictException('Member must be active');
      const loan = await tx.loan.update({
        where: { id },
        data: {
          dueDate: new Date(old.dueDate.getTime() + days * 86400000),
          renewalCount: { increment: 1 },
        },
        include,
      });
      await audit(tx, 'renew', actor, id, 'Loan renewed');
      return loanResponse(loan);
    });
    this.realtime.emit('loan.updated', { loan: response });
    return response;
  }
}
