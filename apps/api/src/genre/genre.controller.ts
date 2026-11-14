import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { GenreService } from './genre.service';
import { CreateGenreDto, PageQuery, UpdateGenreDto } from '../common/dto';
import { Public, Staff } from '../authentication/guards';
import type { AuthRequest } from '../authentication/guards';
@Controller('genres')
@Staff()
export class GenreController {
  constructor(private readonly genres: GenreService) {}
  @Public() @Get() findAll(@Query() q: PageQuery) {
    return this.genres.findAll(q);
  }
  @Public() @Get(':id') findOne(@Param('id', ParseIntPipe) id: number) {
    return this.genres.findOne(id);
  }
  @Post() create(@Body() dto: CreateGenreDto, @Req() r: AuthRequest) {
    return this.genres.create(dto, r.user.id);
  }
  @Put(':id') update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGenreDto,
    @Req() r: AuthRequest,
  ) {
    return this.genres.update(id, dto, r.user.id);
  }
  @Delete(':id') remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() r: AuthRequest,
  ) {
    return this.genres.remove(id, r.user.id);
  }
}
