import { IsString, IsOptional, IsInt, IsEnum, Min } from 'class-validator';
import { TABLE_STATUSES, TableStatus } from '../interfaces';

export class UpdateTableStatusDto {
  @IsEnum(Object.values(TABLE_STATUSES))
  status: TableStatus;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class StartTableSessionDto {
  @IsString()
  orderId: string;

  @IsString()
  orderNumber: string;

  @IsInt()
  @IsOptional()
  @Min(1)
  customerCount?: number;
}

export class EndTableSessionDto {
  @IsString()
  @IsOptional()
  notes?: string;
}

export class AddMaintenanceLogDto {
  @IsString()
  action: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
