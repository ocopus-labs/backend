import { IsArray, IsUUID, IsEnum, ArrayMaxSize } from 'class-validator';

export enum BulkSubscriptionAction {
  CANCEL = 'cancel',
}

export class BulkSubscriptionActionDto {
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(50)
  ids: string[];

  @IsEnum(BulkSubscriptionAction)
  action: BulkSubscriptionAction;
}
