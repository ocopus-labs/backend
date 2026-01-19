import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  ParseIntPipe,
  NotFoundException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Roles } from '@thallesp/nestjs-better-auth';
import { AdminService } from './admin.service';
import { USER_ROLES } from 'src/lib/auth/roles.constants';
import { UpdateBusinessStatusDto } from './dto/update-business-status.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';

@Controller('admin')
@UsePipes(new ValidationPipe({ transform: true }))
@Roles([USER_ROLES.SUPER_ADMIN])
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(private adminService: AdminService) {}

  /**
   * Get platform-wide statistics
   */
  @Get('stats')
  async getPlatformStats() {
    const stats = await this.adminService.getPlatformStats();
    return { stats };
  }

  /**
   * List all businesses with pagination and filters
   */
  @Get('businesses')
  async listAllBusinesses(
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 20,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    const result = await this.adminService.listAllBusinesses(page, limit, {
      status,
      type,
      search,
      sortBy,
      sortOrder,
    });
    return result;
  }

  /**
   * Get detailed business information
   */
  @Get('businesses/:id')
  async getBusinessDetails(@Param('id') id: string) {
    const business = await this.adminService.getBusinessDetails(id);
    if (!business) {
      throw new NotFoundException(`Business with ID ${id} not found`);
    }
    return { business };
  }

  /**
   * Update business status (activate/suspend)
   */
  @Patch('businesses/:id/status')
  @HttpCode(HttpStatus.OK)
  async updateBusinessStatus(
    @Param('id') id: string,
    @Body() dto: UpdateBusinessStatusDto,
  ) {
    const business = await this.adminService.updateBusinessStatus(id, dto.status);
    return { message: 'Business status updated successfully', business };
  }

  /**
   * List all users with pagination and filters
   */
  @Get('users')
  async listAllUsers(
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 20,
    @Query('banned') banned?: string,
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    const result = await this.adminService.listAllUsers(page, limit, {
      banned: banned === 'true' ? true : banned === 'false' ? false : undefined,
      search,
      role,
      sortBy,
      sortOrder,
    });
    return result;
  }

  /**
   * Get detailed user information
   */
  @Get('users/:id')
  async getUserDetails(@Param('id') id: string) {
    const user = await this.adminService.getUserDetails(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return { user };
  }

  /**
   * Update user's global role
   */
  @Patch('users/:id/role')
  @HttpCode(HttpStatus.OK)
  async updateUserRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    const user = await this.adminService.updateUserGlobalRole(id, dto.role);
    return { message: 'User role updated successfully', user };
  }

  /**
   * Get audit logs
   */
  @Get('audit-logs')
  async getAuditLogs(
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 50,
    @Query('userId') userId?: string,
    @Query('resource') resource?: string,
    @Query('action') action?: string,
  ) {
    const result = await this.adminService.getAuditLogs(page, limit, {
      userId,
      resource,
      action,
    });
    return result;
  }

  /**
   * Get platform analytics
   */
  @Get('analytics')
  async getPlatformAnalytics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const analytics = await this.adminService.getPlatformAnalytics(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
    return { analytics };
  }

  /**
   * Get all subscriptions
   */
  @Get('subscriptions')
  async getAllSubscriptions(
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 20,
    @Query('status') status?: string,
    @Query('planId') planId?: string,
  ) {
    const result = await this.adminService.getAllSubscriptions(page, limit, {
      status,
      planId,
    });
    return result;
  }
}
