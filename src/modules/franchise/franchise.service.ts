import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import type { Prisma } from '@prisma/client';
import {
  CreateFranchiseDto,
  UpdateFranchiseDto,
  AddBusinessToFranchiseDto,
  InviteFranchiseUserDto,
  UpdateFranchiseUserDto,
} from './dto';
import { USER_ROLES, getRolePermissions } from 'src/lib/auth/roles.constants';

@Injectable()
export class FranchiseService {
  private readonly logger = new Logger(FranchiseService.name);

  constructor(private prisma: PrismaService) {}

  async create(dto: CreateFranchiseDto, ownerId: string) {
    const slug = await this.generateSlug(dto.name);

    const franchise = await this.prisma.$transaction(async (tx) => {
      const f = await tx.franchise.create({
        data: {
          name: dto.name,
          slug,
          ownerId,
          description: dto.description,
          logo: dto.logo,
          settings: (dto.settings || {}) as Prisma.InputJsonValue,
          branding: dto.branding as Prisma.InputJsonValue | undefined,
        },
      });

      // Create FranchiseUser for the owner
      await tx.franchiseUser.create({
        data: {
          franchiseId: f.id,
          userId: ownerId,
          role: USER_ROLES.FRANCHISE_OWNER,
          status: 'active',
          permissions: getRolePermissions(USER_ROLES.FRANCHISE_OWNER),
        },
      });

      return f;
    });

    this.logger.log(
      `Franchise created: ${franchise.name} (${franchise.id}) by user ${ownerId}`,
    );
    return franchise;
  }

  async findById(id: string) {
    return this.prisma.franchise.findUnique({
      where: { id },
      include: {
        _count: { select: { businesses: true, staff: true } },
      },
    });
  }

  async findByIdOrFail(id: string) {
    const franchise = await this.findById(id);
    if (!franchise) {
      throw new NotFoundException(`Franchise with ID ${id} not found`);
    }
    return franchise;
  }

  async findBySlug(slug: string) {
    return this.prisma.franchise.findUnique({
      where: { slug },
      include: {
        _count: { select: { businesses: true, staff: true } },
      },
    });
  }

  async getUserFranchises(userId: string) {
    const franchiseUsers = await this.prisma.franchiseUser.findMany({
      where: { userId, status: 'active' },
      include: {
        franchise: {
          include: {
            _count: { select: { businesses: true, staff: true } },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    return franchiseUsers.map((fu) => ({
      ...fu.franchise,
      userRole: fu.role,
    }));
  }

  async update(id: string, dto: UpdateFranchiseDto, userId: string) {
    await this.validateFranchiseAccess(userId, id, ['franchise_owner']);

    const updateData: Prisma.FranchiseUpdateInput = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.logo !== undefined) updateData.logo = dto.logo;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.settings !== undefined) updateData.settings = dto.settings as Prisma.InputJsonValue;
    if (dto.branding !== undefined) updateData.branding = dto.branding as Prisma.InputJsonValue;

    const franchise = await this.prisma.franchise.update({
      where: { id },
      data: updateData,
      include: {
        _count: { select: { businesses: true, staff: true } },
      },
    });

    this.logger.log(
      `Franchise updated: ${franchise.name} (${franchise.id}) by user ${userId}`,
    );
    return franchise;
  }

  async delete(id: string, userId: string) {
    await this.validateFranchiseAccess(userId, id, ['franchise_owner']);

    await this.prisma.franchise.update({
      where: { id },
      data: { status: 'deleted' },
    });

    this.logger.log(`Franchise ${id} soft-deleted by user ${userId}`);
  }

  // ==================== Business Management ====================

  async addBusiness(
    franchiseId: string,
    dto: AddBusinessToFranchiseDto,
    userId: string,
  ) {
    await this.validateFranchiseAccess(userId, franchiseId, [
      'franchise_owner',
    ]);

    const business = await this.prisma.restaurant.findUnique({
      where: { id: dto.businessId },
    });

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    if (business.franchiseId) {
      throw new ConflictException('Business is already part of a franchise');
    }

    // Verify the user owns the business
    if (business.ownerId !== userId) {
      throw new ForbiddenException(
        'You can only add businesses you own to a franchise',
      );
    }

    const updated = await this.prisma.restaurant.update({
      where: { id: dto.businessId },
      data: {
        franchiseId,
        configSource: dto.configSource || 'hybrid',
      },
    });

    this.logger.log(
      `Business ${dto.businessId} added to franchise ${franchiseId}`,
    );
    return updated;
  }

  async createBusiness(
    franchiseId: string,
    businessData: {
      name: string;
      type: string;
      description?: string;
      address: Prisma.InputJsonValue;
      contact: Prisma.InputJsonValue;
      settings: Prisma.InputJsonValue;
    },
    userId: string,
  ) {
    await this.validateFranchiseAccess(userId, franchiseId, [
      'franchise_owner',
    ]);

    const slug = await this.generateBusinessSlug(businessData.name);

    const business = await this.prisma.$transaction(async (tx) => {
      const biz = await tx.restaurant.create({
        data: {
          name: businessData.name,
          slug,
          type: businessData.type,
          description: businessData.description,
          ownerId: userId,
          franchiseId,
          configSource: 'hybrid',
          address: businessData.address,
          contact: businessData.contact,
          businessInfo: { type: businessData.type },
          settings: businessData.settings,
          status: 'active',
        },
      });

      await tx.businessUser.create({
        data: {
          restaurantId: biz.id,
          userId,
          role: USER_ROLES.RESTAURANT_OWNER,
          status: 'active',
          permissions: getRolePermissions(USER_ROLES.RESTAURANT_OWNER),
        },
      });

      return biz;
    });

    this.logger.log(
      `Business ${business.id} created under franchise ${franchiseId}`,
    );
    return business;
  }

  async removeBusiness(
    franchiseId: string,
    businessId: string,
    userId: string,
  ) {
    await this.validateFranchiseAccess(userId, franchiseId, [
      'franchise_owner',
    ]);

    const business = await this.prisma.restaurant.findFirst({
      where: { id: businessId, franchiseId },
    });

    if (!business) {
      throw new NotFoundException('Business not found in this franchise');
    }

    await this.prisma.restaurant.update({
      where: { id: businessId },
      data: { franchiseId: null, configSource: 'local' },
    });

    this.logger.log(
      `Business ${businessId} removed from franchise ${franchiseId}`,
    );
  }

  async getBusinesses(franchiseId: string) {
    return this.prisma.restaurant.findMany({
      where: { franchiseId, status: { not: 'deleted' } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ==================== Staff Management ====================

  async getStaff(franchiseId: string) {
    return this.prisma.franchiseUser.findMany({
      where: { franchiseId },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });
  }

  async inviteStaff(
    franchiseId: string,
    dto: InviteFranchiseUserDto,
    userId: string,
  ) {
    await this.validateFranchiseAccess(userId, franchiseId, [
      'franchise_owner',
    ]);

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new NotFoundException(`User with email ${dto.email} not found`);
    }

    const existing = await this.prisma.franchiseUser.findUnique({
      where: { franchiseId_userId: { franchiseId, userId: user.id } },
    });

    if (existing) {
      throw new ConflictException('User is already a member of this franchise');
    }

    const franchiseUser = await this.prisma.franchiseUser.create({
      data: {
        franchiseId,
        userId: user.id,
        role: dto.role,
        status: 'active',
        permissions: dto.permissions || [],
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    this.logger.log(
      `User ${user.id} invited to franchise ${franchiseId} as ${dto.role}`,
    );
    return franchiseUser;
  }

  async updateStaff(
    franchiseId: string,
    targetUserId: string,
    dto: UpdateFranchiseUserDto,
    userId: string,
  ) {
    await this.validateFranchiseAccess(userId, franchiseId, [
      'franchise_owner',
    ]);

    const franchiseUser = await this.prisma.franchiseUser.findUnique({
      where: { franchiseId_userId: { franchiseId, userId: targetUserId } },
    });

    if (!franchiseUser) {
      throw new NotFoundException('Staff member not found in this franchise');
    }

    // Prevent modifying the owner's own record
    if (
      franchiseUser.role === USER_ROLES.FRANCHISE_OWNER &&
      targetUserId !== userId
    ) {
      throw new ForbiddenException('Cannot modify another franchise owner');
    }

    const updateData: Record<string, unknown> = {};
    if (dto.role !== undefined) updateData.role = dto.role;
    if (dto.permissions !== undefined) updateData.permissions = dto.permissions;
    if (dto.status !== undefined) updateData.status = dto.status;

    return this.prisma.franchiseUser.update({
      where: { franchiseId_userId: { franchiseId, userId: targetUserId } },
      data: updateData,
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });
  }

  async removeStaff(franchiseId: string, targetUserId: string, userId: string) {
    await this.validateFranchiseAccess(userId, franchiseId, [
      'franchise_owner',
    ]);

    const franchiseUser = await this.prisma.franchiseUser.findUnique({
      where: { franchiseId_userId: { franchiseId, userId: targetUserId } },
    });

    if (!franchiseUser) {
      throw new NotFoundException('Staff member not found in this franchise');
    }

    if (franchiseUser.role === USER_ROLES.FRANCHISE_OWNER) {
      throw new ForbiddenException('Cannot remove a franchise owner');
    }

    await this.prisma.franchiseUser.delete({
      where: { franchiseId_userId: { franchiseId, userId: targetUserId } },
    });

    this.logger.log(
      `User ${targetUserId} removed from franchise ${franchiseId}`,
    );
  }

  // ==================== Analytics ====================

  async getAggregatedAnalytics(
    franchiseId: string,
    dateRange?: { start: Date; end: Date },
  ) {
    const businesses = await this.prisma.restaurant.findMany({
      where: { franchiseId, status: 'active' },
      select: { id: true, name: true },
    });

    const businessIds = businesses.map((b) => b.id);

    const where: Record<string, unknown> = {
      restaurantId: { in: businessIds },
      deletedAt: null,
    };

    if (dateRange) {
      where.createdAt = { gte: dateRange.start, lte: dateRange.end };
    }

    const [orderCount, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        select: { restaurantId: true, pricing: true },
      }),
    ]);

    let totalRevenue = 0;
    const locationMap = new Map<string, { revenue: number; orders: number }>();

    for (const biz of businesses) {
      locationMap.set(biz.id, { revenue: 0, orders: 0 });
    }

    for (const order of orders) {
      const pricing = order.pricing as { total?: number } | null;
      const amount = pricing?.total || 0;
      totalRevenue += amount;

      const loc = locationMap.get(order.restaurantId);
      if (loc) {
        loc.revenue += amount;
        loc.orders += 1;
      }
    }

    const staffCount = await this.prisma.franchiseUser.count({
      where: { franchiseId, status: 'active' },
    });

    return {
      totalRevenue,
      totalOrders: orderCount,
      totalLocations: businessIds.length,
      totalStaff: staffCount,
      locationBreakdown: businesses.map((b) => ({
        businessId: b.id,
        businessName: b.name,
        revenue: locationMap.get(b.id)?.revenue || 0,
        orders: locationMap.get(b.id)?.orders || 0,
      })),
    };
  }

  async getLocationComparison(
    franchiseId: string,
    dateRange?: { start: Date; end: Date },
  ) {
    return this.getAggregatedAnalytics(franchiseId, dateRange);
  }

  // ==================== Settings & Config ====================

  async updateSettings(
    franchiseId: string,
    settings: Record<string, unknown>,
    userId: string,
  ) {
    await this.validateFranchiseAccess(userId, franchiseId, [
      'franchise_owner',
    ]);

    const franchise = await this.findByIdOrFail(franchiseId);
    const currentSettings =
      (franchise.settings as Record<string, unknown>) || {};

    const merged = { ...currentSettings, ...settings } as Prisma.InputJsonValue;

    return this.prisma.franchise.update({
      where: { id: franchiseId },
      data: { settings: merged },
    });
  }

  async updateMenuTemplate(
    franchiseId: string,
    template: Record<string, unknown>,
    userId: string,
  ) {
    await this.validateFranchiseAccess(userId, franchiseId, [
      'franchise_owner',
    ]);

    return this.prisma.franchise.update({
      where: { id: franchiseId },
      data: { menuTemplate: template as Prisma.InputJsonValue },
    });
  }

  async syncSettingsToLocations(franchiseId: string, userId: string) {
    await this.validateFranchiseAccess(userId, franchiseId, [
      'franchise_owner',
    ]);

    const franchise = await this.findByIdOrFail(franchiseId);
    const businesses = await this.prisma.restaurant.findMany({
      where: { franchiseId, configSource: 'franchise' },
    });

    let synced = 0;
    for (const biz of businesses) {
      await this.prisma.restaurant.update({
        where: { id: biz.id },
        data: { settings: franchise.settings },
      });
      synced++;
    }

    this.logger.log(
      `Synced settings to ${synced} locations for franchise ${franchiseId}`,
    );
    return { synced };
  }

  /**
   * Resolve effective settings for a location, considering franchise defaults
   */
  getEffectiveSettings(
    businessSettings: Record<string, unknown>,
    franchiseSettings: Record<string, unknown> | null,
    configSource: string,
  ): Record<string, unknown> {
    if (!franchiseSettings || configSource === 'local') {
      return businessSettings;
    }
    if (configSource === 'franchise') {
      return franchiseSettings;
    }
    // hybrid: deep merge, location overrides win
    return { ...franchiseSettings, ...businessSettings };
  }

  // ==================== Access Control ====================

  async checkUserAccess(userId: string, franchiseId: string): Promise<boolean> {
    const fu = await this.prisma.franchiseUser.findFirst({
      where: { userId, franchiseId, status: 'active' },
    });
    return !!fu;
  }

  async getUserRole(
    userId: string,
    franchiseId: string,
  ): Promise<string | null> {
    const fu = await this.prisma.franchiseUser.findFirst({
      where: { userId, franchiseId, status: 'active' },
    });
    return fu?.role || null;
  }

  // ==================== Private Helpers ====================

  private async validateFranchiseAccess(
    userId: string,
    franchiseId: string,
    allowedRoles: string[],
  ) {
    const fu = await this.prisma.franchiseUser.findFirst({
      where: { userId, franchiseId, status: 'active' },
    });

    if (!fu) {
      throw new ForbiddenException('You do not have access to this franchise');
    }

    if (!allowedRoles.includes(fu.role)) {
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );
    }
  }

  private async generateSlug(name: string): Promise<string> {
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    let slug = baseSlug;
    let counter = 1;

    while (await this.prisma.franchise.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  private async generateBusinessSlug(name: string): Promise<string> {
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    let slug = baseSlug;
    let counter = 1;

    while (await this.prisma.restaurant.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }
}
