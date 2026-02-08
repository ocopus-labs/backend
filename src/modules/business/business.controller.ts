import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Logger,
  UsePipes,
  ValidationPipe,
  ForbiddenException,
  UseGuards,
} from '@nestjs/common';
import { Session, Roles } from '@thallesp/nestjs-better-auth';
import { BusinessService } from './business.service';
import {
  CreateBusinessDto,
  UpdateBusinessDto,
  UpdateBusinessSettingsDto,
  UpdateBusinessLogoDto,
} from './dto';
import { USER_ROLES } from 'src/lib/auth/roles.constants';
import { Sanitize } from 'src/lib/common';
import {
  BUSINESS_TYPES,
  BUSINESS_TYPE_CONFIG,
} from './config/business-types.config';

interface UserSession {
  user: {
    id: string;
    email: string;
    name?: string;
    role?: string;
  };
}

@Controller('business')
@UsePipes(new ValidationPipe({ transform: true }))
@Sanitize()
export class BusinessController {
  private readonly logger = new Logger(BusinessController.name);

  constructor(private businessService: BusinessService) {}

  /**
   * Create a new business
   */
  @Post()
  async create(
    @Body() dto: CreateBusinessDto,
    @Session() session: UserSession,
  ) {
    const business = await this.businessService.create(dto, session.user.id);
    return {
      message: 'Business created successfully',
      business,
    };
  }

  /**
   * List all businesses the current user has access to
   */
  @Get()
  async listUserBusinesses(@Session() session: UserSession) {
    const businesses = await this.businessService.getUserBusinesses(
      session.user.id,
    );
    return { businesses };
  }

  /**
   * Get business types configuration
   */
  @Get('types')
  getBusinessTypes() {
    return {
      types: Object.entries(BUSINESS_TYPE_CONFIG).map(([key, config]) => ({
        value: key,
        ...config,
      })),
    };
  }

  /**
   * Get business by ID
   */
  @Get(':id')
  async getById(@Param('id') id: string, @Session() session: UserSession) {
    const hasAccess = await this.businessService.checkUserAccess(
      session.user.id,
      id,
    );
    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this business');
    }

    const business = await this.businessService.findByIdOrFail(id);
    const role = await this.businessService.getUserRole(session.user.id, id);

    return {
      business,
      userRole: role,
    };
  }

  /**
   * Get business by slug
   */
  @Get('slug/:slug')
  async getBySlug(
    @Param('slug') slug: string,
    @Session() session: UserSession,
  ) {
    const business = await this.businessService.findBySlug(slug);
    if (!business) {
      throw new ForbiddenException('Business not found');
    }

    const hasAccess = await this.businessService.checkUserAccess(
      session.user.id,
      business.id,
    );
    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this business');
    }

    const role = await this.businessService.getUserRole(
      session.user.id,
      business.id,
    );

    return {
      business,
      userRole: role,
    };
  }

  /**
   * Update business
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBusinessDto,
    @Session() session: UserSession,
  ) {
    await this.validateBusinessAccess(session.user.id, id, [
      USER_ROLES.RESTAURANT_OWNER,
      USER_ROLES.FRANCHISE_OWNER,
      USER_ROLES.SUPER_ADMIN,
    ]);

    const business = await this.businessService.update(
      id,
      dto,
      session.user.id,
    );
    return {
      message: 'Business updated successfully',
      business,
    };
  }

  /**
   * Update business settings
   */
  @Patch(':id/settings')
  async updateSettings(
    @Param('id') id: string,
    @Body() dto: UpdateBusinessSettingsDto,
    @Session() session: UserSession,
  ) {
    await this.validateBusinessAccess(session.user.id, id, [
      USER_ROLES.RESTAURANT_OWNER,
      USER_ROLES.FRANCHISE_OWNER,
      USER_ROLES.MANAGER,
    ]);

    const business = await this.businessService.updateSettings(
      id,
      dto,
      session.user.id,
    );
    return {
      message: 'Settings updated successfully',
      business,
    };
  }

  /**
   * Update business logo
   */
  @Patch(':id/logo')
  async updateLogo(
    @Param('id') id: string,
    @Body() dto: UpdateBusinessLogoDto,
    @Session() session: UserSession,
  ) {
    await this.validateBusinessAccess(session.user.id, id, [
      USER_ROLES.RESTAURANT_OWNER,
      USER_ROLES.FRANCHISE_OWNER,
    ]);

    const business = await this.businessService.updateLogo(
      id,
      dto.logo,
      session.user.id,
    );
    return {
      message: 'Logo updated successfully',
      business,
    };
  }

  /**
   * Delete business (soft delete)
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async delete(@Param('id') id: string, @Session() session: UserSession) {
    await this.validateBusinessAccess(session.user.id, id, [
      USER_ROLES.RESTAURANT_OWNER,
      USER_ROLES.FRANCHISE_OWNER,
      USER_ROLES.SUPER_ADMIN,
    ]);

    await this.businessService.delete(id, session.user.id);
    return {
      message: 'Business deleted successfully',
    };
  }

  /**
   * Helper to validate business access with role check
   */
  private async validateBusinessAccess(
    userId: string,
    businessId: string,
    allowedRoles: string[],
  ): Promise<void> {
    const hasAccess = await this.businessService.checkUserAccess(
      userId,
      businessId,
    );
    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this business');
    }

    const role = await this.businessService.getUserRole(userId, businessId);
    if (!role || !allowedRoles.includes(role)) {
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );
    }
  }
}
