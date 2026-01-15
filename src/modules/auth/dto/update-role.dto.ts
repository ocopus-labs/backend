import { IsString, IsNotEmpty } from 'class-validator';

export class UpdateRoleDto {
    @IsString()
    @IsNotEmpty()
    restaurantId: string;

    @IsString()
    @IsNotEmpty()
    role: string;
}
