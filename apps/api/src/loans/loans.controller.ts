import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { LoansService } from './loans.service';

@Controller('api/v1/loans')
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Get()
  findAll() {
    return this.loansService.findAll();
  }

  @Post()
  create(@Body() createLoanDto: { bookId: string; memberId: string; borrowDate?: string; dueDate: string; status?: string; fineAmount?: number; notes?: string }) {
    return this.loansService.create(createLoanDto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateLoanDto: { status?: string; returnDate?: string; fineAmount?: number; notes?: string }) {
    return this.loansService.update(id, updateLoanDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.loansService.remove(id);
  }
}
