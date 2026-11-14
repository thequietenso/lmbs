import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { audit, transaction } from '../common/database';
import type {
  CreateReviewDto,
  ReviewQuery,
  UpdateReviewDto,
} from '../common/dto';
@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}
  async findAll(q: ReviewQuery, userId: string) {
    const where = { userId, ...(q.bookId ? { bookId: q.bookId } : {}) };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      }),
      this.prisma.review.count({ where }),
    ]);
    return { data, total, page: q.page, limit: q.limit };
  }
  async findOne(id: string, userId: string) {
    const r = await this.prisma.review.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Review not found');
    if (r.userId !== userId)
      throw new ForbiddenException('Review belongs to another member');
    return r;
  }
  create(dto: CreateReviewDto, userId: string) {
    return transaction(this.prisma, async (tx) => {
      if (
        !(await tx.book.findFirst({
          where: { id: dto.bookId, deletedAt: null },
        }))
      )
        throw new NotFoundException('Book not found');
      const r = await tx.review.create({
        data: Object.assign({}, dto, { userId }),
      });
      await audit(tx, 'add_review', userId, r.id, 'Review added');
      return r;
    });
  }
  update(id: string, dto: UpdateReviewDto, userId: string) {
    return transaction(this.prisma, async (tx) => {
      const r = await tx.review.findUnique({ where: { id } });
      if (!r) throw new NotFoundException('Review not found');
      if (r.userId !== userId)
        throw new ForbiddenException('Review belongs to another member');
      const result = await tx.review.update({ where: { id }, data: dto });
      await audit(tx, 'update_review', userId, id, 'Review updated');
      return result;
    });
  }
  async remove(id: string, userId: string) {
    await transaction(this.prisma, async (tx) => {
      const r = await tx.review.findUnique({ where: { id } });
      if (!r) throw new NotFoundException('Review not found');
      if (r.userId !== userId)
        throw new ForbiddenException('Review belongs to another member');
      await tx.review.delete({ where: { id } });
      await audit(tx, 'delete_review', userId, id, 'Review deleted');
    });
    return { message: 'Review deleted' };
  }
}
