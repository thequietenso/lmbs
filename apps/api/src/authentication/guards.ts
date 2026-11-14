import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import type { safeMember } from '../common/mapping';
export const Public = () => SetMetadata('public', true);
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
export const Staff = () => Roles('librarian', 'admin');
export type AuthRequest = Request & { user: ReturnType<typeof safeMember> };
@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}
  async canActivate(context: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride<boolean>('public', [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const match = /^Bearer (\S+)$/.exec(req.headers.authorization ?? '');
    if (!match) throw new UnauthorizedException('Bearer token required');
    req.user = await this.auth.authenticate(match[1]);
    const roles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles && !roles.includes(req.user.role))
      throw new ForbiddenException('Staff access required');
    return true;
  }
}
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<
    string,
    { count: number; until: number }
  >();
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    const now = Date.now();
    const auth =
      /\/auth\/(?:login|register)\/?$/i.test(req.path) && req.method === 'POST';
    const key = `${req.ip}:${auth ? 'auth' : 'general'}`;
    if (this.buckets.size > 10000)
      for (const [k, v] of this.buckets)
        if (v.until <= now) this.buckets.delete(k);
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.until <= now) {
      bucket = { count: 0, until: now + 60000 };
      this.buckets.set(key, bucket);
    }
    if (++bucket.count > (auth ? 5 : 100))
      throw new HttpException(
        'Too many requests; try again in one minute',
        429,
      );
    return true;
  }
}
