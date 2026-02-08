import { IsInt, Min, Max } from 'class-validator';

export class ExtendTrialDto {
  @IsInt()
  @Min(1)
  @Max(90)
  days: number;
}
