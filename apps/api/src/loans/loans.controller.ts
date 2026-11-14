import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { LoansService } from './loans.service';
import { CreateLoanDto, LoanQuery, RenewLoanDto } from '../common/dto';
import { Staff } from '../authentication/guards';
import type { AuthRequest } from '../authentication/guards';
@Controller('loans')
@Staff()
export class LoansController {
  constructor(private readonly loans: LoansService) {}
  @Get() findAll(@Query() query: LoanQuery) {
    return this.loans.findAll(query);
  }
  @Get(':id') findOne(@Param('id') id: string) {
    return this.loans.findOne(id);
  }
  @Post() create(
    @Body() dto: CreateLoanDto,
    @Req() req: AuthRequest,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.loans.create(dto, req.user.id, key);
  }
  @Put(':id/return') returnLoan(
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ) {
    if (
      req.body &&
      (Array.isArray(req.body) ||
        typeof req.body !== 'object' ||
        Object.keys(req.body).length)
    )
      throw new BadRequestException(
        'Return body must be empty; return date is server-controlled',
      );
    return this.loans.returnLoan(id, req.user.id);
  }
  @Put(':id/renew') renew(
    @Param('id') id: string,
    @Body() dto: RenewLoanDto,
    @Req() req: AuthRequest,
  ) {
    return this.loans.renew(id, dto.days, req.user.id);
  }
}
