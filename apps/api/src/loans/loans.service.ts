import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LoansService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const loans = await this.prisma.loan.findMany({
      include: { book: true, member: true },
      orderBy: { dueDate: 'asc' },
    });

    return loans.map((loan) => ({
      id: loan.id,
      bookId: loan.bookId,
      bookTitle: loan.book?.title || 'Unknown',
      bookAuthor: loan.book?.author || 'Unknown',
      memberId: loan.memberId,
      memberName: loan.member?.name || 'Unknown',
      memberEmail: loan.member?.email || 'Unknown',
      borrowDate: loan.borrowDate.toISOString().split('T')[0],
      dueDate: loan.dueDate.toISOString().split('T')[0],
      returnDate: loan.returnDate?.toISOString().split('T')[0] || null,
      status: loan.status,
      fineAmount: loan.fineAmount,
      notes: loan.notes,
    }));
  }

  async create(createLoanDto: { bookId: string; memberId: string; borrowDate?: string; dueDate: string; status?: string; fineAmount?: number; notes?: string }) {
    const loan = await this.prisma.loan.create({
      include: { book: true, member: true },
      data: {
        bookId: createLoanDto.bookId,
        memberId: createLoanDto.memberId,
        borrowDate: createLoanDto.borrowDate ? new Date(createLoanDto.borrowDate) : new Date(),
        dueDate: new Date(createLoanDto.dueDate),
        status: createLoanDto.status || 'active',
        fineAmount: createLoanDto.fineAmount,
        notes: createLoanDto.notes,
      },
    });

    return {
      id: loan.id,
      bookId: loan.bookId,
      bookTitle: loan.book?.title || 'Unknown',
      bookAuthor: loan.book?.author || 'Unknown',
      memberId: loan.memberId,
      memberName: loan.member?.name || 'Unknown',
      memberEmail: loan.member?.email || 'Unknown',
      borrowDate: loan.borrowDate.toISOString().split('T')[0],
      dueDate: loan.dueDate.toISOString().split('T')[0],
      returnDate: loan.returnDate?.toISOString().split('T')[0] || null,
      status: loan.status,
      fineAmount: loan.fineAmount,
      notes: loan.notes,
    };
  }

  async update(id: string, updateLoanDto: { status?: string; returnDate?: string; fineAmount?: number; notes?: string }) {
    const loan = await this.prisma.loan.update({
      where: { id },
      include: { book: true, member: true },
      data: updateLoanDto,
    });

    return {
      id: loan.id,
      bookId: loan.bookId,
      bookTitle: loan.book?.title || 'Unknown',
      bookAuthor: loan.book?.author || 'Unknown',
      memberId: loan.memberId,
      memberName: loan.member?.name || 'Unknown',
      memberEmail: loan.member?.email || 'Unknown',
      borrowDate: loan.borrowDate.toISOString().split('T')[0],
      dueDate: loan.dueDate.toISOString().split('T')[0],
      returnDate: loan.returnDate?.toISOString().split('T')[0] || null,
      status: loan.status,
      fineAmount: loan.fineAmount,
      notes: loan.notes,
    };
  }

  async remove(id: string) {
    await this.prisma.loan.delete({
      where: { id },
    });
    return true;
  }
}