import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto, ReviewQuery, UpdateReviewDto } from '../common/dto';
import type { AuthRequest } from '../authentication/guards';
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}
  @Get() findAll(@Query() q: ReviewQuery, @Req() r: AuthRequest) {
    return this.reviews.findAll(q, r.user.id);
  }
  @Get(':id') findOne(@Param('id') id: string, @Req() r: AuthRequest) {
    return this.reviews.findOne(id, r.user.id);
  }
  @Post() create(@Body() dto: CreateReviewDto, @Req() r: AuthRequest) {
    return this.reviews.create(dto, r.user.id);
  }
  @Put(':id') update(
    @Param('id') id: string,
    @Body() dto: UpdateReviewDto,
    @Req() r: AuthRequest,
  ) {
    return this.reviews.update(id, dto, r.user.id);
  }
  @Delete(':id') remove(@Param('id') id: string, @Req() r: AuthRequest) {
    return this.reviews.remove(id, r.user.id);
  }
}
