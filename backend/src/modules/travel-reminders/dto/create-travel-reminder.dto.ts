import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateTravelReminderDto {
  @IsOptional() @IsString() clientId?: string;
  @IsOptional() @IsString() clientName?: string;
  @IsOptional() @IsString() clientPhone?: string;
  @IsOptional() @IsString() clientEmail?: string;
  @IsString() @IsNotEmpty() passengerName!: string;
  @IsOptional() @IsString() passengerDoc?: string;
  @IsString() @IsNotEmpty() route!: string;
  @IsOptional() @IsString() airline?: string;
  @IsOptional() @IsString() flightNumber?: string;
  @IsOptional() @IsString() ticketNumber?: string;
  @IsDateString() departureDate!: string;
  @IsOptional() @IsString() departureTime?: string;
  @IsOptional() @IsDateString() returnDate?: string;
  @IsOptional() @IsString() returnTime?: string;
  @IsOptional() hasReturn?: boolean;
  @IsOptional() @IsString() hotelName?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() observations?: string;
}