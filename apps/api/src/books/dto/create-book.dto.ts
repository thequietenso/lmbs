export class CreateBookDto {
    title: string;
        author: string;
        isbn: string;
        genreId: number;
        pages: number;
        publishedYear: number;
        totalCopies: number;
        availableCopies: number;
        shelfLocation: string;
        description: string;
        coverGradient: string;
}
