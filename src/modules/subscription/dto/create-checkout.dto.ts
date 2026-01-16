import { IsString, IsOptional, IsUrl } from 'class-validator';

export class CreateCheckoutDto {
  @IsString()
  planSlug: string;

  @IsOptional()
  @IsUrl()
  successUrl?: string;

  @IsOptional()
  @IsUrl()
  cancelUrl?: string;
}
