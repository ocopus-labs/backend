import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsEmail,
  Min,
  Max,
  Matches,
} from 'class-validator';

export class CreateReservationDto {
  @IsString()
  @IsOptional()
  tableId?: string;

  @IsString()
  @IsNotEmpty()
  customerName: string;

  @IsString()
  @IsOptional()
  customerPhone?: string;

  @IsEmail()
  @IsOptional()
  customerEmail?: string;

  @IsInt()
  @Min(1)
  @Max(50)
  partySize: number;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'reservationDate must be in YYYY-MM-DD format',
  })
  reservationDate: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'reservationTime must be in HH:mm format',
  })
  reservationTime: string;

  @IsInt()
  @Min(15)
  @Max(480)
  @IsOptional()
  duration?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  specialRequests?: string;
}
