import { IsEnum, IsISO8601, IsOptional, IsString } from 'class-validator';
import { PaymentTerm } from '@prisma/client';

export class UpdateDebitNoteDto {
  @IsOptional() @IsISO8601() issueDate?: string;
  @IsOptional() @IsString() requesterText?: string;
  @IsOptional() @IsString() passengerName?: string;
  @IsOptional() @IsISO8601() dueDate?: string;
  @IsOptional() @IsEnum(PaymentTerm) paymentTerm?: PaymentTerm;
  @IsOptional() @IsString() observations?: string;
}
