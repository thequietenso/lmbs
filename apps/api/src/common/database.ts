import { BadRequestException, ConflictException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma, PrismaClient } from '../../generated/prisma/client';
export type Transaction = Prisma.TransactionClient;
export async function transaction<T>(
  prisma: PrismaClient,
  action: (tx: Transaction) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(action, {
        isolationLevel: 'Serializable',
        maxWait: 10000,
        timeout: 15000,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        if (attempt >= 4)
          throw new ConflictException('Concurrent change; retry the request');
        await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 10));
        continue;
      }
      throw error;
    }
  }
}
function canonical(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return (
    '{' +
    Object.keys(value)
      .sort()
      .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .map(
        (k) =>
          JSON.stringify(k) +
          ':' +
          canonical((value as Record<string, unknown>)[k]),
      )
      .join(',') +
    '}'
  );
}
export async function idempotent<T>(
  tx: Transaction,
  actor: string,
  scope: string,
  key: string | undefined,
  body: unknown,
  action: () => Promise<T>,
): Promise<T> {
  if (!key) return action();
  if (!/^[\x21-\x7e]{1,128}$/.test(key))
    throw new BadRequestException('Invalid Idempotency-Key');
  const id = createHash('sha256')
    .update(`${actor}:${scope}:${key}`)
    .digest('hex');
  const requestHash = createHash('sha256')
    .update(canonical(body))
    .digest('hex');
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))::text`;
  const old = await tx.idempotencyRecord.findUnique({ where: { id } });
  if (old) {
    if (old.requestHash !== requestHash)
      throw new ConflictException(
        'Idempotency-Key reused with different request',
      );
    return old.response as T;
  }
  const result = await action();
  await tx.idempotencyRecord.create({
    data: {
      id,
      requestHash,
      response: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue,
    },
  });
  return result;
}
export function audit(
  tx: Transaction,
  type: string,
  actorId: string,
  entityId: string,
  title: string,
) {
  return tx.activity.create({
    data: {
      type,
      actorId,
      entityId,
      title,
      description: `${type}: ${entityId}`,
    },
  });
}
