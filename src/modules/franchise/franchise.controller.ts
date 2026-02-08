import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  NotFoundException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Session } from '@thallesp/nestjs-better-auth';
import type { Prisma } from '@prisma/client';
import { FranchiseService } from './franchise.service';
import {
  CreateFranchiseDto,
  UpdateFranchiseDto,
  AddBusinessToFranchiseDto,
  InviteFranchiseUserDto,
  UpdateFranchiseUserDto,
} from './dto';
import { Sanitize } from 'src/lib/common';

interface UserSession {
  user: {
    id: string;
    email: string;
    name?: string;
    role?: string;
  };
}

@Controller('franchise')
@UsePipes(new ValidationPipe({ transform: true }))
@Sanitize()
export class FranchiseController {
  constructor(private franchiseService: FranchiseService) {}

  @Post()
  async create(
    @Body() dto: CreateFranchiseDto,
    @Session() session: UserSession,
  ) {
    const franchise = await this.franchiseService.create(dto, session.user.id);
    return { message: 'Franchise created successfully', franchise };
  }

  @Get()
  async listUserFranchises(@Session() session: UserSession) {
    const franchises = await this.franchiseService.getUserFranchises(
      session.user.id,
    );
    return { franchises };
  }

  @Get(':id')
  async getById(@Param('id') id: string, @Session() session: UserSession) {
    const franchise = await this.franchiseService.findByIdOrFail(id);
    const role = await this.franchiseService.getUserRole(session.user.id, id);
    return { franchise, userRole: role };
  }

  @Get('slug/:slug')
  async getBySlug(
    @Param('slug') slug: string,
    @Session() session: UserSession,
  ) {
    const franchise = await this.franchiseService.findBySlug(slug);
    if (!franchise) {
      throw new NotFoundException('Franchise not found');
    }
    const role = await this.franchiseService.getUserRole(
      session.user.id,
      franchise.id,
    );
    return { franchise, userRole: role };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateFranchiseDto,
    @Session() session: UserSession,
  ) {
    const franchise = await this.franchiseService.update(
      id,
      dto,
      session.user.id,
    );
    return { message: 'Franchise updated successfully', franchise };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async delete(@Param('id') id: string, @Session() session: UserSession) {
    await this.franchiseService.delete(id, session.user.id);
    return { message: 'Franchise deleted successfully' };
  }

  // ==================== Business Management ====================

  @Get(':id/businesses')
  async getBusinesses(@Param('id') id: string) {
    const businesses = await this.franchiseService.getBusinesses(id);
    return { businesses };
  }

  @Post(':id/businesses')
  async addBusiness(
    @Param('id') id: string,
    @Body() dto: AddBusinessToFranchiseDto,
    @Session() session: UserSession,
  ) {
    const business = await this.franchiseService.addBusiness(
      id,
      dto,
      session.user.id,
    );
    return { message: 'Business added to franchise', business };
  }

  @Post(':id/businesses/create')
  async createBusiness(
    @Param('id') id: string,
    @Body()
    dto: {
      name: string;
      type: string;
      description?: string;
      address: Prisma.InputJsonValue;
      contact: Prisma.InputJsonValue;
      settings: Prisma.InputJsonValue;
    },
    @Session() session: UserSession,
  ) {
    const business = await this.franchiseService.createBusiness(
      id,
      dto,
      session.user.id,
    );
    return { message: 'Business created under franchise', business };
  }

  @Delete(':id/businesses/:businessId')
  @HttpCode(HttpStatus.OK)
  async removeBusiness(
    @Param('id') id: string,
    @Param('businessId') businessId: string,
    @Session() session: UserSession,
  ) {
    await this.franchiseService.removeBusiness(id, businessId, session.user.id);
    return { message: 'Business removed from franchise' };
  }

  // ==================== Staff Management ====================

  @Get(':id/staff')
  async getStaff(@Param('id') id: string) {
    const staff = await this.franchiseService.getStaff(id);
    return { staff };
  }

  @Post(':id/staff')
  async inviteStaff(
    @Param('id') id: string,
    @Body() dto: InviteFranchiseUserDto,
    @Session() session: UserSession,
  ) {
    const member = await this.franchiseService.inviteStaff(
      id,
      dto,
      session.user.id,
    );
    return { message: 'Staff member invited', member };
  }

  @Patch(':id/staff/:userId')
  async updateStaff(
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateFranchiseUserDto,
    @Session() session: UserSession,
  ) {
    const member = await this.franchiseService.updateStaff(
      id,
      targetUserId,
      dto,
      session.user.id,
    );
    return { message: 'Staff member updated', member };
  }

  @Delete(':id/staff/:userId')
  @HttpCode(HttpStatus.OK)
  async removeStaff(
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @Session() session: UserSession,
  ) {
    await this.franchiseService.removeStaff(id, targetUserId, session.user.id);
    return { message: 'Staff member removed' };
  }

  // ==================== Analytics ====================

  @Get(':id/analytics')
  async getAnalytics(
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const dateRange =
      startDate && endDate
        ? { start: new Date(startDate), end: new Date(endDate) }
        : undefined;

    const analytics = await this.franchiseService.getAggregatedAnalytics(
      id,
      dateRange,
    );
    return { analytics };
  }

  @Get(':id/analytics/compare')
  async getLocationComparison(
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const dateRange =
      startDate && endDate
        ? { start: new Date(startDate), end: new Date(endDate) }
        : undefined;

    const comparison = await this.franchiseService.getLocationComparison(
      id,
      dateRange,
    );
    return { comparison };
  }

  // ==================== Settings ====================

  @Patch(':id/settings')
  async updateSettings(
    @Param('id') id: string,
    @Body() settings: Record<string, unknown>,
    @Session() session: UserSession,
  ) {
    const franchise = await this.franchiseService.updateSettings(
      id,
      settings,
      session.user.id,
    );
    return { message: 'Settings updated', franchise };
  }

  @Patch(':id/menu-template')
  async updateMenuTemplate(
    @Param('id') id: string,
    @Body() template: Record<string, unknown>,
    @Session() session: UserSession,
  ) {
    const franchise = await this.franchiseService.updateMenuTemplate(
      id,
      template,
      session.user.id,
    );
    return { message: 'Menu template updated', franchise };
  }

  @Post(':id/sync-settings')
  async syncSettings(@Param('id') id: string, @Session() session: UserSession) {
    const result = await this.franchiseService.syncSettingsToLocations(
      id,
      session.user.id,
    );
    return {
      message: `Settings synced to ${result.synced} locations`,
      ...result,
    };
  }
}
