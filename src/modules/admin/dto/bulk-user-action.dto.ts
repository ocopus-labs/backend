import {
  IsArray,
  IsUUID,
  IsEnum,
  IsOptional,
  IsString,
  ArrayMaxSize,
  MaxLength,
} from 'class-validator';

export enum BulkUserAction {
  BAN = 'ban',
  UNBAN = 'unban',
}

export class BulkUserActionDto {
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(50)
  ids: string[];

  @IsEnum(BulkUserAction)
  action: BulkUserAction;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
