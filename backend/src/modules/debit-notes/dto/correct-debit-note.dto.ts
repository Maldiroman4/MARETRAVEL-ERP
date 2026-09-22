import { IsISO8601, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CorrectDebitNoteDto {
  @IsString() @IsNotEmpty() motivo!: string;
  @IsOptional() @IsISO8601() issueDate?: string;
  @IsOptional() @IsString() requesterText?: string;
  @IsOptional() @IsString() observations?: string;
  @IsOptional() @IsString() nit?: string;
  @IsOptional() @IsString() legalName?: string;
}
