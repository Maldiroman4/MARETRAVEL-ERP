import {
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Currency, TicketStatus } from '@prisma/client';

export class CreateTicketDto {
  @IsString() @MinLength(1) ticketNumber!: string;
  @IsOptional() @IsString() gdsSource?: string;
  @IsOptional() @IsString() counterId?: string;
  @IsISO8601() issueDate!: string;
  @IsString() passengerName!: string;
  @IsString() route!: string;
  @IsString() airlineCode!: string;
  @IsString() operatorId!: string;
  @IsNumber() netAmount!: number;
  @IsOptional() @IsNumber() taxAmount?: number;
  @IsNumber() totalAmount!: number;
  @IsEnum(Currency) currency!: Currency;
  @IsOptional() @IsNumber() commissionRate?: number;
  @IsOptional() @IsNumber() commissionAmount?: number;
  @IsOptional() @IsNumber() feeAmount?: number;
  @IsOptional() @IsEnum(TicketStatus) status?: TicketStatus;
}