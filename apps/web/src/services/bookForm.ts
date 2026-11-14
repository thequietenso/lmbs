import type { Book, BookFormData } from '../types';
/** Keep authoritative zero values and the version captured when editing began. */
export function editableBookValues(book: Book): BookFormData {
  return {
    _id: book._id, updatedAt: book.updatedAt,
    title: book.title, author: book.author, genre: book.genre,
    pages: book.pages ?? 0, publishedYear: book.publishedYear ?? new Date().getFullYear(),
    isbn: book.isbn ?? '', totalCopies: book.totalCopies,
    shelfLocation: book.shelfLocation ?? '', description: book.description ?? '',
    coverGradient: book.coverGradient ?? 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
  };
}
