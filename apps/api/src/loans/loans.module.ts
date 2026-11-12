import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LoansService } from './loans.service';
import { LoansController } from './loans.controller';

@Module({
  imports: [PrismaModule],
  controllers: [LoansController],
  providers: [LoansService],
})
export class LoansModule {}
