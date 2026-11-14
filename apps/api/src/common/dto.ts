import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  ValidateIf,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { trim } from '../books/dto/create-book.dto';
export class PageQuery {
  @ValidateIf((_object, value) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;
  @ValidateIf((_object, value) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;
}
export class BookQuery extends PageQuery {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(1, 100)
  genre?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(['true', 'false'])
  available?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(1, 200)
  search?: string;
}
export class MemberQuery extends PageQuery {
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(['active', 'suspended', 'expired', 'inactive'])
  status?: string;
}
export class LoanQuery extends PageQuery {
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(['active', 'returned', 'overdue'])
  status?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(1, 100)
  bookId?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(1, 100)
  memberId?: string;
}
export class CreateMemberDto {
  @Transform(trim) @IsString() @Length(2, 200) name: string;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @Length(3, 254)
  email: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(0, 40)
  phone?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  membershipNumber?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(['active', 'suspended', 'expired', 'inactive'])
  status?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(0, 5000)
  bio?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(0, 1000)
  hobbies?: string;
}
export class UpdateMemberDto extends PartialType(CreateMemberDto, {
  skipNullProperties: false,
}) {}
export class CreateLoanDto {
  @IsString() @Length(1, 100) bookId: string;
  @IsString() @Length(1, 100) memberId: string;
  @IsInt() @Min(1) @Max(365) days: number;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(0, 5000)
  notes?: string;
}
export class RenewLoanDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(365)
  days = 14;
}
export class EmptyDto {}
export class RegisterDto {
  @Transform(trim) @IsString() @Length(2, 200) name: string;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @Length(3, 254)
  email: string;
  @IsString() @Length(12, 128) password: string;
}
export class LoginDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @Length(3, 254)
  email: string;
  @IsString() @Length(1, 128) password: string;
}
export class CreateGenreDto {
  @Transform(trim) @IsString() @Length(1, 100) name: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(0, 5000)
  description?: string;
}
export class UpdateGenreDto extends PartialType(CreateGenreDto, {
  skipNullProperties: false,
}) {}
export class CreateReviewDto {
  @IsString() @Length(1, 100) bookId: string;
  @IsInt() @Min(1) @Max(5) rating: number;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(0, 5000)
  comment?: string;
}
export class UpdateReviewDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(0, 5000)
  comment?: string;
}
export class ReviewQuery extends PageQuery {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(1, 100)
  bookId?: string;
}
