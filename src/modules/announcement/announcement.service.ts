import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

@Injectable()
export class AnnouncementService {
  private readonly logger = new Logger(AnnouncementService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get all announcements (admin) with pagination
   */
  async getAll(page: number = 1, limit: number = 20) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const skip = (safePage - 1) * safeLimit;

    const [data, total] = await Promise.all([
      this.prisma.announcement.findMany({
        skip,
        take: safeLimit,
        orderBy: { createdAt: 'desc' },
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: { dismissals: true },
          },
        },
      }),
      this.prisma.announcement.count(),
    ]);

    return {
      data,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  /**
   * Get active announcements for a user (filtered by target, not dismissed, within publish/expiry window)
   */
  async getActiveForUser(userId: string, userRole?: string, planSlug?: string) {
    const now = new Date();

    const announcements = await this.prisma.announcement.findMany({
      where: {
        isActive: true,
        OR: [
          { publishAt: null },
          { publishAt: { lte: now } },
        ],
        AND: [
          {
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: now } },
            ],
          },
        ],
        // Exclude dismissed announcements for this user
        NOT: {
          dismissals: {
            some: {
              userId,
            },
          },
        },
      },
      orderBy: [
        { isPinned: 'desc' },
        { createdAt: 'desc' },
      ],
      include: {
        creator: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Filter by target on the application side for flexibility
    return announcements.filter((announcement) => {
      if (announcement.target === 'all') return true;

      if (announcement.target === 'business_owners') {
        return userRole === 'restaurant_owner' || userRole === 'franchise_owner' || userRole === 'super_admin';
      }

      if (announcement.target === 'staff') {
        return userRole === 'staff' || userRole === 'manager';
      }

      if (announcement.target === 'specific_plan') {
        const meta = announcement.targetMeta as Record<string, any> | null;
        if (meta?.planSlug && planSlug) {
          return meta.planSlug === planSlug;
        }
        return false;
      }

      return true;
    });
  }

  /**
   * Create a new announcement
   */
  async create(dto: CreateAnnouncementDto, adminUserId: string) {
    const announcement = await this.prisma.announcement.create({
      data: {
        title: dto.title,
        content: dto.content,
        type: dto.type || 'info',
        target: dto.target || 'all',
        targetMeta: dto.targetMeta || undefined,
        isPinned: dto.isPinned || false,
        publishAt: dto.publishAt ? new Date(dto.publishAt) : null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        createdBy: adminUserId,
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    this.logger.log(`Announcement created: "${announcement.title}" by user ${adminUserId}`);
    return announcement;
  }

  /**
   * Update an announcement
   */
  async update(id: string, dto: UpdateAnnouncementDto) {
    const existing = await this.prisma.announcement.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Announcement with ID ${id} not found`);
    }

    const data: Record<string, any> = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.content !== undefined) data.content = dto.content;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.target !== undefined) data.target = dto.target;
    if (dto.targetMeta !== undefined) data.targetMeta = dto.targetMeta;
    if (dto.isPinned !== undefined) data.isPinned = dto.isPinned;
    if (dto.publishAt !== undefined) data.publishAt = dto.publishAt ? new Date(dto.publishAt) : null;
    if (dto.expiresAt !== undefined) data.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;

    const announcement = await this.prisma.announcement.update({
      where: { id },
      data,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: { dismissals: true },
        },
      },
    });

    this.logger.log(`Announcement updated: "${announcement.title}" (${id})`);
    return announcement;
  }

  /**
   * Delete an announcement
   */
  async remove(id: string) {
    const existing = await this.prisma.announcement.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Announcement with ID ${id} not found`);
    }

    await this.prisma.announcement.delete({ where: { id } });
    this.logger.log(`Announcement deleted: "${existing.title}" (${id})`);
    return { message: 'Announcement deleted successfully' };
  }

  /**
   * Toggle isActive status
   */
  async togglePublish(id: string) {
    const existing = await this.prisma.announcement.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Announcement with ID ${id} not found`);
    }

    const announcement = await this.prisma.announcement.update({
      where: { id },
      data: { isActive: !existing.isActive },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: { dismissals: true },
        },
      },
    });

    this.logger.log(
      `Announcement ${announcement.isActive ? 'published' : 'unpublished'}: "${announcement.title}" (${id})`,
    );
    return announcement;
  }

  /**
   * Dismiss an announcement for a user (upsert to handle duplicates)
   */
  async dismiss(announcementId: string, userId: string) {
    const announcement = await this.prisma.announcement.findUnique({
      where: { id: announcementId },
    });
    if (!announcement) {
      throw new NotFoundException(`Announcement with ID ${announcementId} not found`);
    }

    await this.prisma.announcementDismissal.upsert({
      where: {
        announcementId_userId: {
          announcementId,
          userId,
        },
      },
      update: {},
      create: {
        announcementId,
        userId,
      },
    });

    return { message: 'Announcement dismissed' };
  }
}
