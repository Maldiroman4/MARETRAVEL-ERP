import { IsNotEmpty, IsString } from 'class-validator';

export class CloseDebitNoteDto {
  @IsString() @IsNotEmpty() motivo!: string;
}