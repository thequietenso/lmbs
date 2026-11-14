import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { io, Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/common/bootstrap';
import { hashPassword, signToken } from '../src/authentication/crypto';
import { BooksService } from '../src/books/books.service';
import { LoansService } from '../src/loans/loans.service';
import { seed } from '../prisma/seed';
import { randomUUID } from 'node:crypto';

describe('real PostgreSQL HTTP + Socket.IO acceptance', () => {
  let app: INestApplication;
  let db: PrismaService;
  let token: string;
  let patronToken: string;
  let patronId: string;
  let base: string;
  const secret = 'integration-secret-32-characters-minimum';
  const api = () => request(app.getHttpServer());
  const auth = () => ({ Authorization: 'Bearer ' + token });
  const member = async (status = 'active') =>
    db.member.create({
      data: {
        name: 'Test Member',
        email: randomUUID() + '@example.test',
        membershipNumber: randomUUID(),
        status,
      },
    });
  const book = async (copies = 1) =>
    db.book.create({
      data: {
        title: 'Concurrency Book',
        author: 'Writer',
        genreId: (await db.genre.findFirstOrThrow()).id,
        totalCopies: copies,
        availableCopies: copies,
      },
    });
  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (
      !url ||
      !['localhost', '127.0.0.1'].includes(new URL(url).hostname) ||
      !new URL(url).pathname.includes('test')
    )
      throw new Error(
        'TEST_DATABASE_URL must identify an isolated LOCAL test database; migrations must be deployed first',
      );
    process.env.DATABASE_URL = url;
    process.env.JWT_SECRET = secret;
    process.env.NODE_ENV = 'test';
    const fixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = fixture.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
    db = app.get(PrismaService);
    // Only rows under this test database are cleared. Never the hosted environment.
    await db.review.deleteMany();
    await db.loan.deleteMany();
    await db.activity.deleteMany();
    await db.idempotencyRecord.deleteMany();
    await db.book.deleteMany();
    await db.member.deleteMany();
    await db.genre.deleteMany();
    await db.genre.create({ data: { name: 'General', slug: 'general' } });
    const staff = await db.member.create({
      data: {
        name: 'Librarian',
        email: 'staff@example.test',
        membershipNumber: 'staff',
        role: 'librarian',
        passwordHash: await hashPassword('staff-password-123'),
      },
    });
    token = signToken(staff.id, secret, 3600);
    const patron = await member();
    patronId = patron.id;
    patronToken = signToken(patron.id, secret, 3600);
  }, 30000);
  afterAll(async () => {
    await app?.close();
  });
  it('returns health/version and public paginated catalog with validated query', async () => {
    await api()
      .get('/api/v1/health')
      .expect(200)
      .expect((r) => expect(r.body.database).toBe('connected'));
    await api().get('/api/v1/version').expect(200);
    await api().get('/api/v1/books?page=0').expect(400);
    await api().get('/api/v1/books?available=maybe').expect(400);
    await api()
      .get('/api/v1/books')
      .expect(200)
      .expect((r) =>
        expect(r.body).toMatchObject({
          data: [],
          total: 0,
          page: 1,
          limit: 50,
        }),
      );
  });
  it('registers only a patron, never returns password hashes, logs in and validates me', async () => {
    const credentials = {
      name: 'Registered Patron',
      email: 'new@example.test',
      password: 'long-enough-password',
    };
    await api()
      .post('/api/v1/auth/register')
      .send({ ...credentials, role: 'admin' })
      .expect(400);
    const registered = await api()
      .post('/api/v1/auth/register')
      .send(credentials)
      .expect(201);
    expect(registered.body.user.role).toBe('patron');
    expect(registered.body.user.passwordHash).toBeUndefined();
    expect(registered.body.access_token).toBeTruthy();
    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email: credentials.email, password: credentials.password })
      .expect(201);
    await api()
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer ' + login.body.access_token)
      .expect(200)
      .expect((r) => expect(r.body.email).toBe(credentials.email));
    await api()
      .post('/api/v1/auth/login')
      .send({ email: credentials.email, password: 'wrong' })
      .expect(401);
    await api()
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer invalid')
      .expect(401);
  });
  it('protects management and private data from unauthenticated users and patrons', async () => {
    for (const route of [
      'members',
      'loans',
      'activities',
      'stats/loans',
      'stats/books',
    ]) {
      await api()
        .get('/api/v1/' + route)
        .expect(401);
      await api()
        .get('/api/v1/' + route)
        .set('Authorization', 'Bearer ' + patronToken)
        .expect(403);
    }
    await api()
      .post('/api/v1/books')
      .set('Authorization', 'Bearer ' + patronToken)
      .send({ title: 'Denied', author: 'Denied' })
      .expect(403);
  });
  it('creates full books, resolves genre strings, durably replays creates and rejects altered keys', async () => {
    const payload = {
      title: 'Full Book',
      author: 'Writer',
      genre: 'New Genre',
      pages: 200,
      publishedYear: 2020,
      totalCopies: 2,
      availableCopies: 2,
      shelfLocation: 'A1',
      description: 'A description',
    };
    const created = await api()
      .post('/api/v1/books')
      .set(auth())
      .set('Idempotency-Key', 'book-create')
      .send(payload)
      .expect(201);
    const replay = await api()
      .post('/api/v1/books')
      .set(auth())
      .set('Idempotency-Key', 'book-create')
      .send(payload)
      .expect(201);
    expect(created.body).toEqual(replay.body);
    expect(created.body.genre).toBe('New Genre');
    expect(created.body._id).toBeTruthy();
    await api()
      .post('/api/v1/books')
      .set(auth())
      .set('Idempotency-Key', 'book-create')
      .send({ ...payload, title: 'Different' })
      .expect(409);
    await api()
      .get('/api/v1/books/' + created.body._id)
      .expect(200);
    await api()
      .get('/api/v1/books?genre=New%20Genre&limit=1')
      .expect(200)
      .expect((r) => expect(r.body.total).toBe(1));
    await api()
      .put('/api/v1/books/' + created.body._id)
      .set(auth())
      .send({ title: 'Changed', updatedAt: created.body.updatedAt })
      .expect(200);
    await api()
      .put('/api/v1/books/' + created.body._id)
      .set(auth())
      .send({ title: 'Stale', updatedAt: created.body.updatedAt })
      .expect(409);
    await api()
      .delete('/api/v1/books/' + created.body._id)
      .set(auth())
      .expect(200);
    await api()
      .get('/api/v1/books/' + created.body._id)
      .expect(404);
    expect(
      (await db.book.findUniqueOrThrow({ where: { id: created.body._id } }))
        .deletedAt,
    ).not.toBeNull();
  });
  it('rejects bad DTOs, duplicate members and nonexistent resources with structured errors', async () => {
    await api()
      .post('/api/v1/books')
      .set(auth())
      .send({ author: 'Writer', totalCopies: -1 })
      .expect(400)
      .expect((r) =>
        expect(r.body).toMatchObject({
          statusCode: 400,
          message: 'Validation failed',
          details: expect.any(Array),
        }),
      );
    const payload = {
      name: 'Member CRUD',
      email: 'crud@example.test',
      phone: '+15551234567',
    };
    const created = await api()
      .post('/api/v1/members')
      .set(auth())
      .send(payload)
      .expect(201);
    await api().post('/api/v1/members').set(auth()).send(payload).expect(409);
    await api()
      .put('/api/v1/members/' + created.body.id)
      .set(auth())
      .send({ bio: 'Edited' })
      .expect(200);
    await api()
      .get('/api/v1/members/' + created.body.id)
      .set(auth())
      .expect(200)
      .expect((r) => expect(r.body.passwordHash).toBeUndefined());
    await api()
      .delete('/api/v1/members/' + created.body.id)
      .set(auth())
      .expect(200);
    expect(
      (await db.member.findUniqueOrThrow({ where: { id: created.body.id } }))
        .status,
    ).toBe('inactive');
    await api().get('/api/v1/books/missing').expect(404);
  });
  it('atomically lends the last copy once, returns it once and preserves audit/inventory', async () => {
    const b = await book();
    const m = await member();
    const otherMember = await member();
    const payload = { bookId: b.id, memberId: m.id, days: 14 };
    const issued = await Promise.all([
      api().post('/api/v1/loans').set(auth()).send(payload),
      api()
        .post('/api/v1/loans')
        .set(auth())
        .send({ ...payload, memberId: otherMember.id }),
    ]);
    expect(issued.map((r) => r.status).sort((a, b) => a - b)).toEqual([
      201, 409,
    ]);
    const loan = issued.find((r) => r.status === 201)!.body;
    expect(loan).toMatchObject({
      bookTitle: b.title,
      memberName: m.name,
      status: 'active',
    });
    expect(
      (await db.book.findUniqueOrThrow({ where: { id: b.id } }))
        .availableCopies,
    ).toBe(0);
    await api()
      .put('/api/v1/books/' + b.id)
      .set(auth())
      .send({ totalCopies: 0 })
      .expect(409);
    await api()
      .delete('/api/v1/books/' + b.id)
      .set(auth())
      .expect(409);
    await api()
      .delete('/api/v1/members/' + loan.memberId)
      .set(auth())
      .expect(409);
    await api()
      .put('/api/v1/loans/' + loan.id + '/return')
      .set(auth())
      .send([])
      .expect(400);
    const returned = await Promise.all([
      api()
        .put('/api/v1/loans/' + loan.id + '/return')
        .set(auth())
        .send({}),
      api()
        .put('/api/v1/loans/' + loan.id + '/return')
        .set(auth())
        .send({}),
    ]);
    expect(returned.every((r) => r.status === 200)).toBe(true);
    expect(
      (await db.book.findUniqueOrThrow({ where: { id: b.id } }))
        .availableCopies,
    ).toBe(1);
    expect(
      await db.activity.count({ where: { entityId: loan.id, type: 'return' } }),
    ).toBe(1);
    await api()
      .put('/api/v1/loans/' + loan.id + '/renew')
      .set(auth())
      .send({ days: 7 })
      .expect(409);
  });
  it('rejects inactive members, renews at most twice and enforces overdue fines at $0.50/day', async () => {
    const b = await book(3);
    const suspended = await member('suspended');
    const m = await member();
    await api()
      .post('/api/v1/loans')
      .set(auth())
      .send({ bookId: b.id, memberId: suspended.id, days: 14 })
      .expect(409);
    const issue = await api()
      .post('/api/v1/loans')
      .set(auth())
      .send({ bookId: b.id, memberId: m.id, days: 14 })
      .expect(201);
    const path = '/api/v1/loans/' + issue.body.id;
    await api()
      .put(path + '/renew')
      .set(auth())
      .send({ days: 7 })
      .expect(200);
    await api()
      .put(path + '/renew')
      .set(auth())
      .send({ days: 7 })
      .expect(200);
    await api()
      .put(path + '/renew')
      .set(auth())
      .send({ days: 7 })
      .expect(409);
    const due = new Date();
    due.setUTCDate(due.getUTCDate() - 4);
    due.setUTCHours(0, 0, 0, 0);
    await db.loan.update({
      where: { id: issue.body.id },
      data: { dueDate: due, renewalCount: 0 },
    });
    await api()
      .get(path)
      .set(auth())
      .expect(200)
      .expect((r) =>
        expect(r.body).toMatchObject({ status: 'overdue', fineAmount: 2 }),
      );
    await api()
      .put(path + '/renew')
      .set(auth())
      .send({ days: 7 })
      .expect(409);
    await api()
      .put(path + '/return')
      .set(auth())
      .send({})
      .expect(200)
      .expect((r) => expect(r.body.fineAmount).toBe(2));
  });
  it('idempotently issues a loan once and exposes only own loan history to patrons', async () => {
    const b = await book(2);
    const payload = { bookId: b.id, memberId: patronId, days: 7 };
    const first = await api()
      .post('/api/v1/loans')
      .set(auth())
      .set('Idempotency-Key', 'loan-once')
      .send(payload)
      .expect(201);
    const second = await api()
      .post('/api/v1/loans')
      .set(auth())
      .set('Idempotency-Key', 'loan-once')
      .send(payload)
      .expect(201);
    expect(first.body).toEqual(second.body);
    expect(
      (await db.book.findUniqueOrThrow({ where: { id: b.id } }))
        .availableCopies,
    ).toBe(1);
    await api()
      .get('/api/v1/auth/me/loans')
      .set('Authorization', 'Bearer ' + patronToken)
      .expect(200)
      .expect((r) =>
        expect(
          r.body.data.every(
            (l: { memberId: string }) => l.memberId === patronId,
          ),
        ).toBe(true),
      );
  });
  it('validates reviews, enforces uniqueness/ownership and supports CRUD', async () => {
    const b = await book();
    const url = '/api/v1/reviews';
    const h = { Authorization: 'Bearer ' + patronToken };
    await api().post(url).set(h).send({ bookId: b.id, rating: 6 }).expect(400);
    const created = await api()
      .post(url)
      .set(h)
      .send({ bookId: b.id, rating: 5, comment: 'Good' })
      .expect(201);
    await api().post(url).set(h).send({ bookId: b.id, rating: 4 }).expect(409);
    await api()
      .put(url + '/' + created.body.id)
      .set(auth())
      .send({ rating: 1 })
      .expect(403);
    await api()
      .put(url + '/' + created.body.id)
      .set(h)
      .send({ rating: 4 })
      .expect(200);
    await api()
      .get(url)
      .set(h)
      .expect(200)
      .expect((r) =>
        expect(
          r.body.data.every((x: { userId: string }) => x.userId === patronId),
        ).toBe(true),
      );
    await api()
      .get(url + '/' + created.body.id)
      .set(h)
      .expect(200);
    await api()
      .delete(url + '/' + created.body.id)
      .set(h)
      .expect(200);
    await api()
      .get(url + '/' + created.body.id)
      .set(h)
      .expect(404);
  });
  it('provides real aggregated stats, audits, genre CRUD and CORS auth headers', async () => {
    await api()
      .get('/api/v1/stats/books')
      .set(auth())
      .expect(200)
      .expect((r) => expect(r.body.totalBooks).toBeGreaterThan(0));
    await api()
      .get('/api/v1/stats/loans')
      .set(auth())
      .expect(200)
      .expect((r) => expect(r.body.totalLoans).toBeGreaterThan(0));
    await api()
      .get('/api/v1/activities')
      .set(auth())
      .expect(200)
      .expect((r) => expect(r.body.total).toBeGreaterThan(0));
    const created = await api()
      .post('/api/v1/genres')
      .set(auth())
      .send({ name: 'Unused Genre' })
      .expect(201);
    await api()
      .put('/api/v1/genres/' + created.body.id)
      .set(auth())
      .send({ name: 'Renamed Genre' })
      .expect(200);
    await api()
      .delete('/api/v1/genres/' + created.body.id)
      .set(auth())
      .expect(200);
    const cors = await api()
      .options('/api/v1/books')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Authorization,Idempotency-Key')
      .expect(204);
    expect(cors.headers['access-control-allow-headers']).toContain(
      'Authorization',
    );
  });
  it('authenticates sockets, sends staff-scoped notifications and never acknowledges stub mutations', async () => {
    const connect = (access?: string) =>
      io(base, {
        auth: access ? { token: access } : {},
        transports: ['websocket'],
        reconnection: false,
        forceNew: true,
      });
    const sockets: Socket[] = [];
    try {
      const denied = connect();
      sockets.push(denied);
      await new Promise<void>((resolve, reject) => {
        denied.once('connect_error', () => resolve());
        denied.once('connect', () =>
          reject(new Error('Anonymous socket connected')),
        );
      });
      const staff = connect(token);
      const patron = connect(patronToken);
      sockets.push(staff, patron);
      await Promise.all(
        [staff, patron].map(
          (socket) =>
            new Promise<void>((resolve, reject) => {
              socket.once('connect', resolve);
              socket.once('connect_error', reject);
            }),
        ),
      );
      const events: unknown[] = [];
      patron.on('member.created', (payload) => events.push(payload));
      const event = new Promise<unknown>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('Missing staff notification')),
          3000,
        );
        staff.once('member.created', (data) => {
          clearTimeout(timer);
          resolve(data);
        });
      });
      await api()
        .post('/api/v1/members')
        .set(auth())
        .send({ name: 'Socket Member', email: 'socket@example.test' })
        .expect(201);
      expect(await event).toHaveProperty('payload');
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(events).toHaveLength(0);
      let acknowledged = false;
      staff.emit('books:create', { title: 'Unsafe' }, () => {
        acknowledged = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(acknowledged).toBe(false);
    } finally {
      sockets.forEach((socket) => socket.disconnect());
    }
  }, 10000);
  it('serializes concurrent same-key book and loan creates without duplicate side effects', async () => {
    const books = app.get(BooksService);
    const loans = app.get(LoansService);
    const payload = {
      title: 'Concurrent keyed book',
      author: 'Writer',
      totalCopies: 2,
    };
    const created = await Promise.all(
      Array.from({ length: 4 }, () =>
        books.create(payload, patronId, 'parallel-book'),
      ),
    );
    expect(new Set(created.map((b) => b._id)).size).toBe(1);
    const loanPayload = {
      bookId: created[0]._id,
      memberId: patronId,
      days: 14,
    };
    const issued = await Promise.all(
      Array.from({ length: 4 }, () =>
        loans.create(loanPayload, patronId, 'parallel-loan'),
      ),
    );
    expect(new Set(issued.map((l) => l.id)).size).toBe(1);
    expect(
      (await db.book.findUniqueOrThrow({ where: { id: created[0]._id } }))
        .availableCopies,
    ).toBe(1);
    expect(
      await db.activity.count({
        where: { entityId: issued[0].id, type: 'borrow' },
      }),
    ).toBe(1);
  });
  it('seeds deterministic records twice without resetting operational state or existing passwords', async () => {
    const env = {
      SEED_DEMO_DATA: 'true',
      SEED_ADMIN_EMAIL: 'admin@example.test',
      SEED_ADMIN_PASSWORD: 'bootstrap-test-password',
    };
    await seed(db, env);
    expect(
      await db.book.count({ where: { id: { startsWith: 'seed-book-' } } }),
    ).toBe(10);
    expect(
      await db.loan.count({ where: { id: { startsWith: 'seed-loan-' } } }),
    ).toBe(6);
    const seedLoan = await db.loan.findUniqueOrThrow({
      where: { id: 'seed-loan-1' },
    });
    await app
      .get(LoansService)
      .returnLoan(seedLoan.id, patronId);
    const snapshot = await db.book.findUniqueOrThrow({
      where: { id: seedLoan.bookId },
    });
    const admin = await db.member.findUniqueOrThrow({
      where: { email: env.SEED_ADMIN_EMAIL },
    });
    const counts = [
      await db.book.count(),
      await db.member.count(),
      await db.loan.count(),
      await db.activity.count(),
    ];
    await seed(db, { ...env, SEED_ADMIN_PASSWORD: 'a-different-password' });
    expect([
      await db.book.count(),
      await db.member.count(),
      await db.loan.count(),
      await db.activity.count(),
    ]).toEqual(counts);
    expect(
      await db.book.findUniqueOrThrow({ where: { id: seedLoan.bookId } }),
    ).toEqual(snapshot);
    expect(
      (await db.member.findUniqueOrThrow({ where: { id: admin.id } }))
        .passwordHash,
    ).toBe(admin.passwordHash);
    expect(
      (await db.loan.findUniqueOrThrow({ where: { id: seedLoan.id } }))
        .returnDate,
    ).not.toBeNull();
    await expect(
      seed(db, {
        SEED_ADMIN_EMAIL: 'staff@example.test',
        SEED_ADMIN_PASSWORD: 'bootstrap-test-password',
      }),
    ).rejects.toThrow('refusing promotion');
  });
  it('limits authentication requests to five per minute', async () => {
    // Four earlier auth requests; the next reaches the allowed fifth then the sixth is rejected.
    await api()
      .post('/api/v1/auth/login')
      .send({ email: 'none@example.test', password: 'bad' })
      .expect(401);
    await api()
      .post('/api/v1/auth/login')
      .send({ email: 'none@example.test', password: 'bad' })
      .expect(429);
  });
});
