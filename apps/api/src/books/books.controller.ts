import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { BooksService } from './books.service';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { BookQuery } from '../common/dto';
import { Public, Staff } from '../authentication/guards';
import type { AuthRequest } from '../authentication/guards';
@Controller('books')
@Staff()
export class BooksController {
  constructor(private readonly books: BooksService) {}
  @Public() @Get() findAll(@Query() query: BookQuery) {
    return this.books.findAll(query);
  }
  @Public() @Get(':id') findOne(@Param('id') id: string) {
    return this.books.findOne(id);
  }
  @Post() create(
    @Body() dto: CreateBookDto,
    @Req() req: AuthRequest,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.books.create(dto, req.user.id, key);
  }
  @Put(':id') update(
    @Param('id') id: string,
    @Body() dto: UpdateBookDto,
    @Req() req: AuthRequest,
  ) {
    return this.books.update(id, dto, req.user.id);
  }
  @Delete(':id') remove(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.books.remove(id, req.user.id);
  }
}
