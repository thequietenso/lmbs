import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PageQuery } from '../common/dto';
import { Staff } from '../authentication/guards';
@Controller('activities')
@Staff()
export class ActivitiesController {
  constructor(private readonly prisma: PrismaService) {}
  @Get() async findAll(@Query() q: PageQuery) {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.activity.findMany({
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.activity.count(),
    ]);
    return { data, total, page: q.page, limit: q.limit };
  }
}
