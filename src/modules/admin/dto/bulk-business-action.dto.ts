import { IsArray, IsUUID, IsEnum, ArrayMaxSize } from 'class-validator';

export enum BulkBusinessAction {
  SUSPEND = 'suspend',
  ACTIVATE = 'activate',
}

export class BulkBusinessActionDto {
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(50)
  ids: string[];

  @IsEnum(BulkBusinessAction)
  action: BulkBusinessAction;
}
