import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class GeneratePaymentQrDto {
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  transactionNote?: string;
}
