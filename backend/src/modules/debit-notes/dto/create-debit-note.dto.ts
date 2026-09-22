import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Currency, PaymentTerm, ServiceType } from '@prisma/client';

export class CreateDebitNoteItemDto {
  @IsEnum(ServiceType) serviceType!: ServiceType;
  @IsString() @IsNotEmpty() passengerName!: string;
  @IsString() @IsNotEmpty() description!: string;
  @IsEnum(Currency) currency!: Currency;
  @IsNumber() totalAmount!: number;
  @IsOptional() @IsString() ticketId?: string;
  @IsOptional() @IsString() ticketNumber?: string;
  @IsOptional() @IsString() operatorId?: string;
  @IsOptional() @IsNumber() feeAmount?: number;
  @IsOptional() @IsNumber() providerCommissionRate?: number;
  @IsOptional() @IsNumber() providerCommissionAmount?: number;
  @IsOptional() @IsNumber() clientCommissionRate?: number;
  @IsOptional() @IsNumber() clientCommissionAmount?: number;
  @IsOptional() @IsNumber() netCostToProvider?: number;
}

export class CreateDebitNoteDto {
  @IsString() @IsNotEmpty() accountId!: string;
  @IsISO8601() issueDate!: string;
  @IsEnum(PaymentTerm) paymentTerm!: PaymentTerm;
  @IsEnum(Currency) currency!: Currency;
  @IsOptional() @IsNumber() exchangeRate?: number;
  @IsOptional() @IsString() observations?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateDebitNoteItemDto)
  items!: CreateDebitNoteItemDto[];
}
