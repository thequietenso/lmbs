import type { PaginatedResponse } from '@lmbs/shared';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { RealtimeService } from '../realtime/realtime.service';
import { audit, idempotent, transaction } from '../common/database';
import type { Transaction } from '../common/database';
import { bookResponse } from '../common/mapping';
import type { BookQuery } from '../common/dto';
import type { CreateBookDto } from './dto/create-book.dto';
import type { UpdateBookDto } from './dto/update-book.dto';
export const genreSlug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') +
  '-' +
  createHash('sha256').update(name).digest('hex').slice(0, 8);
@Injectable()
export class BooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}
  async findAll(
    q: BookQuery,
  ): Promise<PaginatedResponse<ReturnType<typeof bookResponse>>> {
    const where: Prisma.BookWhereInput = {
      deletedAt: null,
      ...(q.genre ? { genre: { name: q.genre } } : {}),
      ...(q.available
        ? { availableCopies: q.available === 'true' ? { gt: 0 } : 0 }
        : {}),
      ...(q.search
        ? {
            OR: [
              { title: { contains: q.search, mode: 'insensitive' } },
              { author: { contains: q.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.book.findMany({
        where,
        include: { genre: true },
        orderBy: [{ title: 'asc' }, { id: 'asc' }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.book.count({ where }),
    ]);
    return {
      data: data.map(bookResponse),
      total,
      page: q.page,
      limit: q.limit,
    };
  }
  async findOne(id: string) {
    const book = await this.prisma.book.findFirst({
      where: { id, deletedAt: null },
      include: { genre: true },
    });
    if (!book) throw new NotFoundException('Book not found');
    return bookResponse(book);
  }
  private async genre(
    tx: Transaction,
    dto: { genreId?: number; genre?: string },
    fallback?: number,
  ) {
    if (dto.genreId !== undefined) {
      const genre = await tx.genre.findUnique({ where: { id: dto.genreId } });
      if (!genre) throw new NotFoundException('Genre not found');
      if (dto.genre && dto.genre !== genre.name)
        throw new ConflictException('genre and genreId disagree');
      return genre.id;
    }
    if (!dto.genre && fallback) return fallback;
    const name = dto.genre ?? 'General';
    return (
      await tx.genre.upsert({
        where: { name },
        update: {},
        create: { name, slug: genreSlug(name) },
      })
    ).id;
  }
  async create(dto: CreateBookDto, actor: string, key?: string) {
    const response = await transaction(this.prisma, (tx) =>
      idempotent(tx, actor, 'books', key, dto, async () => {
        const total = dto.totalCopies ?? 3;
        if (dto.availableCopies !== undefined && dto.availableCopies !== total)
          throw new ConflictException(
            'New books must have all copies available',
          );
        const { genre: _genre, genreId: _genreId, ...fields } = dto;
        const book = await tx.book.create({
          data: {
            ...fields,
            genreId: await this.genre(tx, dto),
            totalCopies: total,
            availableCopies: total,
          },
          include: { genre: true },
        });
        await audit(tx, 'add_book', actor, book.id, 'Book added');
        return bookResponse(book);
      }),
    );
    this.realtime.emit('book.created', { book: response });
    return response;
  }
  async update(id: string, dto: UpdateBookDto, actor: string) {
    const response = await transaction(this.prisma, async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Book" WHERE id = ${id} FOR UPDATE`;
      const old = await tx.book.findFirst({ where: { id, deletedAt: null } });
      if (!old) throw new NotFoundException('Book not found');
      if (
        dto.updatedAt &&
        new Date(dto.updatedAt).getTime() !== old.updatedAt.getTime()
      )
        throw new ConflictException('Book has changed; refresh before saving');
      const outstanding = old.totalCopies - old.availableCopies;
      const total = dto.totalCopies ?? old.totalCopies;
      const available = total - outstanding;
      if (
        available < 0 ||
        (dto.availableCopies !== undefined && dto.availableCopies !== available)
      )
        throw new ConflictException(
          'Inventory must preserve checked-out copies',
        );
      const {
        genre: _genre,
        genreId: _genreId,
        updatedAt: _updatedAt,
        ...fields
      } = dto;
      const book = await tx.book.update({
        where: { id },
        data: {
          ...fields,
          genreId: await this.genre(tx, dto, old.genreId),
          totalCopies: total,
          availableCopies: available,
        },
        include: { genre: true },
      });
      await audit(tx, 'update_book', actor, id, 'Book updated');
      return bookResponse(book);
    });
    this.realtime.emit('book.updated', { book: response });
    return response;
  }
  async remove(id: string, actor: string) {
    await transaction(this.prisma, async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Book" WHERE id = ${id} FOR UPDATE`;
      if (!(await tx.book.findFirst({ where: { id, deletedAt: null } })))
        throw new NotFoundException('Book not found');
      if (await tx.loan.count({ where: { bookId: id, returnDate: null } }))
        throw new ConflictException(
          'Cannot delete a book with outstanding loans',
        );
      await tx.book.update({ where: { id }, data: { deletedAt: new Date() } });
      await audit(tx, 'delete_book', actor, id, 'Book deleted');
    });
    this.realtime.emit('book.deleted', { id });
    return { message: 'Book deleted' };
  }
}
