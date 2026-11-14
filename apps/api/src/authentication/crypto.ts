import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
const params = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const derive = (password: string, salt: string) =>
  new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 64, params, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt);
  return `scrypt$32768$8$3$${salt}$${key.toString('hex')}`;
}
export async function verifyPassword(
  password: string,
  stored: string | null,
): Promise<boolean> {
  if (
    !stored ||
    !/^scrypt\$32768\$8\$3\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(stored)
  )
    return false;
  const [, , , , salt, hex] = stored.split('$');
  const actual = await derive(password, salt);
  return timingSafeEqual(actual, Buffer.from(hex, 'hex'));
}
interface Claims {
  sub: string;
  exp: number;
  iat: number;
  iss: string;
  aud: string;
}
export function signToken(
  sub: string,
  secret: string,
  seconds: number,
): string {
  const iat = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
  ).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub,
      iat,
      exp: iat + seconds,
      iss: 'lmbs-api',
      aud: 'lmbs',
    }),
  ).toString('base64url');
  const body = `${header}.${payload}`;
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
}
export function verifyToken(token: string, secret: string): Claims {
  try {
    if (
      token.length > 4096 ||
      !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)
    )
      throw new Error();
    const [h, p, s] = token.split('.');
    const expected = createHmac('sha256', secret).update(`${h}.${p}`).digest();
    const sig = Buffer.from(s, 'base64url');
    if (sig.length !== expected.length || !timingSafeEqual(sig, expected))
      throw new Error();
    const header = JSON.parse(Buffer.from(h, 'base64url').toString()) as {
      alg: string;
      typ: string;
    };
    const claims = JSON.parse(Buffer.from(p, 'base64url').toString()) as Claims;
    const now = Math.floor(Date.now() / 1000);
    if (
      header.alg !== 'HS256' ||
      header.typ !== 'JWT' ||
      typeof claims.sub !== 'string' ||
      !claims.sub ||
      !Number.isInteger(claims.exp) ||
      !Number.isInteger(claims.iat) ||
      claims.exp <= now ||
      claims.iat > now + 30 ||
      claims.iss !== 'lmbs-api' ||
      claims.aud !== 'lmbs'
    )
      throw new Error();
    return claims;
  } catch {
    throw new UnauthorizedException('Invalid or expired token');
  }
}
