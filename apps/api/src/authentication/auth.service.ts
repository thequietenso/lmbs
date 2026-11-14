import type { AuthResponse } from '@lmbs/shared';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { validateEnvironment } from '../config/environment';
import { hashPassword, verifyPassword, signToken, verifyToken } from './crypto';
import { safeMember } from '../common/mapping';
import { audit, transaction } from '../common/database';
import type { LoginDto, RegisterDto } from '../common/dto';
@Injectable()
export class AuthService {
  private readonly config = validateEnvironment();
  constructor(private readonly prisma: PrismaService) {}
  async register(dto: RegisterDto): Promise<AuthResponse> {
    const passwordHash = await hashPassword(dto.password);
    const member = await transaction(this.prisma, async (tx) => {
      const m = await tx.member.create({
        data: {
          email: dto.email,
          name: dto.name,
          passwordHash,
          role: 'patron',
          membershipNumber: `LIB-${randomUUID()}`,
        },
      });
      await audit(tx, 'register', m.id, m.id, 'Member registered');
      return m;
    });
    return {
      access_token: signToken(
        member.id,
        this.config.secret,
        this.config.tokenSeconds,
      ),
      user: safeMember(member),
    };
  }
  async login(dto: LoginDto): Promise<AuthResponse> {
    const member = await this.prisma.member.findUnique({
      where: { email: dto.email },
    });
    // A dummy hash ensures missing accounts take the same expensive path.
    const hash =
      member?.passwordHash ??
      'scrypt$32768$8$3$00000000000000000000000000000000$' + '0'.repeat(128);
    const valid = await verifyPassword(dto.password, hash);
    if (!valid || !member || member.deletedAt || member.status !== 'active')
      throw new UnauthorizedException('Invalid credentials');
    await audit(this.prisma, 'login', member.id, member.id, 'Member signed in');
    return {
      access_token: signToken(
        member.id,
        this.config.secret,
        this.config.tokenSeconds,
      ),
      user: safeMember(member),
    };
  }
  async authenticate(token: string) {
    const { sub } = verifyToken(token, this.config.secret);
    const member = await this.prisma.member.findUnique({ where: { id: sub } });
    if (!member || member.deletedAt || member.status !== 'active')
      throw new UnauthorizedException('Account unavailable');
    return safeMember(member);
  }
}
