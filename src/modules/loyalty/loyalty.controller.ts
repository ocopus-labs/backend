import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Session } from '@thallesp/nestjs-better-auth';
import { LoyaltyService } from './loyalty.service';
import { UpdateLoyaltySettingsDto, RedeemPointsDto, AdjustPointsDto } from './dto';
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

@Controller('business/:businessId/loyalty')
@UsePipes(new ValidationPipe({ transform: true }))
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @Get('settings')
  @BusinessRoles(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.FRANCHISE_OWNER,
    USER_ROLES.RESTAURANT_OWNER,
    USER_ROLES.MANAGER,
  )
  async getSettings(@Param('businessId') businessId: string) {
    const settings = await this.loyaltyService.getSettings(businessId);
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
    @Body() dto: UpdateLoyaltySettingsDto,
    @Session() session: UserSession,
  ) {
    const settings = await this.loyaltyService.updateSettings(
      businessId,
      dto,
      session.user.id,
    );
    return { settings };
  }

  @Get('customers/:customerId')
  async getAccount(
    @Param('businessId') businessId: string,
    @Param('customerId') customerId: string,
  ) {
    const account = await this.loyaltyService.getAccount(
      businessId,
      customerId,
    );
    return { account };
  }

  @Get('customers/:customerId/transactions')
  async getTransactions(
    @Param('businessId') businessId: string,
    @Param('customerId') customerId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const result = await this.loyaltyService.getAccountWithTransactions(
      businessId,
      customerId,
      {
        limit: limit ? parseInt(limit, 10) : undefined,
        offset: offset ? parseInt(offset, 10) : undefined,
      },
    );
    return {
      account: result.account,
      transactions: result.transactions,
      total: result.total,
    };
  }

  @Post('customers/:customerId/redeem')
  @BusinessRoles(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.FRANCHISE_OWNER,
    USER_ROLES.RESTAURANT_OWNER,
    USER_ROLES.MANAGER,
    USER_ROLES.STAFF,
  )
  async redeemPoints(
    @Param('businessId') businessId: string,
    @Param('customerId') customerId: string,
    @Body() dto: RedeemPointsDto,
  ) {
    return this.loyaltyService.redeemPoints(
      businessId,
      customerId,
      dto.points,
    );
  }

  @Post('customers/:customerId/adjust')
  @BusinessRoles(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.FRANCHISE_OWNER,
    USER_ROLES.RESTAURANT_OWNER,
    USER_ROLES.MANAGER,
  )
  async adjustPoints(
    @Param('businessId') businessId: string,
    @Param('customerId') customerId: string,
    @Body() dto: AdjustPointsDto,
    @Session() session: UserSession,
  ) {
    const account = await this.loyaltyService.adjustPoints(
      businessId,
      customerId,
      dto.points,
      dto.reason,
      session.user.id,
    );
    return { account };
  }

  @Get('leaderboard')
  @BusinessRoles(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.FRANCHISE_OWNER,
    USER_ROLES.RESTAURANT_OWNER,
    USER_ROLES.MANAGER,
  )
  async getLeaderboard(
    @Param('businessId') businessId: string,
    @Query('limit') limit?: string,
  ) {
    const leaderboard = await this.loyaltyService.getLeaderboard(
      businessId,
      limit ? parseInt(limit, 10) : undefined,
    );
    return { leaderboard };
  }
}
