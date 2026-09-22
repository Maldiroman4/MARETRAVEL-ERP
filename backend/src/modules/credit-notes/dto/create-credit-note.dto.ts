import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Currency } from '@prisma/client';

export class CreateCreditNoteDto {
  @IsString() @IsNotEmpty() providerAccountId!: string;

  @IsString() @IsNotEmpty() concept!: string;

  @IsEnum(Currency) currency!: Currency;

  @IsOptional() @IsNumber() @Min(0) totalAmountBob?: number;

  @IsOptional() @IsNumber() @Min(0) totalAmountUsd?: number;

  @IsOptional() @IsString() debitNoteId?: string;
}
