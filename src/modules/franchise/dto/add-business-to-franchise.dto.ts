import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class AddBusinessToFranchiseDto {
  @IsString()
  @IsNotEmpty()
  businessId: string;

  @IsString()
  @IsOptional()
  @IsIn(['local', 'franchise', 'hybrid'])
  configSource?: string;
}
