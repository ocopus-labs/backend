import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  Query,
  Res,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Response } from 'express';
import { Session } from '@thallesp/nestjs-better-auth';
import { TaxService } from './tax.service';
import { TaxExportService } from './tax-export.service';
import { UpdateTaxSettingsDto, ValidateRegistrationDto } from './dto';
import { BusinessRoles } from 'src/lib/common';
import { USER_ROLES } from 'src/lib/auth/roles.constants';
import type { TaxRegime } from './interfaces';

interface UserSession {
  user: {
    id: string;
    email: string;
    name?: string;
    role?: string;
  };
}

@Controller('business/:businessId/tax')
@UsePipes(new ValidationPipe({ transform: true }))
export class TaxController {
  constructor(
    private readonly taxService: TaxService,
    private readonly taxExportService: TaxExportService,
  ) {}

  @Get('settings')
  @BusinessRoles(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.FRANCHISE_OWNER,
    USER_ROLES.RESTAURANT_OWNER,
    USER_ROLES.MANAGER,
  )
  async getSettings(@Param('businessId') businessId: string) {
    const settings = await this.taxService.getSettings(businessId);
    return { settings };
  }

  @Put('settings')
  @BusinessRoles(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.FRANCHISE_OWNER,
    USER_ROLES.RESTAURANT_OWNER,
    USER_ROLES.MANAGER,
  )
  async updateSettings(
    @Param('businessId') businessId: string,
    @Body() dto: UpdateTaxSettingsDto,
    @Session() session: UserSession,
  ) {
    const settings = await this.taxService.updateSettings(
      businessId,
      dto as Partial<import('./interfaces').TaxSettings>,
      session.user.id,
    );
    return { settings };
  }

  @Post('validate')
  @BusinessRoles(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.FRANCHISE_OWNER,
    USER_ROLES.RESTAURANT_OWNER,
    USER_ROLES.MANAGER,
  )
  async validateRegistration(@Body() dto: ValidateRegistrationDto) {
    const result = await this.taxService.validateRegistration(
      dto.regime,
      dto.registrationNumber,
    );
    return result;
  }

  @Get('regimes')
  @BusinessRoles(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.FRANCHISE_OWNER,
    USER_ROLES.RESTAURANT_OWNER,
    USER_ROLES.MANAGER,
  )
  async getRegimes() {
    const regimes = this.taxService.getRegimes();
    return { regimes };
  }

  @Get('export')
  @BusinessRoles(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.FRANCHISE_OWNER,
    USER_ROLES.RESTAURANT_OWNER,
    USER_ROLES.MANAGER,
  )
  async exportReport(
    @Param('businessId') businessId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('format') format: 'json' | 'csv' = 'json',
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.taxExportService.exportTaxReport(
      businessId,
      from,
      to,
      format,
    );

    if (format === 'csv' && result.csv) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="tax-report-${from}-to-${to}.csv"`,
      );
      return result.csv;
    }

    return { report: result.data };
  }
}
