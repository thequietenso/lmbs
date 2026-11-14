import { Transform } from 'class-transformer';
import { IsInt, ValidateIf, IsString, Length, Max, Min } from 'class-validator';
export const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export class CreateBookDto {
  @Transform(trim) @IsString() @Length(1, 200) title: string;
  @Transform(trim) @IsString() @Length(1, 200) author: string;
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  genre?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(1)
  genreId?: number;
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @Length(1, 32)
  isbn?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(100000)
  pages?: number;
  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(2100)
  publishedYear?: number;
  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(100000)
  totalCopies?: number;
  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(100000)
  availableCopies?: number;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(0, 100)
  shelfLocation?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(0, 10000)
  description?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(0, 300)
  coverGradient?: string;
}
