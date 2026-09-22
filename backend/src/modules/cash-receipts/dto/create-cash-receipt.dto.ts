import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreatePaymentLineDto {
  @IsString() @IsNotEmpty() debitNoteId!: string;
  @IsOptional() @IsNumber() @Min(0) amountPaidBob?: number;
  @IsOptional() @IsNumber() @Min(0) amountPaidUsd?: number;
  @IsOptional() @IsString() paymentMethodId?: string;
}

export class CreateCashReceiptDto {
  @IsString() @IsNotEmpty() clientAccountId!: string;
  @IsISO8601() issueDate!: string;
  @IsOptional() @IsNumber() @Min(0.0001) exchangeRate?: number;
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePaymentLineDto)
  lines!: CreatePaymentLineDto[];
}
