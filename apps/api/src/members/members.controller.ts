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
import { MembersService } from './members.service';
import { LoansService } from '../loans/loans.service';
import {
  CreateMemberDto,
  MemberQuery,
  PageQuery,
  UpdateMemberDto,
} from '../common/dto';
import { Staff } from '../authentication/guards';
import type { AuthRequest } from '../authentication/guards';
@Controller('members')
@Staff()
export class MembersController {
  constructor(
    private readonly members: MembersService,
    private readonly loans: LoansService,
  ) {}
  @Get() findAll(@Query() query: MemberQuery) {
    return this.members.findAll(query);
  }
  @Get(':id') findOne(@Param('id') id: string) {
    return this.members.findOne(id);
  }
  @Get(':id/loans') async memberLoans(
    @Param('id') id: string,
    @Query() query: PageQuery,
  ) {
    await this.members.findOne(id);
    return this.loans.findAll({
      page: query.page,
      limit: query.limit,
      memberId: id,
    });
  }
  @Post() create(@Body() dto: CreateMemberDto, @Req() req: AuthRequest) {
    return this.members.create(dto, req.user.id);
  }
  @Put(':id') update(
    @Param('id') id: string,
    @Body() dto: UpdateMemberDto,
    @Req() req: AuthRequest,
  ) {
    return this.members.update(id, dto, req.user.id);
  }
  @Delete(':id') remove(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.members.remove(id, req.user.id);
  }
}
