import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './guards';
import type { AuthRequest } from './guards';
import { LoginDto, PageQuery, RegisterDto } from '../common/dto';
import { LoansService } from '../loans/loans.service';
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly loans: LoansService,
  ) {}
  @Public() @Post('register') register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }
  @Public() @Post('login') login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }
  @Get('me') me(@Req() req: AuthRequest) {
    return req.user;
  }
  @Get('me/loans') myLoans(@Req() req: AuthRequest, @Query() query: PageQuery) {
    return this.loans.findAll({
      page: query.page,
      limit: query.limit,
      memberId: req.user.id,
    });
  }
}
