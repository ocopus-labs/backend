import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Session } from '@thallesp/nestjs-better-auth';
import { QrService } from './qr.service';
import { UpdateUpiSettingsDto, GeneratePaymentQrDto } from './dto';
import { BusinessRoles } from 'src/lib/common';
import { USER_ROLES } from 'src/lib/auth/roles.constants';

interface UserSession {
  user: {
    id: string;
    email: string;
    name?: string;
    role?: string;
  };
}

@Controller('business/:businessId/qr')
@UsePipes(new ValidationPipe({ transform: true }))
export class QrController {
  constructor(
    private readonly qrService: QrService,
    private readonly configService: ConfigService,
  ) {}

  @Get('settings')
  @BusinessRoles(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.FRANCHISE_OWNER,
    USER_ROLES.RESTAURANT_OWNER,
    USER_ROLES.MANAGER,
  )
  async getSettings(@Param('businessId') businessId: string) {
    const settings = await this.qrService.getUpiSettings(businessId);
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
    @Body() dto: UpdateUpiSettingsDto,
    @Session() session: UserSession,
  ) {
    const settings = await this.qrService.updateUpiSettings(
      businessId,
      dto,
      session.user.id,
    );
    return { settings };
  }

  @Post('payment')
  @BusinessRoles(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.FRANCHISE_OWNER,
    USER_ROLES.RESTAURANT_OWNER,
    USER_ROLES.MANAGER,
    USER_ROLES.STAFF,
  )
  async generatePaymentQr(
    @Param('businessId') businessId: string,
    @Body() dto: GeneratePaymentQrDto,
  ) {
    const result = await this.qrService.generatePaymentQr(
      businessId,
      dto.amount,
      dto.transactionNote,
    );
    return result;
  }

  @Post('table/:tableId')
  @BusinessRoles(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.FRANCHISE_OWNER,
    USER_ROLES.RESTAURANT_OWNER,
    USER_ROLES.MANAGER,
  )
  async generateTableQr(
    @Param('businessId') businessId: string,
    @Param('tableId') tableId: string,
  ) {
    const baseUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    const result = await this.qrService.generateTableQr(
      businessId,
      tableId,
      baseUrl,
    );
    return result;
  }

  @Post('tables/all')
  @BusinessRoles(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.FRANCHISE_OWNER,
    USER_ROLES.RESTAURANT_OWNER,
    USER_ROLES.MANAGER,
  )
  async generateAllTableQrs(@Param('businessId') businessId: string) {
    const baseUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    const result = await this.qrService.generateAllTableQrs(
      businessId,
      baseUrl,
    );
    return result;
  }

  @Get('table/:tableId')
  async getTableQr(
    @Param('businessId') businessId: string,
    @Param('tableId') tableId: string,
  ) {
    return this.qrService.getTableQr(businessId, tableId);
  }
}
