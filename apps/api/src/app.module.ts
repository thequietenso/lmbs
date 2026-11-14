import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './authentication/auth.module';
import { AuthenticationGuard, RateLimitGuard } from './authentication/guards';
import { AuthController } from './authentication/auth.controller';
import { BooksController } from './books/books.controller';
import { BooksService } from './books/books.service';
import { MembersController } from './members/members.controller';
import { MembersService } from './members/members.service';
import { LoansController } from './loans/loans.controller';
import { LoansService } from './loans/loans.service';
import { ReviewsController } from './reviews/reviews.controller';
import { ReviewsService } from './reviews/reviews.service';
import { GenreController } from './genre/genre.controller';
import { GenreService } from './genre/genre.service';
import { ActivitiesController } from './activities/activities.controller';
import { StatsController } from './stats/stats.controller';
import { RealtimeModule } from './realtime/realtime.module';
import { AppController } from './app.controller';
@Module({
  imports: [PrismaModule, AuthModule, RealtimeModule],
  controllers: [
    AppController,
    AuthController,
    BooksController,
    MembersController,
    LoansController,
    ReviewsController,
    GenreController,
    ActivitiesController,
    StatsController,
  ],
  providers: [
    BooksService,
    MembersService,
    LoansService,
    ReviewsService,
    GenreService,
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: AuthenticationGuard },
  ],
})
export class AppModule {}
