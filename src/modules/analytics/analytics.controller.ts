import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Logger,
  UsePipes,
  ValidationPipe,
  ForbiddenException,
} from '@nestjs/common';
import { Session } from '@thallesp/nestjs-better-auth';
import { AnalyticsService } from './analytics.service';
import { BusinessService } from 'src/modules/business';
import { GetAnalyticsDto, GenerateDailyReportDto } from './dto';
import { USER_ROLES } from 'src/lib/auth/roles.constants';
import { ReportPeriod } from './interfaces';

interface UserSession {
  user: {
    id: string;
    email: string;
    name?: string;
    role?: string;
  };
}

@Controller('business/:businessId/analytics')
@UsePipes(new ValidationPipe({ transform: true }))
export class AnalyticsController {
  private readonly logger = new Logger(AnalyticsController.name);

  constructor(
    private analyticsService: AnalyticsService,
    private businessService: BusinessService,
  ) {}

  /**
   * Get dashboard statistics
   */
  @Get('dashboard')
  async getDashboardStats(
    @Param('businessId') businessId: string,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId);

    const stats = await this.analyticsService.getDashboardStats(businessId);
    return { stats };
  }

  /**
   * Get sales summary
   */
  @Get('sales')
  async getSalesSummary(
    @Param('businessId') businessId: string,
    @Query('period') period: ReportPeriod | undefined,
    @Query('startDate') startDateStr: string | undefined,
    @Query('endDate') endDateStr: string | undefined,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId);

    const { startDate, endDate } = this.getDateRange(period, startDateStr, endDateStr);
    const summary = await this.analyticsService.getSalesSummary(businessId, startDate, endDate);

    return { summary, period: { startDate, endDate } };
  }

  /**
   * Get payment method breakdown
   */
  @Get('payments')
  async getPaymentBreakdown(
    @Param('businessId') businessId: string,
    @Query('period') period: ReportPeriod | undefined,
    @Query('startDate') startDateStr: string | undefined,
    @Query('endDate') endDateStr: string | undefined,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId);

    const { startDate, endDate } = this.getDateRange(period, startDateStr, endDateStr);
    const breakdown = await this.analyticsService.getPaymentMethodBreakdown(
      businessId,
      startDate,
      endDate,
    );

    return { breakdown, period: { startDate, endDate } };
  }

  /**
   * Get top selling items
   */
  @Get('top-items')
  async getTopItems(
    @Param('businessId') businessId: string,
    @Query('period') period: ReportPeriod | undefined,
    @Query('startDate') startDateStr: string | undefined,
    @Query('endDate') endDateStr: string | undefined,
    @Query('limit') limit: string | undefined,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId);

    const { startDate, endDate } = this.getDateRange(period, startDateStr, endDateStr);
    const items = await this.analyticsService.getTopSellingItems(
      businessId,
      startDate,
      endDate,
      limit ? parseInt(limit, 10) : 10,
    );

    return { items, period: { startDate, endDate } };
  }

  /**
   * Get hourly breakdown for a specific date
   */
  @Get('hourly')
  async getHourlyBreakdown(
    @Param('businessId') businessId: string,
    @Query('date') dateStr: string | undefined,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId);

    const date = dateStr ? new Date(dateStr) : new Date();
    const breakdown = await this.analyticsService.getHourlyBreakdown(businessId, date);

    return { breakdown, date };
  }

  /**
   * Get staff performance
   */
  @Get('staff')
  async getStaffPerformance(
    @Param('businessId') businessId: string,
    @Query('period') period: ReportPeriod | undefined,
    @Query('startDate') startDateStr: string | undefined,
    @Query('endDate') endDateStr: string | undefined,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId, [
      USER_ROLES.RESTAURANT_OWNER,
      USER_ROLES.FRANCHISE_OWNER,
      USER_ROLES.MANAGER,
    ]);

    const { startDate, endDate } = this.getDateRange(period, startDateStr, endDateStr);
    const performance = await this.analyticsService.getStaffPerformance(
      businessId,
      startDate,
      endDate,
    );

    return { performance, period: { startDate, endDate } };
  }

  /**
   * Get full report for a date range
   */
  @Get('report')
  async getReport(
    @Param('businessId') businessId: string,
    @Query('period') period: ReportPeriod | undefined,
    @Query('startDate') startDateStr: string | undefined,
    @Query('endDate') endDateStr: string | undefined,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId, [
      USER_ROLES.RESTAURANT_OWNER,
      USER_ROLES.FRANCHISE_OWNER,
      USER_ROLES.MANAGER,
    ]);

    const { startDate, endDate } = this.getDateRange(period, startDateStr, endDateStr);
    const report = await this.analyticsService.getDateRangeReport(
      businessId,
      startDate,
      endDate,
    );

    return { report };
  }

  /**
   * Get stored daily analytics
   */
  @Get('daily/:date')
  async getDailyAnalytics(
    @Param('businessId') businessId: string,
    @Param('date') dateStr: string,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId);

    const date = new Date(dateStr);
    const analytics = await this.analyticsService.getDailyAnalytics(businessId, date);

    if (!analytics) {
      // Generate if not exists
      const generated = await this.analyticsService.generateDailyAnalytics(businessId, date);
      return { analytics: generated };
    }

    return { analytics };
  }

  /**
   * Generate/regenerate daily analytics
   */
  @Post('daily/generate')
  async generateDailyAnalytics(
    @Param('businessId') businessId: string,
    @Body() dto: GenerateDailyReportDto,
    @Session() session: UserSession,
  ) {
    await this.validateAccess(session.user.id, businessId, [
      USER_ROLES.RESTAURANT_OWNER,
      USER_ROLES.FRANCHISE_OWNER,
      USER_ROLES.MANAGER,
    ]);

    const analytics = await this.analyticsService.generateDailyAnalytics(
      businessId,
      dto.date,
    );

    return {
      message: 'Daily analytics generated successfully',
      analytics,
    };
  }

  /**
   * Helper to get date range
   */
  private getDateRange(
    period?: ReportPeriod,
    startDateStr?: string,
    endDateStr?: string,
  ): { startDate: Date; endDate: Date } {
    if (startDateStr && endDateStr) {
      return {
        startDate: new Date(startDateStr),
        endDate: new Date(endDateStr),
      };
    }

    return this.analyticsService.getDateRangeFromPeriod(period || 'today');
  }

  /**
   * Helper to validate business access
   */
  private async validateAccess(
    userId: string,
    businessId: string,
    allowedRoles?: string[],
  ): Promise<void> {
    const hasAccess = await this.businessService.checkUserAccess(userId, businessId);
    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this business');
    }

    if (allowedRoles) {
      const role = await this.businessService.getUserRole(userId, businessId);
      if (!role || !allowedRoles.includes(role)) {
        throw new ForbiddenException('You do not have permission to perform this action');
      }
    }
  }
}
