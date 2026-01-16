import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
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
  getRolePermissions,
  getRoleDisplayName,
  UserRole,
} from 'src/lib/auth/roles.constants';

@Injectable()
export class TeamService {
  private readonly logger = new Logger(TeamService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get all team members for a business
   */
  async findAll(restaurantId: string): Promise<TeamMember[]> {
    const members = await this.prisma.businessUser.findMany({
      where: { restaurantId },
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
    });

    return members.map((m) => ({
      id: m.id,
      userId: m.userId,
      restaurantId: m.restaurantId,
      role: m.role,
      status: m.status,
      permissions: m.permissions,
      joinedAt: m.joinedAt,
      user: m.user,
    }));
  }

  /**
   * Get team members by status
   */
  async findByStatus(
    restaurantId: string,
    status: TeamMemberStatus,
  ): Promise<TeamMember[]> {
    const members = await this.prisma.businessUser.findMany({
      where: { restaurantId, status },
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
    });

    return members.map((m) => ({
      id: m.id,
      userId: m.userId,
      restaurantId: m.restaurantId,
      role: m.role,
      status: m.status,
      permissions: m.permissions,
      joinedAt: m.joinedAt,
      user: m.user,
    }));
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
    });

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
  ): Promise<{ invitation: { email: string; role: string; status: string } }> {
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
    });

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
    const members = await this.findAll(restaurantId);

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

  private async createAuditLog(
    restaurantId: string,
    userId: string,
    action: string,
    resource: string,
    resourceId: string | null,
    details: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        restaurantId,
        userId,
        action,
        resource,
        resourceId,
        details: details as object,
      },
    });
  }
}
