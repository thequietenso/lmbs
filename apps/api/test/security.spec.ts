import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';

describe('HTTP authorization boundary without database', () => {
  let app: INestApplication;
  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    const fixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({
        member: { findMany: async () => [], count: async () => 0 },
        loan: { findMany: async () => [], count: async () => 0 },
        book: { findMany: async () => [], count: async () => 0 },
      })
      .compile();
    app = fixture.createNestApplication();
    configureApp(app);
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
  });
  it.each(['members', 'loans', 'activities', 'stats/loans'])(
    'requires authentication for private %s',
    async (path) => {
      await request(app.getHttpServer())
        .get('/api/v1/' + path)
        .expect(401);
    },
  );
});
