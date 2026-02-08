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
} from '@nestjs/common';
import { Session } from '@thallesp/nestjs-better-auth';
import { AnalyticsService } from './analytics.service';
import { GenerateDailyReportDto } from './dto';
import { BusinessRoles, HttpCacheTTL } from 'src/lib/common';
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

  constructor(private analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @HttpCacheTTL(30) // Dashboard stats cache 30s
  async getDashboardStats(
    @Param('businessId') businessId: string,
    @Session() session: UserSession,
  ) {
    const stats = await this.analyticsService.getDashboardStats(businessId);
    return { stats };
  }

  @Get('sales')
  async getSalesSummary(
    @Param('businessId') businessId: string,
    @Query('period') period: ReportPeriod | undefined,
    @Query('startDate') startDateStr: string | undefined,
    @Query('endDate') endDateStr: string | undefined,
    @Session() session: UserSession,
  ) {
    const { startDate, endDate } = this.getDateRange(period, startDateStr, endDateStr);
    const summary = await this.analyticsService.getSalesSummary(businessId, startDate, endDate);

    return { summary, period: { startDate, endDate } };
  }

  @Get('payments')
  async getPaymentBreakdown(
    @Param('businessId') businessId: string,
    @Query('period') period: ReportPeriod | undefined,
    @Query('startDate') startDateStr: string | undefined,
    @Query('endDate') endDateStr: string | undefined,
    @Session() session: UserSession,
  ) {
    const { startDate, endDate } = this.getDateRange(period, startDateStr, endDateStr);
    const breakdown = await this.analyticsService.getPaymentMethodBreakdown(
      businessId,
      startDate,
      endDate,
    );

    return { breakdown, period: { startDate, endDate } };
  }

  @Get('top-items')
  async getTopItems(
    @Param('businessId') businessId: string,
    @Query('period') period: ReportPeriod | undefined,
    @Query('startDate') startDateStr: string | undefined,
    @Query('endDate') endDateStr: string | undefined,
    @Query('limit') limit: string | undefined,
    @Session() session: UserSession,
  ) {
    const { startDate, endDate } = this.getDateRange(period, startDateStr, endDateStr);
    const items = await this.analyticsService.getTopSellingItems(
      businessId,
      startDate,
      endDate,
      limit ? parseInt(limit, 10) : 10,
    );

    return { items, period: { startDate, endDate } };
  }

  @Get('hourly')
  async getHourlyBreakdown(
    @Param('businessId') businessId: string,
    @Query('date') dateStr: string | undefined,
    @Session() session: UserSession,
  ) {
    const date = dateStr ? new Date(dateStr) : new Date();
    const breakdown = await this.analyticsService.getHourlyBreakdown(businessId, date);

    return { breakdown, date };
  }

  @Get('staff')
  @BusinessRoles(USER_ROLES.RESTAURANT_OWNER, USER_ROLES.FRANCHISE_OWNER, USER_ROLES.MANAGER)
  async getStaffPerformance(
    @Param('businessId') businessId: string,
    @Query('period') period: ReportPeriod | undefined,
    @Query('startDate') startDateStr: string | undefined,
    @Query('endDate') endDateStr: string | undefined,
    @Session() session: UserSession,
  ) {
    const { startDate, endDate } = this.getDateRange(period, startDateStr, endDateStr);
    const performance = await this.analyticsService.getStaffPerformance(
      businessId,
      startDate,
      endDate,
    );

    return { performance, period: { startDate, endDate } };
  }

  @Get('report')
  @BusinessRoles(USER_ROLES.RESTAURANT_OWNER, USER_ROLES.FRANCHISE_OWNER, USER_ROLES.MANAGER)
  async getReport(
    @Param('businessId') businessId: string,
    @Query('period') period: ReportPeriod | undefined,
    @Query('startDate') startDateStr: string | undefined,
    @Query('endDate') endDateStr: string | undefined,
    @Session() session: UserSession,
  ) {
    const { startDate, endDate } = this.getDateRange(period, startDateStr, endDateStr);
    const report = await this.analyticsService.getDateRangeReport(
      businessId,
      startDate,
      endDate,
    );

    return { report };
  }

  @Get('daily/:date')
  @HttpCacheTTL(600) // Daily analytics are pre-computed, cache 10 min
  async getDailyAnalytics(
    @Param('businessId') businessId: string,
    @Param('date') dateStr: string,
    @Session() session: UserSession,
  ) {
    const date = new Date(dateStr);
    const analytics = await this.analyticsService.getDailyAnalytics(businessId, date);

    if (!analytics) {
      const generated = await this.analyticsService.generateDailyAnalytics(businessId, date);
      return { analytics: generated };
    }

    return { analytics };
  }

  @Post('daily/generate')
  @BusinessRoles(USER_ROLES.RESTAURANT_OWNER, USER_ROLES.FRANCHISE_OWNER, USER_ROLES.MANAGER)
  async generateDailyAnalytics(
    @Param('businessId') businessId: string,
    @Body() dto: GenerateDailyReportDto,
    @Session() session: UserSession,
  ) {
    const analytics = await this.analyticsService.generateDailyAnalytics(
      businessId,
      dto.date,
    );

    return {
      message: 'Daily analytics generated successfully',
      analytics,
    };
  }

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
}
