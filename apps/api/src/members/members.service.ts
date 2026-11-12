import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MembersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const members = await this.prisma.member.findMany({
      orderBy: { email: 'asc' },
    });

    return members.map((member) => ({
      id: member.id,
      name: member.name,
      email: member.email,
      phone: member.phone,
      membershipNumber: member.membershipNumber,
      status: member.status,
      joinedDate: member.joinedDate.toISOString(),
      bio: member.bio,
      hobbies: member.hobbies,
    }));
  }

  async create(createMemberDto: { name: string; email: string; phone?: string; membershipNumber?: string; status?: string; bio?: string; hobbies?: string }) {
    const member = await this.prisma.member.create({
      data: {
        name: createMemberDto.name,
        email: createMemberDto.email,
        phone: createMemberDto.phone,
        membershipNumber: createMemberDto.membershipNumber || `LIB-2026-${Math.floor(100 + Math.random() * 900)}`,
        status: createMemberDto.status || 'active',
        bio: createMemberDto.bio,
        hobbies: createMemberDto.hobbies,
      },
    });

    return {
      id: member.id,
      name: member.name,
      email: member.email,
      phone: member.phone,
      membershipNumber: member.membershipNumber,
      status: member.status,
      joinedDate: member.joinedDate.toISOString(),
      bio: member.bio,
      hobbies: member.hobbies,
    };
  }

  async update(id: string, updateMemberDto: { name?: string; email?: string; phone?: string; membershipNumber?: string; status?: string; bio?: string; hobbies?: string }) {
    const member = await this.prisma.member.update({
      where: { id },
      data: updateMemberDto,
    });

    return {
      id: member.id,
      name: member.name,
      email: member.email,
      phone: member.phone,
      membershipNumber: member.membershipNumber,
      status: member.status,
      joinedDate: member.joinedDate.toISOString(),
      bio: member.bio,
      hobbies: member.hobbies,
    };
  }

  async remove(id: string) {
    await this.prisma.member.delete({
      where: { id },
    });
    return true;
  }
}