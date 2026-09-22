import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import {
  RelationType,
  AccountCategoryType,
  AccountRating,
} from '@prisma/client';

export class CreateAccountDto {
  @IsString() @MinLength(1) code!: string;
  @IsString() @MinLength(2) name!: string;
  @IsOptional() @IsString() legalName?: string;
  @IsOptional() @IsString() nit?: string;
  @IsEnum(RelationType) relationType!: RelationType;
  @IsEnum(AccountCategoryType) accountType!: AccountCategoryType;
  @IsOptional() @IsEnum(AccountRating) rating?: AccountRating;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() cellphone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() address?: string;
}
