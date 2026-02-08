import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateUpiSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^[\w.-]+@[\w]+$/, { message: 'Invalid UPI VPA format (e.g., merchant@upi)' })
  vpa?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  merchantName?: string;
}
