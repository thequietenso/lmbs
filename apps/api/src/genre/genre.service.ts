import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { audit, transaction } from '../common/database';
import { genreSlug } from '../books/books.service';
import type { CreateGenreDto, PageQuery, UpdateGenreDto } from '../common/dto';
@Injectable()
export class GenreService {
  constructor(private readonly prisma: PrismaService) {}
  async findAll(q: PageQuery) {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.genre.findMany({
        orderBy: { name: 'asc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.genre.count(),
    ]);
    return { data, total, page: q.page, limit: q.limit };
  }
  async findOne(id: number) {
    const genre = await this.prisma.genre.findUnique({ where: { id } });
    if (!genre) throw new NotFoundException('Genre not found');
    return genre;
  }
  create(dto: CreateGenreDto, actor: string) {
    return transaction(this.prisma, async (tx) => {
      const g = await tx.genre.create({
        data: Object.assign({}, dto, { slug: genreSlug(dto.name) }),
      });
      await audit(tx, 'add_genre', actor, String(g.id), 'Genre added');
      return g;
    });
  }
  update(id: number, dto: UpdateGenreDto, actor: string) {
    return transaction(this.prisma, async (tx) => {
      const g = await tx.genre.update({
        where: { id },
        data: Object.assign(
          {},
          dto,
          dto.name ? { slug: genreSlug(dto.name) } : {},
        ),
      });
      await audit(tx, 'update_genre', actor, String(id), 'Genre updated');
      return g;
    });
  }
  async remove(id: number, actor: string) {
    await transaction(this.prisma, async (tx) => {
      await tx.genre.delete({ where: { id } });
      await audit(tx, 'delete_genre', actor, String(id), 'Genre deleted');
    });
    return { message: 'Genre deleted' };
  }
}
