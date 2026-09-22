import { IsNotEmpty, IsString } from 'class-validator';

export class VoidCashReceiptDto {
  @IsString() @IsNotEmpty() motivo!: string;
}
