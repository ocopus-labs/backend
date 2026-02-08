import { IsString, IsOptional, IsNumber, IsEnum, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { TRANSACTION_TYPES, TransactionType } from '../interfaces';

export class StockTransactionDto {
  @IsEnum(Object.values(TRANSACTION_TYPES))
  type: TransactionType;

  @IsNumber()
  @Min(0.001)
  @Type(() => Number)
  quantity: number;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  reference?: string;
}

export class BulkStockUpdateDto {
  items: {
    id: string;
    quantity: number;
    type: TransactionType;
    reason?: string;
  }[];
}

export class AcknowledgeAlertDto {
  @IsString()
  alertId: string;
}
