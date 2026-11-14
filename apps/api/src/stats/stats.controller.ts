import type { BookStats, LoanStats } from '@lmbs/shared';
import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Staff } from '../authentication/guards';
@Controller('stats')
@Staff()
export class StatsController {
  constructor(private readonly prisma: PrismaService) {}
  @Get('books') async books(): Promise<BookStats & { borrowedCopies: number }> {
    const [aggregate, genres] = await this.prisma.$transaction([
      this.prisma.book.aggregate({
        where: { deletedAt: null },
        _count: true,
        _sum: { totalCopies: true, availableCopies: true },
      }),
      this.prisma.genre.findMany({
        include: {
          _count: { select: { books: { where: { deletedAt: null } } } },
        },
        orderBy: { name: 'asc' },
      }),
    ]);
    const totalCopies = aggregate._sum.totalCopies ?? 0;
    const availableCopies = aggregate._sum.availableCopies ?? 0;
    return {
      totalBooks: aggregate._count,
      totalCopies,
      availableCopies,
      borrowedCopies: totalCopies - availableCopies,
      byGenre: Object.fromEntries(genres.map((g) => [g.name, g._count.books])),
    };
  }
  @Get('loans') async loans(): Promise<LoanStats> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        total: bigint;
        active: bigint;
        overdue: bigint;
        returned: bigint;
        fines: number;
      }>
    >`
      SELECT COUNT(*) AS total,
      COUNT(*) FILTER (WHERE "returnDate" IS NULL AND "dueDate" >= NOW()) AS active,
      COUNT(*) FILTER (WHERE "returnDate" IS NULL AND "dueDate" < NOW()) AS overdue,
      COUNT(*) FILTER (WHERE "returnDate" IS NOT NULL) AS returned,
      COALESCE(SUM(CASE WHEN "returnDate" IS NOT NULL THEN COALESCE("fineAmount",0)
        ELSE GREATEST(0, (NOW() AT TIME ZONE 'UTC')::date - "dueDate"::date) * 0.5 END),0)::float8 AS fines FROM "Loan"`;
    const row = rows[0];
    const total = Number(row.total);
    return {
      totalLoans: total,
      activeLoans: Number(row.active),
      overdueLoans: Number(row.overdue),
      totalFines: row.fines,
      returnRate: total ? (Number(row.returned) / total) * 100 : 0,
    };
  }
}
