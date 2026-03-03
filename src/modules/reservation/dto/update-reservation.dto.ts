import {
  IsString,
  IsOptional,
  IsInt,
  IsEmail,
  IsIn,
  Min,
  Max,
  Matches,
} from 'class-validator';

export class UpdateReservationDto {
  @IsString()
  @IsOptional()
  tableId?: string;

  @IsString()
  @IsOptional()
  customerName?: string;

  @IsString()
  @IsOptional()
  customerPhone?: string;

  @IsEmail()
  @IsOptional()
  customerEmail?: string;

  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  partySize?: number;

  @IsString()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'reservationDate must be in YYYY-MM-DD format',
  })
  reservationDate?: string;

  @IsString()
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'reservationTime must be in HH:mm format',
  })
  reservationTime?: string;

  @IsInt()
  @Min(15)
  @Max(480)
  @IsOptional()
  duration?: number;

  @IsIn(['pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show'])
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  specialRequests?: string;
}
