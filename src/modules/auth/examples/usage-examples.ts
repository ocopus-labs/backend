/**
 * Better Auth NestJS Integration - Usage Examples
 * 
 * ⚠️ NOTE: This file is for REFERENCE ONLY and contains example patterns.
 * It is not meant to be compiled or run directly.
 * Copy the patterns you need into your actual controller/service files.
 * 
 * This file demonstrates common patterns for using Better Auth in your NestJS application.
 */

/* eslint-disable */
// @ts-nocheck

import { Controller, Get, Post, Body, UseGuards, Injectable } from '@nestjs/common';
import { 
  Session, 
  AllowAnonymous, 
  OptionalAuth, 
  Roles,
  AuthGuard,
} from 'src/lib/auth';
import { AuthService as BetterAuthService } from '@thallesp/nestjs-better-auth';
import { auth } from 'src/lib/auth/auth.config';
import { USER_ROLES } from 'src/lib/auth/roles.constants';

// =============================================================================
// Example 1: Basic Controller with Global Auth Guard
// =============================================================================

@Controller('protected')
export class ProtectedController {
  // All routes are protected by default (global guard is enabled)
  
  @Get('data')
  async getProtectedData(@Session() session) {
    return {
      message: 'This data is protected',
      userId: session.user.id,
      email: session.user.email,
    };
  }
}

// =============================================================================
// Example 2: Public Routes with @AllowAnonymous
// =============================================================================

@Controller('public')
export class PublicController {
  @Get('health')
  @AllowAnonymous()
  async healthCheck() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('info')
  @AllowAnonymous()
  async getInfo() {
    return {
      name: 'Billing Platform API',
      version: '1.0.0',
    };
  }
}

// =============================================================================
// Example 3: Optional Authentication with @OptionalAuth
// =============================================================================

@Controller('content')
export class ContentController {
  @Get('feed')
  @OptionalAuth()
  async getFeed(@Session() session) {
    if (session) {
      // Return personalized feed for authenticated users
      return {
        feed: 'personalized',
        userId: session.user.id,
        recommendations: [],
      };
    }
    
    // Return public feed for anonymous users
    return {
      feed: 'public',
      recommendations: [],
    };
  }
}

// =============================================================================
// Example 4: Role-Based Access Control with @Roles
// =============================================================================

@Controller('admin')
export class AdminController {
  // Single role
  @Get('dashboard')
  @Roles([USER_ROLES.SUPER_ADMIN])
  async getDashboard() {
    return { dashboard: 'Admin dashboard data' };
  }

  // Multiple roles allowed
  @Get('reports')
  @Roles([USER_ROLES.SUPER_ADMIN, USER_ROLES.FRANCHISE_OWNER, USER_ROLES.RESTAURANT_OWNER])
  async getReports() {
    return { reports: [] };
  }

  // Controller-level role requirement
  @Post('users/ban')
  @Roles([USER_ROLES.SUPER_ADMIN, USER_ROLES.FRANCHISE_OWNER])
  async banUser(@Body() body: { userId: string; reason: string }) {
    return { message: 'User banned successfully' };
  }
}

// =============================================================================
// Example 5: Using Better Auth Service API
// =============================================================================

@Injectable()
export class UserManagementService {
  constructor(
    private betterAuthService: BetterAuthService<typeof auth>,
  ) {}

  async listUserAccounts(req: Request) {
    // Access Better Auth API with full type safety
    const accounts = await this.betterAuthService.api.listUserAccounts({
      headers: req.headers,
    });
    return accounts;
  }

  async banUserFromAuth(userId: string, reason: string) {
    // Use admin plugin methods
    await this.betterAuthService.api.banUser({
      userId,
      reason,
      banUntil: undefined, // Permanent ban
    });
  }
}

// =============================================================================
// Example 6: Accessing Session from Request Object
// =============================================================================

@Controller('orders')
export class OrdersController {
  @Get()
  async getOrders(@Request() req) {
    // Session is attached to request
    const session = req.session;
    const user = req.user; // Direct user reference
    
    return {
      userId: user.id,
      email: user.email,
      orders: [],
    };
  }
}

// =============================================================================
// Example 7: Custom Guards with AuthGuard
// =============================================================================

@Injectable()
export class BusinessOwnerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const businessId = request.params.businessId;

    // Check if user owns this business
    return user.businessId === businessId;
  }
}

@Controller('businesses')
@UseGuards(AuthGuard) // Explicit guard usage
export class BusinessController {
  @Get(':businessId')
  @UseGuards(BusinessOwnerGuard)
  async getBusiness(@Param('businessId') businessId: string) {
    // Only accessible by business owner
    return { businessId };
  }
}

// =============================================================================
// Example 8: Permission Checks in Service Layer
// =============================================================================

@Injectable()
export class OrderService {
  constructor(private authService: AuthService) {}

  async createOrder(userId: string, restaurantId: string, orderData: any) {
    // Check permission before proceeding
    const canCreate = await this.authService.userHasPermission(
      userId,
      'order',
      'create',
    );

    if (!canCreate) {
      throw new ForbiddenException('You do not have permission to create orders');
    }

    // Create order logic
    return { orderId: '123', ...orderData };
  }
}

// =============================================================================
// Example 9: Controller with Mixed Access Levels
// =============================================================================

@Controller('restaurants')
export class RestaurantController {
  // Public route
  @Get()
  @AllowAnonymous()
  async listRestaurants() {
    return { restaurants: [] };
  }

  // Protected route
  @Get(':id')
  async getRestaurant(@Param('id') id: string, @Session() session) {
    return {
      restaurantId: id,
      viewedBy: session.user.email,
    };
  }

  // Admin only
  @Post()
  @Roles([USER_ROLES.SUPER_ADMIN, USER_ROLES.FRANCHISE_OWNER])
  async createRestaurant(@Body() data: any) {
    return { message: 'Restaurant created' };
  }

  // Owner or admin only
  @Put(':id')
  @Roles([USER_ROLES.SUPER_ADMIN, USER_ROLES.FRANCHISE_OWNER, USER_ROLES.RESTAURANT_OWNER])
  async updateRestaurant(@Param('id') id: string, @Body() data: any) {
    return { message: 'Restaurant updated' };
  }
}

// =============================================================================
// Example 10: Using Role Constants
// =============================================================================

import { hasPermission, getRolePermissions } from 'src/lib/auth/roles.constants';

@Injectable()
export class PermissionService {
  checkUserAccess(userRole: string, resource: string, action: string): boolean {
    // Use utility function to check permissions
    const permission = `${resource}:${action}`;
    return hasPermission(userRole, permission);
  }

  getUserPermissions(role: string): string[] {
    // Get all permissions for a role
    return getRolePermissions(role);
  }
}

// =============================================================================
// Summary of Key Patterns:
// 
// 1. Global Protection: All routes protected by default
// 2. @AllowAnonymous(): Make specific routes public
// 3. @OptionalAuth(): Authentication optional, check session
// 4. @Roles([...]): Restrict access to specific roles
// 5. @Session(): Access user session in route handlers
// 6. AuthService<typeof auth>: Type-safe Better Auth API access
// 7. req.session / req.user: Access session from request
// 8. Custom Guards: Combine with AuthGuard for complex logic
// 9. Permission Checks: Validate permissions in service layer
// 10. Role Constants: Use predefined USER_ROLES constants
// =============================================================================
