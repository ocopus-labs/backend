import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { CloudinaryService } from 'src/lib/common/upload';
import {
  CreateBusinessDto,
  UpdateBusinessDto,
  UpdateBusinessSettingsDto,
} from './dto';
import { USER_ROLES, getRolePermissions } from 'src/lib/auth/roles.constants';
import { Business, BusinessWithUsers } from './interfaces';
import { UsageTrackingService } from 'src/modules/subscription/usage-tracking.service';

@Injectable()
export class BusinessService {
  private readonly logger = new Logger(BusinessService.name);

  constructor(
    private prisma: PrismaService,
    private cloudinaryService: CloudinaryService,
    private usageTrackingService: UsageTrackingService,
  ) {}

  async create(dto: CreateBusinessDto, ownerId: string): Promise<Business> {
    // Check subscription location limit
    const limitCheck =
      await this.usageTrackingService.checkLocationLimit(ownerId);
    if (!limitCheck.allowed) {
      throw new ForbiddenException(
        limitCheck.message ||
          `Location limit reached (${limitCheck.current}/${limitCheck.limit}). Please upgrade your subscription.`,
      );
    }

    const slug = await this.generateSlug(dto.name);

    const business = await this.prisma.$transaction(async (tx) => {
      const biz = await tx.restaurant.create({
        data: {
          name: dto.name,
          slug,
          type: dto.type,
          logo: dto.logo,
          description: dto.description,
          ownerId,
          address: {
            street: dto.address.street,
            city: dto.address.city,
            state: dto.address.state || '',
            country: dto.address.country,
            postalCode: dto.address.postalCode || '',
            coordinates:
              dto.address.lat && dto.address.lng
                ? { lat: dto.address.lat, lng: dto.address.lng }
                : null,
          },
          contact: {
            email: dto.contact.email,
            phone: dto.contact.phone,
            website: dto.contact.website || null,
          },
          businessInfo: {
            type: dto.type,
            subType: dto.subType || null,
          },
          settings: {
            timezone: dto.settings.timezone,
            currency: dto.settings.currency,
            taxRate: dto.settings.taxRate || '0',
          },
          status: 'active',
        },
      });

      // Create BusinessUser record with owner role
      await tx.businessUser.create({
        data: {
          restaurantId: biz.id,
          userId: ownerId,
          role: USER_ROLES.RESTAURANT_OWNER,
          status: 'active',
          permissions: getRolePermissions(USER_ROLES.RESTAURANT_OWNER),
        },
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          restaurantId: biz.id,
          userId: ownerId,
          action: 'business.create',
          resource: 'business',
          resourceId: biz.id,
          details: {
            businessName: biz.name,
            businessType: biz.type,
          },
        },
      });

      // Seed default expense categories
      const defaultCategories = [
        { name: 'Rent & Lease', color: '#ef4444', description: 'Rent, lease payments, and property costs' },
        { name: 'Utilities', color: '#f97316', description: 'Electricity, water, gas, internet, phone' },
        { name: 'Supplies', color: '#22c55e', description: 'Office and operational supplies' },
        { name: 'Salaries & Wages', color: '#6366f1', description: 'Employee salaries, wages, and benefits' },
        { name: 'Food & Ingredients', color: '#eab308', description: 'Raw materials and ingredients' },
        { name: 'Maintenance', color: '#06b6d4', description: 'Equipment repair and maintenance' },
        { name: 'Marketing', color: '#a855f7', description: 'Advertising, promotions, and marketing' },
        { name: 'Transport', color: '#64748b', description: 'Delivery, fuel, and transportation costs' },
        { name: 'Taxes & Licenses', color: '#ec4899', description: 'Government taxes, permits, and licenses' },
        { name: 'Miscellaneous', color: '#14b8a6', description: 'Other uncategorized expenses' },
      ];

      await tx.expenseCategory.createMany({
        data: defaultCategories.map((cat) => ({
          restaurantId: biz.id,
          ...cat,
        })),
      });

      return biz;
    });

    this.logger.log(
      `Business created: ${business.name} (${business.id}) by user ${ownerId}`,
    );
    return business;
  }

  async findById(id: string): Promise<Business | null> {
    return this.prisma.restaurant.findUnique({
      where: { id },
    });
  }

  async findByIdOrFail(id: string): Promise<Business> {
    const business = await this.findById(id);
    if (!business) {
      throw new NotFoundException(`Business with ID ${id} not found`);
    }
    return business;
  }

  async findBySlug(slug: string): Promise<Business | null> {
    return this.prisma.restaurant.findUnique({
      where: { slug },
    });
  }

  async findByOwnerId(ownerId: string): Promise<Business[]> {
    return this.prisma.restaurant.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUserBusinesses(userId: string): Promise<Business[]> {
    // Get directly assigned businesses
    const businessUsers = await this.prisma.businessUser.findMany({
      where: {
        userId,
        status: 'active',
      },
      include: {
        restaurant: true,
      },
      orderBy: { joinedAt: 'desc' },
    });

    const directBusinesses = businessUsers
      .map((bu) => bu.restaurant)
      .filter((b) => b.status !== 'deleted');
    const directIds = new Set(directBusinesses.map((b) => b.id));

    // Get businesses from franchise membership
    const franchiseUsers = await this.prisma.franchiseUser.findMany({
      where: { userId, status: 'active' },
      select: { franchiseId: true },
    });

    if (franchiseUsers.length > 0) {
      const franchiseIds = franchiseUsers.map((fu) => fu.franchiseId);
      const franchiseBusinesses = await this.prisma.restaurant.findMany({
        where: {
          franchiseId: { in: franchiseIds },
          status: { not: 'deleted' },
          id: { notIn: Array.from(directIds) },
        },
        orderBy: { createdAt: 'desc' },
      });

      return [...directBusinesses, ...franchiseBusinesses];
    }

    return directBusinesses;
  }

  async update(
    id: string,
    dto: UpdateBusinessDto,
    userId: string,
  ): Promise<Business> {
    await this.findByIdOrFail(id);

    const updateData: Record<string, unknown> = {};

    if (dto.name) updateData.name = dto.name;
    if (dto.type) updateData.type = dto.type;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.logo) updateData.logo = dto.logo;
    if (dto.status) updateData.status = dto.status;

    if (dto.address) {
      updateData.address = {
        street: dto.address.street,
        city: dto.address.city,
        state: dto.address.state || '',
        country: dto.address.country,
        postalCode: dto.address.postalCode || '',
        coordinates:
          dto.address.lat && dto.address.lng
            ? { lat: dto.address.lat, lng: dto.address.lng }
            : null,
      };
    }

    if (dto.contact) {
      updateData.contact = {
        email: dto.contact.email,
        phone: dto.contact.phone,
        website: dto.contact.website || null,
      };
    }

    if (dto.settings) {
      updateData.settings = {
        timezone: dto.settings.timezone,
        currency: dto.settings.currency,
        taxRate: dto.settings.taxRate || '0',
      };
    }

    const business = await this.prisma.restaurant.update({
      where: { id },
      data: updateData,
    });

    await this.createAuditLog(id, userId, 'business.update', 'business', {
      updatedFields: Object.keys(dto),
    });

    return business;
  }

  async updateSettings(
    id: string,
    dto: UpdateBusinessSettingsDto,
    userId: string,
  ): Promise<Business> {
    const business = await this.findByIdOrFail(id);
    const currentSettings = business.settings as Record<string, unknown>;

    const updatedSettings = {
      ...currentSettings,
      ...dto,
    };

    const updated = await this.prisma.restaurant.update({
      where: { id },
      data: { settings: updatedSettings },
    });

    await this.createAuditLog(
      id,
      userId,
      'business.update_settings',
      'business',
      { updatedFields: Object.keys(dto) },
    );

    return updated;
  }

  async updateLogo(
    id: string,
    imageData: string,
    userId: string,
  ): Promise<Business> {
    await this.findByIdOrFail(id);

    let logoUrl = imageData;

    // Reject blob URLs - they are browser-only and cannot be processed server-side
    if (imageData.startsWith('blob:')) {
      throw new BadRequestException(
        'Blob URLs are not supported. Please upload the image as base64 data.',
      );
    }

    // If it's base64 data, upload to Cloudinary
    if (imageData.startsWith('data:')) {
      const uploadResult = await this.cloudinaryService.uploadImage(
        imageData,
        'business-logos',
      );
      logoUrl = uploadResult.url;
    }

    const business = await this.prisma.restaurant.update({
      where: { id },
      data: { logo: logoUrl },
    });

    await this.createAuditLog(
      id,
      userId,
      'business.update_logo',
      'business',
      {},
    );

    return business;
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.findByIdOrFail(id);

    // Soft delete - just update status
    await this.prisma.restaurant.update({
      where: { id },
      data: { status: 'deleted' },
    });

    await this.createAuditLog(id, userId, 'business.delete', 'business', {});

    this.logger.log(`Business ${id} deleted by user ${userId}`);
  }

  async checkUserAccess(userId: string, businessId: string): Promise<boolean> {
    const businessUser = await this.prisma.businessUser.findFirst({
      where: {
        userId,
        restaurantId: businessId,
        status: 'active',
      },
    });

    if (businessUser) return true;

    // Franchise fallback
    const business = await this.prisma.restaurant.findUnique({
      where: { id: businessId },
      select: { franchiseId: true },
    });

    if (business?.franchiseId) {
      const franchiseUser = await this.prisma.franchiseUser.findFirst({
        where: {
          userId,
          franchiseId: business.franchiseId,
          status: 'active',
        },
      });
      return !!franchiseUser;
    }

    return false;
  }

  async getUserRole(
    userId: string,
    businessId: string,
  ): Promise<string | null> {
    const businessUser = await this.prisma.businessUser.findFirst({
      where: {
        userId,
        restaurantId: businessId,
        status: 'active',
      },
    });

    if (businessUser) return businessUser.role;

    // Franchise fallback
    const business = await this.prisma.restaurant.findUnique({
      where: { id: businessId },
      select: { franchiseId: true },
    });

    if (business?.franchiseId) {
      const franchiseUser = await this.prisma.franchiseUser.findFirst({
        where: {
          userId,
          franchiseId: business.franchiseId,
          status: 'active',
        },
      });
      return franchiseUser?.role || null;
    }

    return null;
  }

  private async generateSlug(name: string): Promise<string> {
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

  private async createAuditLog(
    businessId: string,
    userId: string,
    action: string,
    resource: string,
    details: Record<string, unknown>,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        restaurantId: businessId,
        userId,
        action,
        resource,
        resourceId: businessId,
        details: details as object,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      },
    });
  }
}
