import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { Public } from './authentication/guards';
@Controller()
@Public()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}
  @Get('health') async health() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', version: '1.0.0', database: 'connected' };
    } catch {
      throw new ServiceUnavailableException('Database unavailable');
    }
  }
  @Get('version') version() {
    return { version: '1.0.0', name: 'LMBS API', node: process.version };
  }
}
