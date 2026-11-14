import { Controller, Get, Post } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { RateLimitGuard } from '../src/authentication/guards';
import { configureApp } from '../src/common/bootstrap';

@Controller()
class ProxyProbeController {
  @Post('auth/login') login() {
    return { ok: true };
  }
  @Get('books') books() {
    return { ok: true };
  }
}
async function application(hops: string) {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/lmbs_test';
  process.env.JWT_SECRET = 'test-only-proxy-secret-with-more-than-32-bytes';
  process.env.NODE_ENV = 'test';
  process.env.TRUST_PROXY_HOPS = hops;
  const module = await Test.createTestingModule({
    controllers: [ProxyProbeController],
  }).compile();
  const app = module.createNestApplication();
  configureApp(app);
  app.useGlobalGuards(new RateLimitGuard());
  await app.init();
  return app;
}
describe('explicit single-proxy and direct-access rate-limit boundaries', () => {
  let app: INestApplication | undefined;
  afterEach(async () => {
    await app?.close();
    app = undefined;
    delete process.env.TRUST_PROXY_HOPS;
  });
  it('separates forwarded clients only in the explicitly private one-hop proxy topology', async () => {
    app = await application('1');
    for (let i = 1; i <= 6; i++)
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', `192.0.2.${i}`)
        .expect(201);
    for (let i = 0; i < 4; i++)
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', '192.0.2.1')
        .expect(201);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', '192.0.2.1')
      .expect(429);
    for (let i = 0; i < 100; i++)
      await request(app.getHttpServer())
        .get('/api/v1/books')
        .set('X-Forwarded-For', '192.0.2.1')
        .expect(200);
    await request(app.getHttpServer())
      .get('/api/v1/books')
      .set('X-Forwarded-For', '192.0.2.1')
      .expect(429);
    await request(app.getHttpServer())
      .get('/api/v1/books')
      .set('X-Forwarded-For', '192.0.2.2')
      .expect(200);
  });
  it('does not let direct clients rotate their identity using spoofed forwarded headers', async () => {
    app = await application('0');
    for (let i = 1; i <= 5; i++)
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', `192.0.2.${i}`)
        .expect(201);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', '192.0.2.99')
      .expect(429);
  });
});
