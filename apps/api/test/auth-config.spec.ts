import {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
} from '../src/authentication/crypto';
import { validateEnvironment } from '../src/config/environment';

describe('credential and configuration boundaries', () => {
  const secret = 'a'.repeat(40);
  it('salts password hashes and checks passwords without accepting null legacy hashes', async () => {
    const a = await hashPassword('correct-password');
    const b = await hashPassword('correct-password');
    expect(a).toMatch(/^scrypt\$32768\$8\$3\$/);
    expect(a).not.toBe(b);
    expect(a).not.toContain('correct-password');
    expect(await verifyPassword('correct-password', a)).toBe(true);
    expect(await verifyPassword('wrong-password', a)).toBe(false);
    expect(await verifyPassword('anything', null)).toBe(false);
    expect(await verifyPassword('anything', 'garbage')).toBe(false);
  });
  it('rejects tampered, expired and wrong-key tokens', () => {
    const token = signToken('member', secret, 60);
    expect(verifyToken(token, secret).sub).toBe('member');
    expect(() => verifyToken(token, 'b'.repeat(40))).toThrow();
    expect(() => verifyToken(token + 'x', secret)).toThrow();
    expect(() =>
      verifyToken(signToken('member', secret, -1), secret),
    ).toThrow();
  });
  it('fails closed on missing/weak secrets, invalid ports, insecure CORS and invalid URLs', () => {
    const valid = {
      DATABASE_URL: 'postgresql://a:b@localhost:5432/test',
      JWT_SECRET: secret,
    };
    expect(validateEnvironment(valid).port).toBe(3001);
    for (const bad of [
      { JWT_SECRET: '' },
      { JWT_SECRET: 'short' },
      { PORT: 'abc' },
      { DATABASE_URL: 'http://db' },
      { CORS_ORIGIN: '*' },
      { JWT_EXPIRES_IN: 'never' },
    ]) {
      expect(() => validateEnvironment({ ...valid, ...bad })).toThrow();
    }
  });
});
