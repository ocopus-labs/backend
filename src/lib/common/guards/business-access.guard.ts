import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { BUSINESS_ROLES_KEY } from '../decorators/business-roles.decorator';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { hasPermission, type UserRole } from 'src/lib/auth/roles.constants';

@Injectable()
export class BusinessAccessGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const businessId = request.params?.businessId;

    // If no businessId param, this isn't a business-scoped endpoint — pass through
    if (!businessId) {
      return true;
    }

    const user = request.user;
    if (!user) {
      return true; // Let the auth guard handle unauthenticated users
    }

    // Check if user is a member of the business
    const businessUser = await this.prisma.businessUser.findFirst({
      where: {
        userId: user.id,
        restaurantId: businessId,
        status: 'active',
      },
    });

    if (!businessUser) {
      // Fallback: check franchise membership
      const business = await this.prisma.restaurant.findUnique({
        where: { id: businessId },
        select: { franchiseId: true },
      });

      if (business?.franchiseId) {
        const franchiseUser = await this.prisma.franchiseUser.findFirst({
          where: {
            userId: user.id,
            franchiseId: business.franchiseId,
            status: 'active',
          },
        });

        if (franchiseUser) {
          const mappedRole =
            franchiseUser.role === 'franchise_owner'
              ? 'franchise_owner'
              : franchiseUser.role;

          request.businessUser = {
            role: mappedRole,
            permissions: franchiseUser.permissions,
            franchiseAccess: true,
          };

          // Continue to role/permission checks below
        } else {
          throw new ForbiddenException(
            'You do not have access to this business',
          );
        }
      } else {
        throw new ForbiddenException('You do not have access to this business');
      }
    } else {
      // Attach business user info to request for downstream use
      request.businessUser = {
        role: businessUser.role,
        permissions: businessUser.permissions,
      };
    }

    const effectiveRole = request.businessUser.role;

    // Check business-specific role requirements
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      BUSINESS_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredRoles && requiredRoles.length > 0) {
      if (!requiredRoles.includes(effectiveRole)) {
        throw new ForbiddenException(
          'You do not have permission to perform this action',
        );
      }
    }

    // Check permission-based requirements
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredPermissions && requiredPermissions.length > 0) {
      const role = effectiveRole as UserRole;
      const hasAll = requiredPermissions.every((perm) =>
        hasPermission(role, perm),
      );
      if (!hasAll) {
        throw new ForbiddenException(
          'You do not have the required permissions for this action',
        );
      }
    }

    return true;
  }
}
