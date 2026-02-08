import { IsString, IsOptional, IsNumber, Min } from 'class-validator';

export class BanUserDto {
  @IsString()
  @IsOptional()
  reason?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  expiresIn?: number;
}
