import { IsOptional, IsString } from 'class-validator';

export class CloseDebitNoteDto {
  @IsOptional() @IsString() motivo?: string;
}
