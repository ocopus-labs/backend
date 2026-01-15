import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
  ParseIntPipe,
  InternalServerErrorException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Session, Roles } from '@thallesp/nestjs-better-auth';
import { AuthService, UserWithRole } from './auth.service';
import { USER_ROLES } from 'src/lib/auth/roles.constants';
import { UpdateRoleDto } from './dto/update-role.dto';
import { PermissionDto } from './dto/grant-permission.dto';
import { BanUserDto } from './dto/ban-user.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

interface UserSession {
  user: UserWithRole;
  token?: string;
}

@Controller('users')
@UsePipes(new ValidationPipe({ transform: true }))
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private authService: AuthService) { }

  /**
   * Get current user profile
   */
  @Get('profile')
  async getProfile(@Session() session: UserSession) {
    try {
      const user = await this.authService.getUserById(session.user.id);
      return { user };
    } catch (error) {
      this.logger.error('Error getting profile:', error);
      throw new InternalServerErrorException('Failed to get profile');
    }
  }

  /**
   * List all users (admin only)
   */
  @Get('users')
  @Roles([USER_ROLES.SUPER_ADMIN, USER_ROLES.FRANCHISE_OWNER, USER_ROLES.RESTAURANT_OWNER])
  async listUsers(
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 50,
    @Query('offset', new ParseIntPipe({ optional: true })) offset: number = 0,
  ) {
    try {
      const result = await this.authService.listUsers(limit, offset);
      return result;
    } catch (error) {
      this.logger.error('Error listing users:', error);
      throw new InternalServerErrorException('Failed to list users');
    }
  }

  /**
   * Get user by ID (admin only)
   */
  @Get('users/:userId')
  @Roles([USER_ROLES.SUPER_ADMIN, USER_ROLES.FRANCHISE_OWNER, USER_ROLES.RESTAURANT_OWNER])
  async getUser(@Param('userId') userId: string) {
    try {
      const user = await this.authService.getUserById(userId);
      if (!user) {
        return { error: 'User not found' };
      }
      return { user };
    } catch (error) {
      this.logger.error('Error getting user:', error);
      throw new InternalServerErrorException('Failed to get user');
    }
  }

  /**
   * Update user role
   */
  @Post('users/:userId/role')
  @HttpCode(HttpStatus.OK)
  @Roles([USER_ROLES.SUPER_ADMIN, USER_ROLES.FRANCHISE_OWNER, USER_ROLES.RESTAURANT_OWNER])
  async updateUserRole(
    @Param('userId') userId: string,
    @Body() body: UpdateRoleDto,
  ) {
    try {
      await this.authService.updateUserRole(
        userId,
        body.restaurantId,
        body.role,
      );
      return { message: 'Role updated successfully' };
    } catch (error) {
      this.logger.error('Error updating user role:', error);
      throw error;
    }
  }

  /**
   * Grant permission to user
   */
  @Post('users/:userId/permissions/grant')
  @HttpCode(HttpStatus.OK)
  @Roles([USER_ROLES.SUPER_ADMIN, USER_ROLES.FRANCHISE_OWNER])
  async grantPermission(
    @Param('userId') userId: string,
    @Body() body: PermissionDto,
  ) {
    try {
      await this.authService.grantPermission(
        userId,
        body.restaurantId,
        body.permission,
      );
      return { message: 'Permission granted successfully' };
    } catch (error) {
      this.logger.error('Error granting permission:', error);
      throw error;
    }
  }

  /**
   * Revoke permission from user
   */
  @Post('users/:userId/permissions/revoke')
  @HttpCode(HttpStatus.OK)
  @Roles([USER_ROLES.SUPER_ADMIN, USER_ROLES.FRANCHISE_OWNER])
  async revokePermission(
    @Param('userId') userId: string,
    @Body() body: PermissionDto,
  ) {
    try {
      await this.authService.revokePermission(
        userId,
        body.restaurantId,
        body.permission,
      );
      return { message: 'Permission revoked successfully' };
    } catch (error) {
      this.logger.error('Error revoking permission:', error);
      throw error;
    }
  }

  /**
   * Ban user
   */
  @Post('users/:userId/ban')
  @HttpCode(HttpStatus.OK)
  @Roles([USER_ROLES.SUPER_ADMIN, USER_ROLES.FRANCHISE_OWNER])
  async banUser(
    @Param('userId') userId: string,
    @Body() body: BanUserDto,
  ) {
    try {
      await this.authService.banUser(userId, body.reason, body.expiresIn);
      return { message: 'User banned successfully' };
    } catch (error) {
      this.logger.error('Error banning user:', error);
      throw error;
    }
  }

  /**
   * Unban user
   */
  @Post('users/:userId/unban')
  @HttpCode(HttpStatus.OK)
  @Roles([USER_ROLES.SUPER_ADMIN, USER_ROLES.FRANCHISE_OWNER])
  async unbanUser(@Param('userId') userId: string) {
    try {
      await this.authService.unbanUser(userId);
      return { message: 'User unbanned successfully' };
    } catch (error) {
      this.logger.error('Error unbanning user:', error);
      throw error;
    }
  }

  /**
   * Verify email
   */
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @Roles([USER_ROLES.SUPER_ADMIN, USER_ROLES.FRANCHISE_OWNER])
  async verifyEmail(@Body() body: VerifyEmailDto) {
    try {
      await this.authService.verifyEmail(body.userId);
      return { message: 'Email verified successfully' };
    } catch (error) {
      this.logger.error('Error verifying email:', error);
      throw error;
    }
  }

  /**
   * Check if user has permission
   */
  @Get('permissions/check')
  async checkPermission(
    @Query('userId') userId: string,
    @Query('resource') resource: string,
    @Query('action') action: string,
  ) {
    try {
      const hasPermission = await this.authService.userHasPermission(
        userId,
        resource,
        action,
      );
      return { hasPermission };
    } catch (error) {
      this.logger.error('Error checking permission:', error);
      throw new InternalServerErrorException('Failed to check permission');
    }
  }
}
