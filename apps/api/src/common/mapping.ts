import type { Role } from '@lmbs/shared';
import type { Book, Genre, Loan, Member } from '../../generated/prisma/client';
export function safeMember(m: Member) {
  const { passwordHash: _passwordHash, deletedAt: _deletedAt, ...safe } = m;
  return { ...safe, role: m.role as Role };
}
export function bookResponse(b: Book & { genre: Genre }) {
  const { id, genre, deletedAt: _deletedAt, ...rest } = b;
  return { _id: id, ...rest, genre: genre.name };
}
export function overdueFine(due: Date, now = new Date()): number {
  const day = (d: Date) =>
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.max(0, (day(now) - day(due)) / 86400000) * 0.5;
}
export function loanResponse(
  l: Loan & { book: Book; member: Member },
  now = new Date(),
) {
  const { book, member, ...rest } = l;
  const status = l.returnDate
    ? 'returned'
    : l.dueDate < now
      ? 'overdue'
      : 'active';
  return {
    ...rest,
    bookTitle: book.title,
    bookAuthor: book.author,
    memberName: member.name,
    memberEmail: member.email,
    borrowDate: l.borrowDate.toISOString().slice(0, 10),
    dueDate: l.dueDate.toISOString().slice(0, 10),
    returnDate: l.returnDate?.toISOString().slice(0, 10) ?? null,
    status,
    fineAmount: l.returnDate
      ? (l.fineAmount ?? 0)
      : overdueFine(l.dueDate, now),
  };
}
