import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { MembersService } from './members.service';

@Controller('api/v1/members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  findAll() {
    return this.membersService.findAll();
  }

  @Post()
  create(@Body() createMemberDto: { name: string; email: string; phone?: string; membershipNumber?: string; status?: string; bio?: string; hobbies?: string }) {
    return this.membersService.create(createMemberDto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateMemberDto: { name?: string; email?: string; phone?: string; membershipNumber?: string; status?: string; bio?: string; hobbies?: string }) {
    return this.membersService.update(id, updateMemberDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.membersService.remove(id);
  }
}
