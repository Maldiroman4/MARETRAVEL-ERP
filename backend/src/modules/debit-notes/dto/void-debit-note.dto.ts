import { IsNotEmpty, IsString } from 'class-validator';

export class VoidDebitNoteDto {
  @IsString() @IsNotEmpty() motivo!: string;
}
