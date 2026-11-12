import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BooksService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const books = await this.prisma.book.findMany({
      include: { genre: true },
      orderBy: { title: 'asc' },
    });

    return books.map((book) => ({
      _id: book.id,
      title: book.title,
      author: book.author,
      genre: book.genre?.name || 'General',
      pages: book.pages,
      publishedYear: book.publishedYear,
      isbn: book.isbn,
      totalCopies: book.totalCopies,
      availableCopies: book.availableCopies,
      shelfLocation: book.shelfLocation,
      description: book.description,
      coverGradient: book.coverGradient,
      createdAt: book.createdAt.toISOString(),
      updatedAt: book.updatedAt.toISOString(),
    }));
  }

  async create(createBookDto: { title: string; author: string; pages?: number; publishedYear?: number }) {
    const book = await this.prisma.book.create({
      data: {
        title: createBookDto.title,
        author: createBookDto.author,
        genreId: 1,
        pages: createBookDto.pages ?? 0,
        publishedYear: createBookDto.publishedYear ?? 0,
        totalCopies: 3,
        availableCopies: 3,
      },
    });

    const bookWithGenre = await this.prisma.book.findUnique({
      where: { id: book.id },
      include: { genre: true },
    });

    if (!bookWithGenre) {
      throw new Error('Failed to fetch created book');
    }

    return {
      _id: bookWithGenre.id,
      title: bookWithGenre.title,
      author: bookWithGenre.author,
      genre: bookWithGenre.genre?.name || 'General',
      pages: bookWithGenre.pages,
      publishedYear: bookWithGenre.publishedYear,
      isbn: bookWithGenre.isbn,
      totalCopies: bookWithGenre.totalCopies,
      availableCopies: bookWithGenre.availableCopies,
      shelfLocation: bookWithGenre.shelfLocation,
      description: bookWithGenre.description,
      coverGradient: bookWithGenre.coverGradient,
      createdAt: bookWithGenre.createdAt.toISOString(),
      updatedAt: bookWithGenre.updatedAt.toISOString(),
    };
  }

  async update(id: string, updateBookDto: { title?: string; author?: string; pages?: number; publishedYear?: number }) {
    const book = await this.prisma.book.update({
      where: { id },
      include: { genre: true },
      data: updateBookDto,
    });

    return {
      _id: book.id,
      title: book.title,
      author: book.author,
      genre: book.genre?.name || 'General',
      pages: book.pages,
      publishedYear: book.publishedYear,
      isbn: book.isbn,
      totalCopies: book.totalCopies,
      availableCopies: book.availableCopies,
      shelfLocation: book.shelfLocation,
      description: book.description,
      coverGradient: book.coverGradient,
      createdAt: book.createdAt.toISOString(),
      updatedAt: book.updatedAt.toISOString(),
    };
  }

  async remove(id: string) {
    await this.prisma.book.delete({
      where: { id },
    });
    return true;
  }
}