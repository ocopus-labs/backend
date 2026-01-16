import { IsString } from 'class-validator';

export class ChangePlanDto {
  @IsString()
  planSlug: string;
}
