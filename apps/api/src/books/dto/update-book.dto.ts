import { PartialType } from '@nestjs/mapped-types';
import { IsISO8601, ValidateIf } from 'class-validator';
import { CreateBookDto } from './create-book.dto';
export class UpdateBookDto extends PartialType(CreateBookDto, {
  skipNullProperties: false,
}) {
  @ValidateIf((_object, value) => value !== undefined)
  @IsISO8601()
  updatedAt?: string;
}
