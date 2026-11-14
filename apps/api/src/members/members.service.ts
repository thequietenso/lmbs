import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import type {
  CreateMemberDto,
  MemberQuery,
  UpdateMemberDto,
} from '../common/dto';
import { safeMember } from '../common/mapping';
import { audit, transaction } from '../common/database';
@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}
  async findAll(q: MemberQuery) {
    const where = {
      deletedAt: null,
      ...(q.status ? { status: q.status } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.member.findMany({
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.member.count({ where }),
    ]);
    return { data: data.map(safeMember), total, page: q.page, limit: q.limit };
  }
  async findOne(id: string) {
    const m = await this.prisma.member.findFirst({
      where: { id, deletedAt: null },
    });
    if (!m) throw new NotFoundException('Member not found');
    return safeMember(m);
  }
  async create(dto: CreateMemberDto, actor: string) {
    const member = await transaction(this.prisma, async (tx) => {
      const m = await tx.member.create({
        data: Object.assign({}, dto, {
          membershipNumber: dto.membershipNumber ?? `LIB-${randomUUID()}`,
          role: 'patron',
        }),
      });
      await audit(tx, 'add_member', actor, m.id, 'Member added');
      return safeMember(m);
    });
    this.realtime.emit('member.created', { member });
    return member;
  }
  async update(id: string, dto: UpdateMemberDto, actor: string) {
    const member = await transaction(this.prisma, async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Member" WHERE id = ${id} FOR UPDATE`;
      if (!(await tx.member.findFirst({ where: { id, deletedAt: null } })))
        throw new NotFoundException('Member not found');
      const m = await tx.member.update({ where: { id }, data: dto });
      await audit(tx, 'update_member', actor, id, 'Member updated');
      return safeMember(m);
    });
    this.realtime.emit('member.updated', { member });
    return member;
  }
  async remove(id: string, actor: string) {
    await transaction(this.prisma, async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Member" WHERE id = ${id} FOR UPDATE`;
      if (!(await tx.member.findFirst({ where: { id, deletedAt: null } })))
        throw new NotFoundException('Member not found');
      if (await tx.loan.count({ where: { memberId: id, returnDate: null } }))
        throw new ConflictException(
          'Cannot deactivate a member with outstanding loans',
        );
      await tx.member.update({
        where: { id },
        data: { deletedAt: new Date(), status: 'inactive' },
      });
      await audit(tx, 'delete_member', actor, id, 'Member deactivated');
    });
    this.realtime.emit('member.deleted', { id });
    return { message: 'Member deactivated' };
  }
}
