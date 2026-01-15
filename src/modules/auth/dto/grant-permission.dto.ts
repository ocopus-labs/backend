import { IsString, IsNotEmpty } from 'class-validator';

export class PermissionDto {
    @IsString()
    @IsNotEmpty()
    restaurantId: string;

    @IsString()
    @IsNotEmpty()
    permission: string;
}
