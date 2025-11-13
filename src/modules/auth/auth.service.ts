import { Injectable, Logger } from '@nestjs/common';
import { AuthService as BetterAuthService } from '@thallesp/nestjs-better-auth';
import { PrismaService } from '../prisma/prisma.service';
import { auth } from 'src/lib/auth/auth.config';

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
    private betterAuthService: BetterAuthService<typeof auth>,
  ) {}

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
      throw error;
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
      throw error;
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
      const users = await this.prisma.user.findMany({
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
      });

      const total = await this.prisma.user.count();

      // Fetch roles for all users
      const usersWithRoles = await Promise.all(
        users.map(async (user) => {
          const businessUser = await this.prisma.businessUser.findFirst({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' },
            select: { role: true },
          });
          return {
            id: user.id,
            email: user.email,
            emailVerified: user.emailVerified,
            name: user.name ?? undefined,
            image: user.image ?? undefined,
            role: businessUser?.role || 'staff',
          };
        }),
      );

      return { users: usersWithRoles, total };
    } catch (error) {
      this.logger.error(`Error listing users: ${error}`);
      throw error;
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
      await this.prisma.businessUser.updateMany({
        where: { userId, restaurantId },
        data: { role: newRole },
      });

      this.logger.log(
        `Updated role for user ${userId} in restaurant ${restaurantId} to ${newRole}`,
      );
    } catch (error) {
      this.logger.error(`Error updating user role: ${error}`);
      throw error;
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
        throw new Error('Business user not found');
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
      this.logger.error(`Error granting permission: ${error}`);
      throw error;
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
        throw new Error('Business user not found');
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
      this.logger.error(`Error revoking permission: ${error}`);
      throw error;
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

      await this.prisma.businessUser.updateMany({
        where: { userId },
        data: {
          status: 'suspended',
        },
      });

      this.logger.log(`Banned user ${userId}. Reason: ${reason || 'No reason'}`);
    } catch (error) {
      this.logger.error(`Error banning user: ${error}`);
      throw error;
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
      throw error;
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
      throw error;
    }
  }
}
