import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateBookDto } from '../src/books/dto/create-book.dto';
import { UpdateBookDto } from '../src/books/dto/update-book.dto';
import { RegisterDto, RenewLoanDto, CreateReviewDto } from '../src/common/dto';
import { RateLimitGuard } from '../src/authentication/guards';
import { overdueFine } from '../src/common/mapping';
import type { ExecutionContext } from '@nestjs/common';
import { RealtimeService } from '../src/realtime/realtime.service';

describe('core regressions', () => {
  it('rejects a missing book title and invalid stock', async () => {
    const errors = await validate(
      plainToInstance(CreateBookDto, { author: 'Writer', totalCopies: -1 }),
      { forbidUnknownValues: false },
    );
    expect(errors.map((e) => e.property)).toEqual(
      expect.arrayContaining(['title', 'totalCopies']),
    );
  });
  it('rejects fractional and negative pages', async () => {
    for (const pages of [-1, 1.5]) {
      const errors = await validate(
        plainToInstance(CreateBookDto, {
          title: 'Book',
          author: 'Writer',
          pages,
        }),
        { forbidUnknownValues: false },
      );
      expect(errors.map((e) => e.property)).toContain('pages');
    }
  });
  it('rejects null updates, invalid review ratings, privilege fields and bad renewal days', async () => {
    const pipe = new (await import('@nestjs/common')).ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    for (const [metatype, value] of [
      [UpdateBookDto, { title: null }],
      [CreateReviewDto, { bookId: 'book', rating: 0 }],
      [
        RegisterDto,
        {
          name: 'Name',
          email: 'a@example.test',
          password: 'long-password',
          role: 'admin',
        },
      ],
      [RenewLoanDto, { days: 0 }],
    ] as const) {
      await expect(
        pipe.transform(value, { type: 'body', metatype }),
      ).rejects.toThrow();
    }
  });
  it('counts UTC fine days without charging partial due days or negative fines', () => {
    expect(
      overdueFine(
        new Date('2026-11-14T00:01:00Z'),
        new Date('2026-11-14T23:59:59Z'),
      ),
    ).toBe(0);
    expect(
      overdueFine(
        new Date('2026-11-14T23:59:59Z'),
        new Date('2026-11-15T00:00:00Z'),
      ),
    ).toBe(0.5);
    expect(
      overdueFine(
        new Date('2026-11-20T00:00:00Z'),
        new Date('2026-11-15T00:00:00Z'),
      ),
    ).toBe(0);
  });
  it('enforces independent per-IP general and auth rate limits', () => {
    const guard = new RateLimitGuard();
    const context = (path: string, ip = 'local') =>
      ({
        switchToHttp: () => ({
          getRequest: () => ({ path, method: 'POST', ip }),
        }),
      }) as ExecutionContext;
    for (let i = 0; i < 100; i++)
      expect(guard.canActivate(context('/api/v1/books'))).toBe(true);
    expect(() => guard.canActivate(context('/api/v1/books'))).toThrow(
      'Too many requests',
    );
    expect(guard.canActivate(context('/api/v1/books', 'other'))).toBe(true);
    for (let i = 0; i < 5; i++)
      expect(guard.canActivate(context('/api/v1/auth/login'))).toBe(true);
    expect(() => guard.canActivate(context('/api/v1/auth/register'))).toThrow(
      'Too many requests',
    );
  });
  it('shares the strict authentication bucket across case-insensitive route variants', () => {
    const guard = new RateLimitGuard();
    const context = (path: string) =>
      ({
        switchToHttp: () => ({
          getRequest: () => ({ path, method: 'POST', ip: 'mixed-case' }),
        }),
      }) as ExecutionContext;
    for (const path of [
      '/api/v1/auth/login',
      '/api/v1/AUTH/LOGIN',
      '/API/V1/Auth/Register/',
      '/api/v1/auth/LOGIN',
      '/api/v1/AuTh/login',
    ])
      expect(guard.canActivate(context(path))).toBe(true);
    expect(() => guard.canActivate(context('/api/v1/AUTH/REGISTER'))).toThrow(
      'Too many requests',
    );
  });
  it('emits one internal notification without recursive stack overflow', () => {
    const realtime = new RealtimeService();
    const received: unknown[] = [];
    realtime.on('notification', (event) => received.push(event));
    expect(() => realtime.emit('book.created', { id: 'book' })).not.toThrow();
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      event: 'book.created',
      payload: { id: 'book' },
    });
  });
});
