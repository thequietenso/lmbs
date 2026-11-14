import { config as loadEnvironment } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { hashPassword } from '../src/authentication/crypto';
import { genreSlug } from '../src/books/books.service';
import { transaction } from '../src/common/database';
const sampleBooks = [
  {
    title: 'Designing Data-Intensive Applications',
    author: 'Martin Kleppmann',
    genre: 'Computer Science',
    pages: 616,
    publishedYear: 2017,
    description: 'The definitive guide to distributed systems.',
    coverGradient: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
  },
  {
    title: 'Clean Code',
    author: 'Robert C. Martin',
    genre: 'Software Engineering',
    pages: 464,
    publishedYear: 2008,
    description: 'Master clean code craftsmanship.',
    coverGradient: 'linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%)',
  },
  {
    title: 'The Pragmatic Programmer',
    author: 'David Thomas & Andrew Hunt',
    genre: 'Software Engineering',
    pages: 352,
    publishedYear: 2019,
    description:
      'Best practices and major pitfalls of modern software development.',
    coverGradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  },
  {
    title: 'Structure and Interpretation of Computer Programs',
    author: 'Harold Abelson & Gerald Jay Sussman',
    genre: 'Computer Science',
    pages: 657,
    publishedYear: 1996,
    description: 'MIT textbook on functional abstractions.',
    coverGradient: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
  },
  {
    title: 'Dune',
    author: 'Frank Herbert',
    genre: 'Science Fiction',
    pages: 896,
    publishedYear: 1965,
    description: 'Set on the desert planet Arrakis.',
    coverGradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
  },
  {
    title: 'Refactoring',
    author: 'Martin Fowler',
    genre: 'Software Engineering',
    pages: 448,
    publishedYear: 2018,
    description: 'Catalog of refactorings with modern examples.',
    coverGradient: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
  },
  {
    title: 'Atomic Habits',
    author: 'James Clear',
    genre: 'Self Improvement',
    pages: 320,
    publishedYear: 2018,
    description: 'A practical framework for building good habits.',
    coverGradient: 'linear-gradient(135deg, #f43f5e 0%, #fb7185 100%)',
  },
  {
    title: 'Sapiens',
    author: 'Yuval Noah Harari',
    genre: 'History',
    pages: 498,
    publishedYear: 2014,
    description: 'How an insignificant ape became the ruler of planet Earth.',
    coverGradient: 'linear-gradient(135deg, #059669 0%, #14b8a6 100%)',
  },
  {
    title: 'The Design of Everyday Things',
    author: 'Don Norman',
    genre: 'Design & UX',
    pages: 368,
    publishedYear: 2013,
    description: 'The ultimate primer on human-centered design.',
    coverGradient: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
  },
  {
    title: 'Deep Work',
    author: 'Cal Newport',
    genre: 'Productivity',
    pages: 304,
    publishedYear: 2016,
    description: 'Rules for focused success in a distracted world.',
    coverGradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
  },
];

export async function seed(
  prisma: PrismaClient,
  env: NodeJS.ProcessEnv = process.env,
) {
  const email = env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = env.SEED_ADMIN_PASSWORD;
  if (Boolean(email) !== Boolean(password))
    throw new Error('Set both SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD');
  if (
    email &&
    (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !password ||
      password.length < 12 ||
      password.length > 128)
  )
    throw new Error(
      'Invalid bootstrap credentials; password must be 12–128 characters',
    );
  const passwordHash = password ? await hashPassword(password) : undefined;
  await transaction(prisma, async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(82736421)::text`;
    if (email && passwordHash) {
      const existing = await tx.member.findUnique({ where: { email } });
      if (existing && existing.role !== 'admin')
        throw new Error(
          'Bootstrap email belongs to a non-admin account; refusing promotion',
        );
      await tx.member.upsert({
        where: { email },
        update: {},
        create: {
          id: 'bootstrap-admin',
          email,
          name: env.SEED_ADMIN_NAME ?? 'Library Administrator',
          role: 'admin',
          passwordHash,
          membershipNumber: 'LIB-ADMIN',
        },
      });
    }
    if (env.SEED_DEMO_DATA !== 'true') return;
    const names = [
      'Computer Science',
      'Software Engineering',
      'Science Fiction',
      'Design & UX',
      'History',
      'Self Improvement',
      'Productivity',
      'Philosophy',
      'Mathematics',
      'Literature',
    ];
    const genres = new Map<string, number>();
    for (const name of names) {
      const g = await tx.genre.upsert({
        where: { name },
        update: {},
        create: { name, slug: genreSlug(name) },
      });
      genres.set(name, g.id);
    }
    const books: string[] = [];
    for (const [i, book] of sampleBooks.entries()) {
      const id = `seed-book-${String(i + 1).padStart(3, '0')}`;
      const { genre, ...fields } = book;
      const b = await tx.book.upsert({
        where: { id },
        update: {},
        create: {
          ...fields,
          id,
          genreId: genres.get(genre)!,
          totalCopies: 3,
          availableCopies: 3,
          shelfLocation: 'A1',
        },
      });
      books.push(b.id);
    }
    const members: string[] = [];
    const namesAndEmails = [
      ['Alexander Wright', 'alex.wright@example.test'],
      ['Elena Rostova', 'elena.rostova@example.test'],
      ['Marcus Chen', 'marcus.chen@example.test'],
      ['Sophia Patel', 'sophia.patel@example.test'],
      ['Devon Vance', 'devon.vance@example.test'],
    ];
    for (const [i, [name, email]] of namesAndEmails.entries()) {
      const m = await tx.member.upsert({
        where: { email },
        update: {},
        create: {
          id: `seed-member-${i + 1}`,
          name,
          email,
          membershipNumber: `LIB-DEMO-${i + 1}`,
          status: i === 4 ? 'suspended' : 'active',
          joinedDate: new Date('2026-11-01T00:00:00Z'),
        },
      });
      members.push(m.id);
    }
    for (let i = 0; i < 6; i++) {
      const id = `seed-loan-${i + 1}`;
      if (await tx.loan.findUnique({ where: { id } })) continue;
      const returned = i === 5;
      const bookId = books[[0, 1, 3, 4, 9, 2][i]];
      const memberId = members[[0, 2, 3, 1, 0, 1][i]];
      if (!returned) {
        const changed = await tx.book.updateMany({
          where: { id: bookId, deletedAt: null, availableCopies: { gt: 0 } },
          data: { availableCopies: { decrement: 1 } },
        });
        if (!changed.count)
          throw new Error('Seed book unavailable; refusing inventory reset');
      }
      await tx.loan.create({
        data: {
          id,
          bookId,
          memberId,
          borrowDate: new Date('2026-11-01T00:00:00Z'),
          dueDate: new Date('2026-11-15T00:00:00Z'),
          status: returned ? 'returned' : 'active',
          returnDate: returned ? new Date('2026-11-10T00:00:00Z') : null,
        },
      });
      await tx.activity.create({
        data: {
          id: `seed-activity-${i + 1}`,
          type: returned ? 'return' : 'borrow',
          title: returned ? 'Book returned' : 'Book checked out',
          description: 'Deterministic demo circulation',
          entityId: id,
          timestamp: new Date('2026-11-01T00:00:00Z'),
        },
      });
    }
  });
}
if (require.main === module) {
  loadEnvironment();
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  void seed(prisma)
    .then(() => console.log('Seed completed (existing records preserved)'))
    .catch(() => {
      console.error('Seed failed; review environment and data constraints');
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
