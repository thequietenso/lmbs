export function tokenLifetime(value = '7d'): number {
  const match = /^(\d+)([smhd]?)$/.exec(value);
  if (!match) throw new Error('JWT_EXPIRES_IN must be seconds or a duration');
  const seconds =
    Number(match[1]) *
    ({ '': 1, s: 1, m: 60, h: 3600, d: 86400 }[match[2]] ?? 0);
  if (seconds < 1 || seconds > 30 * 86400)
    throw new Error('JWT_EXPIRES_IN outside 1 second–30 days');
  return seconds;
}
export function validateEnvironment(env: NodeJS.ProcessEnv = process.env) {
  const url = new URL(env.DATABASE_URL ?? '');
  if (!['postgres:', 'postgresql:'].includes(url.protocol))
    throw new Error('DATABASE_URL must be PostgreSQL');
  const secret = env.JWT_SECRET ?? '';
  if (
    Buffer.byteLength(secret) < 32 ||
    /change-me|your-secret|replace-with/i.test(secret)
  )
    throw new Error('JWT_SECRET must be a unique secret of at least 32 bytes');
  const port = Number(env.PORT ?? '3001');
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('PORT must be 1–65535');
  const origins = (
    env.CORS_ORIGIN ?? 'http://localhost:5173,http://localhost:3000'
  )
    .split(',')
    .map((x) => x.trim());
  for (const origin of origins) {
    const parsed = new URL(origin);
    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.origin !== origin
    )
      throw new Error('CORS_ORIGIN must contain exact HTTP(S) origins');
  }
  const trustProxyHops = Number(env.TRUST_PROXY_HOPS ?? '0');
  if (![0, 1].includes(trustProxyHops)) throw new Error('TRUST_PROXY_HOPS must be 0 or 1');
  return {
    trustProxyHops,
    port,
    secret,
    origins,
    tokenSeconds: tokenLifetime(env.JWT_EXPIRES_IN),
  };
}
