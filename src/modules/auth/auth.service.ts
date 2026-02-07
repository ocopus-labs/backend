import { Injectable, Logger, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { AuthService as BetterAuthService } from '@thallesp/nestjs-better-auth';
import { PrismaService } from '../prisma/prisma.service';
import { AuthConfig } from 'src/lib/auth/auth.config';

export interface UserWithRole {
  id: string;
  email: string;
  name?: string;
  image?: string;
  emailVerified: boolean;
  role: string;
}

export interface AuthSession {
  user: UserWithRole;
  token: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private betterAuthService: BetterAuthService<AuthConfig>,
  ) { }

  /**
   * Get user by ID with role information
   */
  async getUserById(userId: string): Promise<UserWithRole | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          emailVerified: true,
        },
      });

      if (!user) return null;

      // Get role from business user if exists
      const businessUser = await this.prisma.businessUser.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { role: true },
      });

      return {
        ...user,
        name: user.name ?? undefined,
        image: user.image ?? undefined,
        role: businessUser?.role || 'staff',
      };
    } catch (error) {
      this.logger.error(`Error getting user by ID: ${error}`);
      throw new InternalServerErrorException('Failed to get user');
    }
  }

  /**
   * Get user by email with role information
   */
  async getUserByEmail(email: string): Promise<UserWithRole | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          emailVerified: true,
        },
      });

      if (!user) return null;

      const businessUser = await this.prisma.businessUser.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        select: { role: true },
      });

      return {
        ...user,
        name: user.name ?? undefined,
        image: user.image ?? undefined,
        role: businessUser?.role || 'staff',
      };
    } catch (error) {
      this.logger.error(`Error getting user by email: ${error}`);
      throw new InternalServerErrorException('Failed to get user by email');
    }
  }

  /**
   * Check if user has permission for a resource
   */
  async userHasPermission(
    userId: string,
    resource: string,
    action: string,
  ): Promise<boolean> {
    try {
      const businessUser = await this.prisma.businessUser.findFirst({
        where: { userId },
        select: { role: true, permissions: true },
      });

      if (!businessUser) return false;

      const role = businessUser.role;

      // Admin roles have all permissions
      if (['super_admin', 'franchise_admin', 'admin'].includes(role)) {
        return true;
      }

      // Check if permission is in user's permissions array
      const permission = `${resource}:${action}`;
      return businessUser.permissions.includes(permission);
    } catch (error) {
      this.logger.error(`Error checking user permission: ${error}`);
      return false;
    }
  }

  /**
   * Get all users with their roles (admin only)
   */
  async listUsers(
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ users: UserWithRole[]; total: number }> {
    try {
      const [users, total] = await Promise.all([
        this.prisma.user.findMany({
          take: limit,
          skip: offset,
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            emailVerified: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.user.count(),
      ]);

      // Fetch roles for all users in a single query
      const userIds = users.map(u => u.id);
      const businessUsers = await this.prisma.businessUser.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, role: true },
        orderBy: { createdAt: 'desc' },
        distinct: ['userId'], // Get the latest role for each user if multiple exist
      });

      // Create a map for faster lookup
      const roleMap = new Map(businessUsers.map(bu => [bu.userId, bu.role]));

      const usersWithRoles = users.map((user) => ({
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        name: user.name ?? undefined,
        image: user.image ?? undefined,
        role: roleMap.get(user.id) || 'staff',
      }));

      return { users: usersWithRoles, total };
    } catch (error) {
      this.logger.error(`Error listing users: ${error}`);
      throw new InternalServerErrorException('Failed to list users');
    }
  }

  /**
   * Update user role in a restaurant
   */
  async updateUserRole(
    userId: string,
    restaurantId: string,
    newRole: string,
  ): Promise<void> {
    try {
      const result = await this.prisma.businessUser.updateMany({
        where: { userId, restaurantId },
        data: { role: newRole },
      });

      if (result.count === 0) {
        throw new NotFoundException(`User ${userId} not found in restaurant ${restaurantId}`);
      }

      this.logger.log(
        `Updated role for user ${userId} in restaurant ${restaurantId} to ${newRole}`,
      );
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Error updating user role: ${error}`);
      throw new InternalServerErrorException('Failed to update user role');
    }
  }

  /**
   * Grant permission to user
   */
  async grantPermission(
    userId: string,
    restaurantId: string,
    permission: string,
  ): Promise<void> {
    try {
      const businessUser = await this.prisma.businessUser.findFirst({
        where: { userId, restaurantId },
      });

      if (!businessUser) {
        throw new NotFoundException('Business user not found');
      }

      const permissions = new Set(businessUser.permissions);
      permissions.add(permission);

      await this.prisma.businessUser.update({
        where: { id: businessUser.id },
        data: { permissions: Array.from(permissions) },
      });

      this.logger.log(
        `Granted permission ${permission} to user ${userId} in restaurant ${restaurantId}`,
      );
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Error granting permission: ${error}`);
      throw new InternalServerErrorException('Failed to grant permission');
    }
  }

  /**
   * Revoke permission from user
   */
  async revokePermission(
    userId: string,
    restaurantId: string,
    permission: string,
  ): Promise<void> {
    try {
      const businessUser = await this.prisma.businessUser.findFirst({
        where: { userId, restaurantId },
      });

      if (!businessUser) {
        throw new NotFoundException('Business user not found');
      }

      const permissions = new Set(businessUser.permissions);
      permissions.delete(permission);

      await this.prisma.businessUser.update({
        where: { id: businessUser.id },
        data: { permissions: Array.from(permissions) },
      });

      this.logger.log(
        `Revoked permission ${permission} from user ${userId} in restaurant ${restaurantId}`,
      );
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Error revoking permission: ${error}`);
      throw new InternalServerErrorException('Failed to revoke permission');
    }
  }

  /**
   * Ban user from system
   */
  async banUser(
    userId: string,
    reason?: string,
    expiresIn?: number,
  ): Promise<void> {
    try {
      const banExpires = expiresIn
        ? new Date(Date.now() + expiresIn * 1000)
        : null;

      const result = await this.prisma.businessUser.updateMany({
        where: { userId },
        data: {
          status: 'suspended',
        },
      });

      if (result.count === 0) {
        this.logger.warn(`Attempted to ban user ${userId} but no business user record found`);
        // We might want to ban the main user record too if business user doesn't exist
        // For now, assuming business user exists for all active users
      }

      this.logger.log(`Banned user ${userId}. Reason: ${reason || 'No reason'}`);
    } catch (error) {
      this.logger.error(`Error banning user: ${error}`);
      throw new InternalServerErrorException('Failed to ban user');
    }
  }

  /**
   * Unban user from system
   */
  async unbanUser(userId: string): Promise<void> {
    try {
      await this.prisma.businessUser.updateMany({
        where: { userId },
        data: {
          status: 'active',
        },
      });

      this.logger.log(`Unbanned user ${userId}`);
    } catch (error) {
      this.logger.error(`Error unbanning user: ${error}`);
      throw new InternalServerErrorException('Failed to unban user');
    }
  }

  /**
   * Verify user email
   */
  async verifyEmail(userId: string): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { emailVerified: true },
      });

      this.logger.log(`Verified email for user ${userId}`);
    } catch (error) {
      this.logger.error(`Error verifying email: ${error}`);
      throw new InternalServerErrorException('Failed to verify email');
    }
  }

  /**
   * Get user notification preferences
   */
  async getUserPreferences(userId: string): Promise<Record<string, boolean>> {
    const defaultPreferences = {
      emailNotifications: true,
      orderAlerts: true,
      paymentAlerts: true,
      securityAlerts: true,
      weeklyDigest: true,
      marketingEmails: false,
      pushNotifications: false,
    };

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { preferences: true },
      });

      return { ...defaultPreferences, ...(user?.preferences as Record<string, boolean> || {}) };
    } catch (error) {
      this.logger.error(`Error getting preferences: ${error}`);
      return defaultPreferences;
    }
  }

  /**
   * Update user notification preferences
   */
  async updateUserPreferences(
    userId: string,
    preferences: Record<string, boolean>,
  ): Promise<Record<string, boolean>> {
    try {
      const existing = await this.getUserPreferences(userId);
      const merged = { ...existing, ...preferences };

      await this.prisma.user.update({
        where: { id: userId },
        data: { preferences: merged },
      });

      this.logger.log(`Updated preferences for user ${userId}`);
      return merged;
    } catch (error) {
      this.logger.error(`Error updating preferences: ${error}`);
      throw new InternalServerErrorException('Failed to update preferences');
    }
  }
}
