import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { UsageTrackingService } from 'src/modules/subscription/usage-tracking.service';
import {
  InviteTeamMemberDto,
  AddExistingUserDto,
  UpdateTeamMemberDto,
  UpdateMemberRoleDto,
  UpdateMemberPermissionsDto,
} from './dto';
import {
  TeamMember,
  TeamMemberStatus,
  TEAM_MEMBER_STATUSES,
  AssignableRole,
  ASSIGNABLE_ROLES,
} from './interfaces';
import {
  USER_ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  getRolePermissions,
  getRoleDisplayName,
  UserRole,
} from 'src/lib/auth/roles.constants';
import {
  getResourceLabel,
  type BusinessType,
} from 'src/lib/auth/business-adapter';

@Injectable()
export class TeamService {
  private readonly logger = new Logger(TeamService.name);

  constructor(
    private prisma: PrismaService,
    private usageTrackingService: UsageTrackingService,
  ) {}

  /**
   * Get all team members for a business
   */
  async findAll(restaurantId: string, limit?: number, offset?: number): Promise<{ members: TeamMember[]; total: number }> {
    const where = { restaurantId };
    const [members, total] = await this.prisma.$transaction([
      this.prisma.businessUser.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
        orderBy: { joinedAt: 'asc' },
        ...(limit !== undefined && { take: limit }),
        ...(offset !== undefined && { skip: offset }),
      }),
      this.prisma.businessUser.count({ where }),
    ]);

    return {
      members: members.map((m) => ({
        id: m.id,
        userId: m.userId,
        restaurantId: m.restaurantId,
        role: m.role,
        status: m.status,
        permissions: m.permissions,
        joinedAt: m.joinedAt,
        user: m.user,
      })),
      total,
    };
  }

  /**
   * Get team members by status
   */
  async findByStatus(
    restaurantId: string,
    status: TeamMemberStatus,
    limit?: number,
    offset?: number,
  ): Promise<{ members: TeamMember[]; total: number }> {
    const where = { restaurantId, status };
    const [members, total] = await this.prisma.$transaction([
      this.prisma.businessUser.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
        orderBy: { joinedAt: 'asc' },
        ...(limit !== undefined && { take: limit }),
        ...(offset !== undefined && { skip: offset }),
      }),
      this.prisma.businessUser.count({ where }),
    ]);

    return {
      members: members.map((m) => ({
        id: m.id,
        userId: m.userId,
        restaurantId: m.restaurantId,
        role: m.role,
        status: m.status,
        permissions: m.permissions,
        joinedAt: m.joinedAt,
        user: m.user,
      })),
      total,
    };
  }

  /**
   * Get a team member by ID
   */
  async findById(restaurantId: string, id: string): Promise<TeamMember | null> {
    const member = await this.prisma.businessUser.findFirst({
      where: { id, restaurantId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    if (!member) return null;

    return {
      id: member.id,
      userId: member.userId,
      restaurantId: member.restaurantId,
      role: member.role,
      status: member.status,
      permissions: member.permissions,
      joinedAt: member.joinedAt,
      user: member.user,
    };
  }

  /**
   * Get a team member by ID or throw
   */
  async findByIdOrFail(restaurantId: string, id: string): Promise<TeamMember> {
    const member = await this.findById(restaurantId, id);
    if (!member) {
      throw new NotFoundException(`Team member with ID ${id} not found`);
    }
    return member;
  }

  /**
   * Get a team member by user ID
   */
  async findByUserId(
    restaurantId: string,
    userId: string,
  ): Promise<TeamMember | null> {
    const member = await this.prisma.businessUser.findFirst({
      where: { restaurantId, userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    if (!member) return null;

    return {
      id: member.id,
      userId: member.userId,
      restaurantId: member.restaurantId,
      role: member.role,
      status: member.status,
      permissions: member.permissions,
      joinedAt: member.joinedAt,
      user: member.user,
    };
  }

  /**
   * Add an existing user to the team
   */
  async addExistingUser(
    restaurantId: string,
    dto: AddExistingUserDto,
    inviterId: string,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<TeamMember> {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if already a member
    const existing = await this.prisma.businessUser.findFirst({
      where: { restaurantId, userId: dto.userId },
    });

    if (existing) {
      throw new ConflictException('User is already a team member');
    }

    // Check team member limit
    const limitCheck = await this.usageTrackingService.checkTeamMemberLimit(restaurantId);
    if (!limitCheck.allowed) {
      throw new ForbiddenException(
        limitCheck.message ||
          `Team member limit reached (${limitCheck.current}/${limitCheck.limit}). Please upgrade your subscription.`,
      );
    }

    // Get permissions for role
    const permissions = dto.customPermissions?.length
      ? dto.customPermissions
      : getRolePermissions(dto.role as UserRole);

    const member = await this.prisma.businessUser.create({
      data: {
        restaurantId,
        userId: dto.userId,
        role: dto.role,
        status: TEAM_MEMBER_STATUSES.ACTIVE,
        permissions,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    await this.createAuditLog(restaurantId, inviterId, 'ADD_MEMBER', 'team', member.id, {
      userId: dto.userId,
      role: dto.role,
      email: user.email,
    }, context);

    this.logger.log(`User ${user.email} added to team as ${dto.role}`);

    return {
      id: member.id,
      userId: member.userId,
      restaurantId: member.restaurantId,
      role: member.role,
      status: member.status,
      permissions: member.permissions,
      joinedAt: member.joinedAt,
      user: member.user,
    };
  }

  /**
   * Invite a new user by email
   */
  async inviteByEmail(
    restaurantId: string,
    dto: InviteTeamMemberDto,
    inviterId: string,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<{ invitation: { email: string; role: string; status: string } }> {
    // Check team member limit before processing invite
    const limitCheck = await this.usageTrackingService.checkTeamMemberLimit(restaurantId);
    if (!limitCheck.allowed) {
      throw new ForbiddenException(
        limitCheck.message ||
          `Team member limit reached (${limitCheck.current}/${limitCheck.limit}). Please upgrade your subscription.`,
      );
    }

    // Check if user with email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      // Check if already a member
      const existingMember = await this.prisma.businessUser.findFirst({
        where: { restaurantId, userId: existingUser.id },
      });

      if (existingMember) {
        throw new ConflictException('User is already a team member');
      }

      // Add existing user directly
      await this.addExistingUser(
        restaurantId,
        {
          userId: existingUser.id,
          role: dto.role,
          customPermissions: dto.customPermissions,
        },
        inviterId,
        context,
      );

      return {
        invitation: {
          email: dto.email,
          role: dto.role,
          status: 'added', // User existed and was added directly
        },
      };
    }

    // For new users, we would typically:
    // 1. Create an invitation record
    // 2. Send an invitation email
    // 3. When user signs up with that email, automatically add them to the team
    //
    // For now, we'll just log the invitation request
    // In production, this would integrate with the mail service

    await this.createAuditLog(restaurantId, inviterId, 'INVITE_MEMBER', 'team', null, {
      email: dto.email,
      role: dto.role,
    }, context);

    this.logger.log(`Invitation sent to ${dto.email} for role ${dto.role}`);

    return {
      invitation: {
        email: dto.email,
        role: dto.role,
        status: 'pending',
      },
    };
  }

  /**
   * Update a team member
   */
  async update(
    restaurantId: string,
    id: string,
    dto: UpdateTeamMemberDto,
    updaterId: string,
  ): Promise<TeamMember> {
    const existing = await this.findByIdOrFail(restaurantId, id);

    // Prevent updating owner
    if (existing.role === USER_ROLES.RESTAURANT_OWNER) {
      throw new ForbiddenException('Cannot modify the business owner');
    }

    const updateData: Record<string, unknown> = {};

    if (dto.role) {
      if (!ASSIGNABLE_ROLES.includes(dto.role)) {
        throw new BadRequestException(`Invalid role: ${dto.role}`);
      }
      updateData.role = dto.role;
      // Update permissions based on new role unless custom ones provided
      if (!dto.permissions) {
        updateData.permissions = getRolePermissions(dto.role as UserRole);
      }
    }

    if (dto.status) {
      updateData.status = dto.status;
    }

    if (dto.permissions) {
      updateData.permissions = dto.permissions;
    }

    const member = await this.prisma.businessUser.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    await this.createAuditLog(restaurantId, updaterId, 'UPDATE_MEMBER', 'team', id, {
      updatedFields: Object.keys(dto),
    });

    return {
      id: member.id,
      userId: member.userId,
      restaurantId: member.restaurantId,
      role: member.role,
      status: member.status,
      permissions: member.permissions,
      joinedAt: member.joinedAt,
      user: member.user,
    };
  }

  /**
   * Update member role
   */
  async updateRole(
    restaurantId: string,
    id: string,
    dto: UpdateMemberRoleDto,
    updaterId: string,
  ): Promise<TeamMember> {
    const existing = await this.findByIdOrFail(restaurantId, id);

    if (existing.role === USER_ROLES.RESTAURANT_OWNER) {
      throw new ForbiddenException('Cannot change the business owner role');
    }

    if (!ASSIGNABLE_ROLES.includes(dto.role)) {
      throw new BadRequestException(`Invalid role: ${dto.role}`);
    }

    const permissions = getRolePermissions(dto.role as UserRole);

    const member = await this.prisma.businessUser.update({
      where: { id },
      data: { role: dto.role, permissions },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    await this.createAuditLog(restaurantId, updaterId, 'UPDATE_ROLE', 'team', id, {
      previousRole: existing.role,
      newRole: dto.role,
    });

    this.logger.log(`Member ${id} role changed from ${existing.role} to ${dto.role}`);

    return {
      id: member.id,
      userId: member.userId,
      restaurantId: member.restaurantId,
      role: member.role,
      status: member.status,
      permissions: member.permissions,
      joinedAt: member.joinedAt,
      user: member.user,
    };
  }

  /**
   * Update member permissions
   */
  async updatePermissions(
    restaurantId: string,
    id: string,
    dto: UpdateMemberPermissionsDto,
    updaterId: string,
  ): Promise<TeamMember> {
    const existing = await this.findByIdOrFail(restaurantId, id);

    if (existing.role === USER_ROLES.RESTAURANT_OWNER) {
      throw new ForbiddenException('Cannot modify the business owner permissions');
    }

    const member = await this.prisma.businessUser.update({
      where: { id },
      data: { permissions: dto.permissions },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    await this.createAuditLog(restaurantId, updaterId, 'UPDATE_PERMISSIONS', 'team', id, {
      permissions: dto.permissions,
    });

    return {
      id: member.id,
      userId: member.userId,
      restaurantId: member.restaurantId,
      role: member.role,
      status: member.status,
      permissions: member.permissions,
      joinedAt: member.joinedAt,
      user: member.user,
    };
  }

  /**
   * Suspend a team member
   */
  async suspend(
    restaurantId: string,
    id: string,
    updaterId: string,
    reason?: string,
  ): Promise<TeamMember> {
    const existing = await this.findByIdOrFail(restaurantId, id);

    if (existing.role === USER_ROLES.RESTAURANT_OWNER) {
      throw new ForbiddenException('Cannot suspend the business owner');
    }

    if (existing.status === TEAM_MEMBER_STATUSES.SUSPENDED) {
      throw new BadRequestException('Member is already suspended');
    }

    const member = await this.prisma.businessUser.update({
      where: { id },
      data: { status: TEAM_MEMBER_STATUSES.SUSPENDED },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    await this.createAuditLog(restaurantId, updaterId, 'SUSPEND_MEMBER', 'team', id, {
      reason,
    });

    this.logger.log(`Member ${id} suspended`);

    return {
      id: member.id,
      userId: member.userId,
      restaurantId: member.restaurantId,
      role: member.role,
      status: member.status,
      permissions: member.permissions,
      joinedAt: member.joinedAt,
      user: member.user,
    };
  }

  /**
   * Reactivate a team member
   */
  async reactivate(
    restaurantId: string,
    id: string,
    updaterId: string,
  ): Promise<TeamMember> {
    const existing = await this.findByIdOrFail(restaurantId, id);

    if (existing.status === TEAM_MEMBER_STATUSES.ACTIVE) {
      throw new BadRequestException('Member is already active');
    }

    const member = await this.prisma.businessUser.update({
      where: { id },
      data: { status: TEAM_MEMBER_STATUSES.ACTIVE },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    await this.createAuditLog(restaurantId, updaterId, 'REACTIVATE_MEMBER', 'team', id, {});

    this.logger.log(`Member ${id} reactivated`);

    return {
      id: member.id,
      userId: member.userId,
      restaurantId: member.restaurantId,
      role: member.role,
      status: member.status,
      permissions: member.permissions,
      joinedAt: member.joinedAt,
      user: member.user,
    };
  }

  /**
   * Remove a team member
   */
  async remove(
    restaurantId: string,
    id: string,
    removerId: string,
  ): Promise<void> {
    const existing = await this.findByIdOrFail(restaurantId, id);

    if (existing.role === USER_ROLES.RESTAURANT_OWNER) {
      throw new ForbiddenException('Cannot remove the business owner');
    }

    await this.prisma.businessUser.delete({
      where: { id },
    });

    await this.createAuditLog(restaurantId, removerId, 'REMOVE_MEMBER', 'team', id, {
      userId: existing.userId,
      role: existing.role,
    });

    this.logger.log(`Member ${id} removed from team`);
  }

  /**
   * Get available roles with info
   */
  getRolesInfo(): {
    role: string;
    displayName: string;
    description: string;
  }[] {
    const roleDescriptions: Record<string, string> = {
      manager: 'Day-to-day operations, staff management (limited), order & payment processing',
      staff: 'Basic operational access - create orders, view menu, manage tables',
      viewer: 'Read-only access to business data and analytics',
      accountant: 'Financial operations - invoices, payments, expenses, reports',
    };

    return ASSIGNABLE_ROLES.map((role) => ({
      role,
      displayName: getRoleDisplayName(role as UserRole),
      description: roleDescriptions[role] || '',
    }));
  }

  /**
   * Get team statistics
   */
  async getTeamStats(restaurantId: string): Promise<{
    total: number;
    active: number;
    suspended: number;
    byRole: Record<string, number>;
  }> {
    const { members } = await this.findAll(restaurantId);

    const stats = {
      total: members.length,
      active: 0,
      suspended: 0,
      byRole: {} as Record<string, number>,
    };

    for (const member of members) {
      if (member.status === TEAM_MEMBER_STATUSES.ACTIVE) {
        stats.active++;
      } else if (member.status === TEAM_MEMBER_STATUSES.SUSPENDED) {
        stats.suspended++;
      }

      if (!stats.byRole[member.role]) {
        stats.byRole[member.role] = 0;
      }
      stats.byRole[member.role]++;
    }

    return stats;
  }

  /**
   * Get permission tree for the business, organized by category
   */
  async getPermissionTree(restaurantId: string): Promise<{
    categories: {
      category: string;
      label: string;
      businessLabel?: string;
      permissions: { key: string; label: string; description?: string }[];
    }[];
    roleDefaults: Record<string, string[]>;
    roles: { role: string; displayName: string }[];
  }> {
    // Get business type
    const business = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { type: true },
    });

    const businessType = (business?.type || 'restaurant') as BusinessType;

    // Category metadata for human-readable labels and descriptions
    const categoryMeta: Record<string, { label: string; genericResource?: string; descriptions?: Record<string, string> }> = {
      OPERATIONS: {
        label: 'Operations',
        genericResource: 'operations',
        descriptions: {
          CREATE: 'Create new operations',
          READ: 'View operations',
          UPDATE: 'Edit existing operations',
          CANCEL: 'Cancel operations',
          COMPLETE: 'Mark operations as complete',
          VIEW_ALL: 'View all operations across staff',
        },
      },
      BILLING: {
        label: 'Billing & Payments',
        genericResource: 'billing',
        descriptions: {
          CREATE_INVOICE: 'Create invoices',
          READ_INVOICE: 'View invoices',
          PROCESS_PAYMENT: 'Process payments',
          REFUND: 'Issue refunds',
          VIEW_REPORTS: 'View financial reports',
          MANAGE_SUBSCRIPTIONS: 'Manage subscriptions',
        },
      },
      CATALOG: {
        label: 'Catalog / Menu',
        genericResource: 'catalog',
        descriptions: {
          CREATE: 'Add new catalog items',
          READ: 'View catalog items',
          UPDATE: 'Edit catalog items',
          DELETE: 'Remove catalog items',
          PUBLISH: 'Publish catalog changes',
        },
      },
      INVENTORY: {
        label: 'Inventory',
        genericResource: 'inventory',
        descriptions: {
          CREATE: 'Add inventory items',
          READ: 'View inventory',
          UPDATE: 'Edit inventory items',
          DELETE: 'Remove inventory items',
          MANAGE_STOCK: 'Manage stock levels',
        },
      },
      SCHEDULING: {
        label: 'Scheduling',
        genericResource: 'scheduling',
        descriptions: {
          CREATE: 'Create schedule entries',
          READ: 'View schedules',
          UPDATE: 'Edit schedule entries',
          DELETE: 'Remove schedule entries',
          RESERVE: 'Make reservations',
          MANAGE: 'Manage all schedules',
        },
      },
      EXPENSE: {
        label: 'Expenses',
        genericResource: 'expense',
        descriptions: {
          CREATE: 'Create expenses',
          READ: 'View expenses',
          UPDATE: 'Edit expenses',
          DELETE: 'Remove expenses',
          APPROVE: 'Approve expenses',
          REJECT: 'Reject expenses',
        },
      },
      ANALYTICS: {
        label: 'Analytics & Reporting',
        genericResource: 'analytics',
        descriptions: {
          VIEW: 'View analytics',
          EXPORT: 'Export analytics data',
          SHARE: 'Share analytics reports',
          ADVANCED_REPORTING: 'Access advanced reporting',
        },
      },
      STAFF: {
        label: 'Staff Management',
        genericResource: 'staff',
        descriptions: {
          MANAGE: 'Manage staff members',
          VIEW_ATTENDANCE: 'View attendance records',
          MANAGE_SHIFTS: 'Manage shift schedules',
          ASSIGN_TO_OPERATION: 'Assign staff to operations',
        },
      },
      BUSINESS: {
        label: 'Business Settings',
        genericResource: 'business',
        descriptions: {
          CREATE: 'Create businesses',
          READ: 'View business info',
          UPDATE: 'Edit business settings',
          DELETE: 'Delete businesses',
          MANAGE_SETTINGS: 'Manage business settings',
          VIEW_ANALYTICS: 'View business analytics',
          MANAGE_STAFF: 'Manage business staff',
          MANAGE_INVENTORY: 'Manage business inventory',
        },
      },
    };

    // Build categories from PERMISSIONS, skipping platform/franchise/user/business-type-specific
    const skipCategories = ['PLATFORM', 'FRANCHISE', 'USER', 'RESTAURANT', 'SALON', 'GYM'];

    const categories = Object.entries(PERMISSIONS)
      .filter(([key]) => !skipCategories.includes(key))
      .map(([categoryKey, perms]) => {
        const meta = categoryMeta[categoryKey];
        const label = meta?.label || categoryKey.charAt(0) + categoryKey.slice(1).toLowerCase();
        const genericResource = meta?.genericResource;

        const businessLabel = genericResource
          ? getResourceLabel(businessType, genericResource)
          : undefined;

        const permissions = Object.entries(perms).map(([permName, permKey]) => ({
          key: permKey as string,
          label: permName
            .split('_')
            .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
            .join(' '),
          description: meta?.descriptions?.[permName],
        }));

        return {
          category: categoryKey,
          label,
          businessLabel: businessLabel && businessLabel !== genericResource ? businessLabel : undefined,
          permissions,
        };
      });

    // Build role defaults
    const roleDefaults: Record<string, string[]> = {};
    for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
      roleDefaults[role] = perms;
    }

    // Build roles list (assignable roles only)
    const roles = ASSIGNABLE_ROLES.map((role) => ({
      role,
      displayName: getRoleDisplayName(role as UserRole),
    }));

    return { categories, roleDefaults, roles };
  }

  private async createAuditLog(
    restaurantId: string,
    userId: string,
    action: string,
    resource: string,
    resourceId: string | null,
    details: Record<string, unknown>,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        restaurantId,
        userId,
        action,
        resource,
        resourceId,
        details: details as object,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      },
    });
  }
}
