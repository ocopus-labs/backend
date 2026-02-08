import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class AdjustPointsDto {
  @IsInt()
  points: number;

  @IsString()
  @IsNotEmpty()
  reason: string;
}
