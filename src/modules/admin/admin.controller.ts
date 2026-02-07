import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Logger,
  ParseIntPipe,
  NotFoundException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Roles, Session, AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { AdminService } from './admin.service';
import { USER_ROLES } from 'src/lib/auth/roles.constants';
import { generateCsv } from 'src/lib/common';
import { UpdateBusinessStatusDto } from './dto/update-business-status.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { ExtendTrialDto } from './dto/extend-trial.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { BulkUserActionDto } from './dto/bulk-user-action.dto';
import { BulkBusinessActionDto } from './dto/bulk-business-action.dto';
import { BulkSubscriptionActionDto } from './dto/bulk-subscription-action.dto';
import { Request, Response } from 'express';

interface UserSession {
  user: {
    id: string;
    email: string;
    name?: string;
    role?: string;
  };
  session?: {
    id: string;
    token: string;
  };
}

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
   * Get live monitoring stats (orders today, payments, webhook health, hourly data)
   */
  @Get('live-stats')
  async getLiveStats() {
    const stats = await this.adminService.getLiveStats();
    return stats;
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
   * Export businesses as CSV
   */
  @Get('businesses/export')
  async exportBusinesses(
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('search') search?: string,
    @Res() res?: Response,
  ) {
    const result = await this.adminService.listAllBusinesses(1, 10000, {
      status,
      type,
      search,
    });

    const headers = ['Name', 'Type', 'Owner', 'Status', 'Created', 'Orders', 'Team Size'];
    const rows = result.data.map((biz: any) => [
      biz.name || '',
      biz.type || '',
      biz.owner?.name || biz.owner?.email || '',
      biz.status || '',
      biz.createdAt ? new Date(biz.createdAt).toISOString().split('T')[0] : '',
      biz._count?.orders ?? 0,
      biz._count?.businessUsers ?? 0,
    ]);

    const csv = generateCsv(headers, rows);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="businesses-${new Date().toISOString().split('T')[0]}.csv"`,
    });
    return res.send(csv);
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
    @Req() req: Request,
  ) {
    const business = await this.adminService.updateBusinessStatus(id, dto.status, {
      userId: (req as any).user?.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
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
   * Export users as CSV
   */
  @Get('users/export')
  async exportUsers(
    @Query('banned') banned?: string,
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Res() res?: Response,
  ) {
    const result = await this.adminService.listAllUsers(1, 10000, {
      banned: banned === 'true' ? true : banned === 'false' ? false : undefined,
      search,
      role,
    });

    const headers = ['Name', 'Email', 'Role', 'Verified', 'Banned', 'Created', 'Businesses', 'Orders'];
    const rows = result.data.map((user: any) => [
      user.name || '',
      user.email || '',
      user.role || '',
      user.emailVerified ? 'Yes' : 'No',
      user.banned ? 'Yes' : 'No',
      user.createdAt ? new Date(user.createdAt).toISOString().split('T')[0] : '',
      user._count?.businessUsers ?? 0,
      user._count?.orders ?? 0,
    ]);

    const csv = generateCsv(headers, rows);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="users-${new Date().toISOString().split('T')[0]}.csv"`,
    });
    return res.send(csv);
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
    @Req() req: Request,
  ) {
    const user = await this.adminService.updateUserGlobalRole(id, dto.role, {
      adminId: (req as any).user?.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
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
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const result = await this.adminService.getAuditLogs(page, limit, {
      userId,
      resource,
      action,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
    return result;
  }

  /**
   * Export audit logs as CSV
   */
  @Get('audit-logs/export')
  async exportAuditLogs(
    @Query('userId') userId?: string,
    @Query('resource') resource?: string,
    @Query('action') action?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Res() res?: Response,
  ) {
    const result = await this.adminService.getAuditLogs(1, 10000, {
      userId,
      resource,
      action,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    const headers = [
      'Timestamp',
      'User',
      'Action',
      'Resource',
      'Business',
      'IP Address',
    ];
    const rows = result.data.map((log: any) => [
      log.createdAt ? new Date(log.createdAt).toISOString() : '',
      log.user?.email || 'System',
      log.action || '',
      log.resource || '',
      log.restaurant?.name || '',
      log.ipAddress || '',
    ]);

    const csv = generateCsv(headers, rows);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`,
    });
    return res.send(csv);
  }

  /**
   * Get recent activity feed for admin dashboard
   */
  @Get('activity-feed')
  async getActivityFeed(
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 20,
    @Query('since') since?: string,
  ) {
    const activities = await this.adminService.getActivityFeed(limit, since);
    return { activities };
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

  /**
   * Export subscriptions as CSV
   */
  @Get('subscriptions/export')
  async exportSubscriptions(
    @Query('status') status?: string,
    @Query('planId') planId?: string,
    @Res() res?: Response,
  ) {
    const result = await this.adminService.getAllSubscriptions(1, 10000, {
      status,
      planId,
    });

    const headers = [
      'User Email',
      'Plan',
      'Status',
      'Period Start',
      'Period End',
      'Created',
    ];
    const rows = result.data.map((sub: any) => [
      sub.user?.email || '',
      sub.plan?.displayName || sub.plan?.name || '',
      sub.status || '',
      sub.currentPeriodStart
        ? new Date(sub.currentPeriodStart).toISOString().split('T')[0]
        : '',
      sub.currentPeriodEnd
        ? new Date(sub.currentPeriodEnd).toISOString().split('T')[0]
        : '',
      sub.createdAt
        ? new Date(sub.createdAt).toISOString().split('T')[0]
        : '',
    ]);

    const csv = generateCsv(headers, rows);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="subscriptions-${new Date().toISOString().split('T')[0]}.csv"`,
    });
    return res.send(csv);
  }

  /**
   * Cancel a subscription
   */
  @Patch('subscriptions/:id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelSubscription(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const subscription = await this.adminService.cancelSubscription(id, {
      adminId: (req as any).user?.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return { message: 'Subscription canceled successfully', subscription };
  }

  /**
   * Extend trial period for a subscription
   */
  @Patch('subscriptions/:id/extend-trial')
  @HttpCode(HttpStatus.OK)
  async extendTrial(
    @Param('id') id: string,
    @Body() dto: ExtendTrialDto,
    @Req() req: Request,
  ) {
    const subscription = await this.adminService.extendTrial(id, dto.days, {
      adminId: (req as any).user?.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return { message: 'Trial extended successfully', subscription };
  }

  /**
   * List webhook events with pagination and filters
   */
  @Get('webhooks')
  async getWebhookEvents(
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 50,
    @Query('provider') provider?: string,
    @Query('status') status?: string,
    @Query('eventType') eventType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const result = await this.adminService.getWebhookEvents(page, limit, {
      provider,
      status,
      eventType,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
    return result;
  }

  /**
   * Get detailed webhook event information including payload
   */
  @Get('webhooks/:id')
  async getWebhookEventDetail(@Param('id') id: string) {
    const event = await this.adminService.getWebhookEventDetail(id);
    if (!event) {
      throw new NotFoundException(`Webhook event with ID ${id} not found`);
    }
    return { event };
  }

  /**
   * Retry a failed webhook event
   */
  @Post('webhooks/:id/retry')
  @HttpCode(HttpStatus.OK)
  async retryWebhookEvent(@Param('id') id: string) {
    const event = await this.adminService.retryWebhookEvent(id);
    return { message: 'Webhook event queued for retry', event };
  }

  // ==================== BULK ACTIONS ====================

  /**
   * Bulk action on users (ban/unban)
   */
  @Post('users/bulk-action')
  @HttpCode(HttpStatus.OK)
  async bulkUserAction(
    @Body() dto: BulkUserActionDto,
    @Session() session: UserSession,
    @Req() req: Request,
  ) {
    const result = await this.adminService.bulkUserAction(dto, {
      adminId: session.user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return { message: `Bulk user action completed`, ...result };
  }

  /**
   * Bulk action on businesses (suspend/activate)
   */
  @Post('businesses/bulk-action')
  @HttpCode(HttpStatus.OK)
  async bulkBusinessAction(
    @Body() dto: BulkBusinessActionDto,
    @Session() session: UserSession,
    @Req() req: Request,
  ) {
    const result = await this.adminService.bulkBusinessAction(dto, {
      adminId: session.user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return { message: `Bulk business action completed`, ...result };
  }

  /**
   * Bulk action on subscriptions (cancel)
   */
  @Post('subscriptions/bulk-action')
  @HttpCode(HttpStatus.OK)
  async bulkSubscriptionAction(
    @Body() dto: BulkSubscriptionActionDto,
    @Session() session: UserSession,
    @Req() req: Request,
  ) {
    const result = await this.adminService.bulkSubscriptionAction(dto, {
      adminId: session.user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return { message: `Bulk subscription action completed`, ...result };
  }

  // ==================== PLAN MANAGEMENT ====================

  /**
   * List all subscription plans (including archived/private)
   */
  @Get('plans')
  async getAllPlans() {
    const plans = await this.adminService.getAllPlans();
    return { plans };
  }

  /**
   * Get plan detail with subscriber count
   */
  @Get('plans/:id')
  async getPlanDetail(@Param('id') id: string) {
    const plan = await this.adminService.getPlanDetail(id);
    return { plan };
  }

  /**
   * Create a new subscription plan
   */
  @Post('plans')
  @HttpCode(HttpStatus.CREATED)
  async createPlan(@Body() dto: CreatePlanDto) {
    const plan = await this.adminService.createPlan(dto);
    return { message: 'Plan created successfully', plan };
  }

  /**
   * Update an existing subscription plan
   */
  @Patch('plans/:id')
  @HttpCode(HttpStatus.OK)
  async updatePlan(
    @Param('id') id: string,
    @Body() dto: UpdatePlanDto,
  ) {
    const plan = await this.adminService.updatePlan(id, dto);
    return { message: 'Plan updated successfully', plan };
  }

  /**
   * Toggle archive status for a plan
   */
  @Patch('plans/:id/archive')
  @HttpCode(HttpStatus.OK)
  async archivePlan(@Param('id') id: string) {
    const plan = await this.adminService.archivePlan(id);
    return { message: `Plan ${plan.status === 'archived' ? 'archived' : 'restored'} successfully`, plan };
  }

  // ==================== IMPERSONATION ====================

  /**
   * Start impersonating a user (login as them for troubleshooting)
   */
  @Post('users/:id/impersonate')
  @HttpCode(HttpStatus.OK)
  async startImpersonation(
    @Param('id') targetUserId: string,
    @Session() session: UserSession,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const sessionId = session.session?.id || (req as any).session?.id;
    if (!sessionId) {
      throw new NotFoundException('Could not determine current session ID');
    }

    const result = await this.adminService.startImpersonation(
      session.user.id,
      sessionId,
      targetUserId,
      {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    );

    // Store admin's original session token in a separate cookie
    const currentSessionToken = req.cookies?.['better-auth.session_token']
      || req.cookies?.['__Secure-better-auth.session_token']
      || '';

    const isProduction = process.env.NODE_ENV === 'production';
    const cookieName = isProduction
      ? '__Secure-better-auth.session_token'
      : 'better-auth.session_token';

    // Save admin's original session token
    res.cookie('admin_session_token', currentSessionToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 1000, // 1 hour
    });

    // Set the impersonated user's session token as the auth cookie
    res.cookie(cookieName, result.sessionToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 1000, // 1 hour
    });

    this.logger.log(
      `Admin ${session.user.email} started impersonating user ${result.targetUser.email}`,
    );

    return { success: true, targetUser: result.targetUser };
  }

  /**
   * Stop impersonating and restore admin session.
   * Uses AllowAnonymous because during impersonation the current session
   * belongs to the target user (not super_admin). Auth is validated
   * via the admin_session_token cookie instead.
   */
  @Post('impersonate/stop')
  @AllowAnonymous()
  @HttpCode(HttpStatus.OK)
  async stopImpersonation(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const adminSessionToken = req.cookies?.['admin_session_token'];

    if (!adminSessionToken) {
      throw new NotFoundException('No impersonation session found');
    }

    await this.adminService.stopImpersonation(adminSessionToken);

    const isProduction = process.env.NODE_ENV === 'production';
    const cookieName = isProduction
      ? '__Secure-better-auth.session_token'
      : 'better-auth.session_token';

    // Restore admin's original session cookie
    res.cookie(cookieName, adminSessionToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 12 * 1000, // 12 hours (matching session config)
    });

    // Clear the admin_session_token cookie
    res.clearCookie('admin_session_token', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
    });

    this.logger.log('Admin stopped impersonation session');

    return { success: true };
  }
}
