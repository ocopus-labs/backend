# Better Auth NestJS Integration Guide

## ✅ What's Been Implemented

A comprehensive authentication and authorization system using **Better Auth** with the official **@thallesp/nestjs-better-auth** integration package.

## 📦 Project Structure

```
src/
├── lib/
│   ├── auth/
│   │   ├── auth.config.ts          # Better Auth configuration
│   │   ├── roles.constants.ts      # Role & permission definitions
│   │   ├── business-adapter.ts     # Multi-business type adapter
│   │   └── index.ts                # Exports with auth decorators/guards
│   └── common/
│       ├── decorators/
│       │   ├── roles.decorator.ts  # Custom roles decorator
│       │   └── index.ts            # Re-exports from nestjs-better-auth
│       └── guards/
│           ├── roles.guard.ts      # Custom roles guard
│           └── index.ts            # Re-exports AuthGuard
└── modules/
    └── auth/
        ├── auth.module.ts          # NestJS Auth module with Better Auth
        ├── auth.service.ts         # Auth business logic
        ├── auth.controller.ts      # Auth API endpoints
        └── index.ts                # Barrel exports
```

## 🔐 Features Implemented

### 1. Authentication Methods
✅ **Email & Password** (8-128 character validation)  
✅ **Email Verification** (via Resend mail service)  
✅ **Email OTP** (6-digit, 5-minute expiry)  
✅ **Password Reset**  
✅ **Session Management** (7-day expiry, 1-day refresh)

### 2. NestJS Better Auth Integration
✅ **Global AuthGuard** - All routes protected by default  
✅ **@AllowAnonymous()** - Decorator for public routes  
✅ **@OptionalAuth()** - Decorator for optional authentication  
✅ **@Roles([...])** - Decorator for role-based access  
✅ **@Session()** - Parameter decorator to access user session  
✅ **Hook Decorators** - @Hook, @BeforeHook, @AfterHook for custom logic  
✅ **Type-safe AuthService** - Full Better Auth API access with TypeScript

### 3. Role-Based Access Control
### 3. Role-Based Access Control
✅ **super_admin** - Full system access  
✅ **franchise_owner** - Manage franchises & users  
✅ **restaurant_owner** - Manage their restaurant  
✅ **manager** - Day-to-day operations  
✅ **staff** - Basic operational access  
✅ **viewer** - Read-only access  
✅ **accountant** - Financial operations

### 4. Permission Management
### 4. Permission Management
✅ Resource-based permissions (resource:action)  
✅ Dynamic permission assignment  
✅ Permission validation  
✅ Role-to-permission mapping  
✅ 7 resource types with 30+ permissions

### 5. User Management
### 5. User Management
✅ List users (with pagination & role filtering)  
✅ Get user by ID  
✅ Update user role  
✅ Grant/revoke permissions  
✅ Ban/unban users  
✅ Email verification  
✅ Profile access

### 6. Security Features
### 6. Security Features
✅ Password hashing (scrypt algorithm)  
✅ Secure session tokens  
✅ Email verification required  
✅ User banning system  
✅ Global route protection  
✅ Role-based access control  
✅ Permission-based access control

## 🚀 Quick Start

### 1. Install Package

```bash
# Already installed in package.json
npm install @thallesp/nestjs-better-auth
# or
pnpm add @thallesp/nestjs-better-auth
```

### 2. Configure main.ts

Disable body parser to allow Better Auth to handle raw request body:

```typescript title="src/main.ts"
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false, // Required for Better Auth
  });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

### 3. Import AuthModule

```typescript title="src/modules/auth/auth.module.ts"
import { Module } from '@nestjs/common';
import { AuthModule as NestJSBetterAuthModule } from '@thallesp/nestjs-better-auth';
import { auth } from '../../lib/auth/auth.config';

@Module({
  imports: [
    NestJSBetterAuthModule.forRoot({
      auth,
      disableGlobalAuthGuard: false, // Global protection enabled
    }),
  ],
})
export class AuthModule {}
```

## 🔧 Route Protection

### Global Protection (Default)

All routes are protected by default. Use decorators to control access:

```typescript title="src/modules/auth/auth.controller.ts"
import { Controller, Get } from '@nestjs/common';
import { 
  AllowAnonymous, 
  OptionalAuth, 
  Roles,
  Session 
} from '@thallesp/nestjs-better-auth';
import { USER_ROLES } from 'src/lib/auth';

@Controller('auth')
export class AuthController {
  // ✅ Public route - no authentication required
  @Get('public')
  @AllowAnonymous()
  async publicRoute() {
    return { message: 'This is public' };
  }

  // ✅ Optional authentication - session available if authenticated
  @Get('optional')
  @OptionalAuth()
  async optionalRoute(@Session() session) {
    return { authenticated: !!session };
  }

  // ✅ Protected route - authentication required (default)
  @Get('profile')
  async getProfile(@Session() session) {
    return { user: session.user };
  }

  // ✅ Admin only - role-based access control
  @Get('users')
  @Roles([USER_ROLES.SUPER_ADMIN, USER_ROLES.FRANCHISE_OWNER])
  async listUsers() {
    return { users: [] };
  }
}
```

### Controller-Level Decorators

Apply decorators to entire controllers:

```typescript
import { Controller, Get } from '@nestjs/common';
import { AllowAnonymous, Roles } from '@thallesp/nestjs-better-auth';

// All routes in this controller are public
@AllowAnonymous()
@Controller('public')
export class PublicController {
  @Get('info')
  async getInfo() {
    return { info: 'Public info' };
  }
}

// All routes require admin role
@Roles(['super_admin'])
@Controller('admin')
export class AdminController {
  @Get('dashboard')
  async getDashboard() {
    return { dashboard: 'Admin dashboard' };
  }
}
```

## 🎯 Available Decorators

### @Session() - Access User Session

```typescript
import { Session } from '@thallesp/nestjs-better-auth';

@Get('me')
async getProfile(@Session() session) {
  return {
    userId: session.user.id,
    email: session.user.email,
    role: session.user.role,
  };
}
```

### @AllowAnonymous() - Public Route

```typescript
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

@Get('health')
@AllowAnonymous()
async healthCheck() {
  return { status: 'ok' };
}
```

### @OptionalAuth() - Optional Authentication

```typescript
import { OptionalAuth, Session } from '@thallesp/nestjs-better-auth';

@Get('feed')
@OptionalAuth()
async getFeed(@Session() session) {
  // session will be null if not authenticated
  if (session) {
    return { feed: 'personalized', userId: session.user.id };
  }
  return { feed: 'public' };
}
```

### @Roles([...]) - Role-Based Access

```typescript
import { Roles } from '@thallesp/nestjs-better-auth';
import { USER_ROLES } from 'src/lib/auth';

@Post('users/:id/ban')
@Roles([USER_ROLES.SUPER_ADMIN, USER_ROLES.FRANCHISE_OWNER])
async banUser(@Param('id') id: string) {
  // Only super admins and franchise owners can ban users
}
```

## 🪝 Custom Hooks

Better Auth supports custom hooks for lifecycle events. Enable hooks in your config:

```typescript title="src/lib/auth/auth.config.ts"
import { betterAuth } from 'better-auth';

export const auth = betterAuth({
  // ... other config
  hooks: {}, // Minimum required for hook decorators
});
```

### Create Custom Hook

```typescript title="src/modules/auth/hooks/sign-up.hook.ts"
import { Injectable } from '@nestjs/common';
import { 
  Hook, 
  BeforeHook, 
  AuthHookContext 
} from '@thallesp/nestjs-better-auth';
import { MailService } from 'src/modules/mail';

@Hook()
@Injectable()
export class SignUpHook {
  constructor(private mailService: MailService) {}

  @BeforeHook('/sign-up/email')
  async beforeSignUp(ctx: AuthHookContext) {
    const { body } = ctx;
    
    // Custom validation: Only allow company emails
    if (!body.email.endsWith('@company.com')) {
      throw new Error('Only company emails are allowed');
    }
  }

  @AfterHook('/sign-up/email')
  async afterSignUp(ctx: AuthHookContext) {
    // Send welcome email
    await this.mailService.send({
      to: ctx.body.email,
      subject: 'Welcome!',
      html: '<h1>Welcome to our platform!</h1>',
    });
  }
}
```

### Register Hook

```typescript title="src/modules/auth/auth.module.ts"
import { Module } from '@nestjs/common';
import { SignUpHook } from './hooks/sign-up.hook';

@Module({
  // ... other config
  providers: [SignUpHook],
})
export class AuthModule {}
```

## 🔌 AuthService Integration

Inject `AuthService` to access the Better Auth API:

```typescript title="src/modules/auth/auth.service.ts"
import { Injectable } from '@nestjs/common';
import { AuthService as BetterAuthService } from '@thallesp/nestjs-better-auth';
import { auth } from 'src/lib/auth/auth.config';
import { fromNodeHeaders } from 'better-auth/node';

@Injectable()
export class AuthService {
  constructor(
    private betterAuthService: BetterAuthService<typeof auth>,
  ) {}

  async getUserAccounts(req: Request) {
    // Access Better Auth API with type safety
    const accounts = await this.betterAuthService.api.listUserAccounts({
      headers: fromNodeHeaders(req.headers),
    });
    return accounts;
  }

  async createApiKey(body: any, req: Request) {
    // Plugin-specific methods are type-safe too
    return this.betterAuthService.api.createApiKey({
      ...body,
      headers: fromNodeHeaders(req.headers),
    });
  }
}
```

## 📖 Request Object Access

Access session and user through the request object:

```typescript
import { Controller, Get, Request } from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';

@Controller('users')
export class UserController {
  @Get('me')
  async getProfile(@Request() req: ExpressRequest) {
    return {
      session: req.session, // Full session object
      user: req.user,       // User object (for observability)
    };
  }
}
```

## 🎯 API Endpoints

### Better Auth Endpoints (Auto-generated)

The following endpoints are automatically available at `/api/auth`:

**Authentication**
- `POST /api/auth/sign-up/email` - Register new user
- `POST /api/auth/sign-in/email` - Login with email/password
- `POST /api/auth/sign-out` - Logout
- `GET /api/auth/session` - Get current session
- `POST /api/auth/refresh` - Refresh session token

**Email OTP**
- `POST /api/auth/email-otp/send-verification-otp` - Send OTP to email
- `POST /api/auth/email-otp/verify-email` - Verify email with OTP

**Password Management**
- `POST /api/auth/forget-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token

**Admin Plugin**
- `POST /api/auth/admin/ban-user` - Ban user (admin only)
- `POST /api/auth/admin/unban-user` - Unban user (admin only)
- `POST /api/auth/admin/impersonate` - Impersonate user (admin only)
- `POST /api/auth/admin/stop-impersonating` - Stop impersonation

### Custom Auth Endpoints

Additional endpoints in `AuthController`:

**User Management**
- `GET /auth/profile` - Get current user profile
- `GET /auth/users` - List all users (admin only)
- `GET /auth/users/:userId` - Get user by ID (admin only)

**Role & Permission Management**
- `POST /auth/users/:userId/role` - Update user role
- `POST /auth/users/:userId/permissions/grant` - Grant permission
- `POST /auth/users/:userId/permissions/revoke` - Revoke permission
- `GET /auth/permissions/check` - Check if user has permission

**User Actions**
- `POST /auth/users/:userId/ban` - Ban user (admin only)
- `POST /auth/users/:userId/unban` - Unban user (admin only)
- `POST /auth/verify-email` - Manually verify email (admin only)

## 🔌 Integration Points

### Email Service Integration

The auth system automatically sends emails via Resend for:
- **Email verification** - OTP sent on registration
- **Password reset** - Link sent when requested
- **OTP delivery** - For sign-in and verification

Configuration in `auth.config.ts`:

```typescript
import { MailService } from '../../modules/mail/mail.service';

let mailService: MailService;

export function setMailService(service: MailService) {
  mailService = service;
}

export const auth = betterAuth({
  // ... other config
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      if (mailService) {
        await mailService.sendVerificationEmail(user.email, url);
      }
    },
  },
  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        if (mailService) {
          await mailService.send({
            to: email,
            subject: type === 'sign-in' ? 'Sign-In OTP' : 'Verify Email',
            html: `<p>Your OTP: <strong>${otp}</strong></p>`,
          });
        }
      },
    }),
  ],
});
```

### Database Integration

Uses **Prisma ORM** with PostgreSQL:

**Better Auth Tables** (auto-created):
- `user` - User accounts
- `session` - Active sessions
- `verification` - Email verification tokens
- `account` - OAuth accounts (if using social auth)

**Custom Tables**:
- `BusinessUser` - Links users to businesses with roles/permissions

```prisma
model BusinessUser {
  id           String   @id @default(cuid())
  userId       String
  restaurantId String
  role         String   @default("staff")
  permissions  String[] @default([])
  status       String   @default("active")
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  user       User       @relation(fields: [userId], references: [id])
  restaurant Restaurant @relation(fields: [restaurantId], references: [id])

  @@unique([userId, restaurantId])
}
```

## 🚀 Environment Configuration

Required environment variables:

```env
# Better Auth Configuration
BETTER_AUTH_SECRET=your-secret-key-min-32-chars
AUTH_BASE_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/billing_db

# Email Service (Resend)
RESEND_API_KEY=re_your_api_key
MAIL_FROM=noreply@yourdomain.com

# Optional
NODE_ENV=development
PORT=3000
```

### Environment Variable Details

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `BETTER_AUTH_SECRET` | ✅ Yes | Secret key for signing tokens (min 32 chars) | `your-secret-key-change-in-prod` |
| `AUTH_BASE_URL` | ✅ Yes | Base URL of your application | `http://localhost:3000` |
| `DATABASE_URL` | ✅ Yes | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/db` |
| `RESEND_API_KEY` | ✅ Yes | Resend API key for emails | `re_xxxxxxxxxxxxx` |
| `MAIL_FROM` | ✅ Yes | Sender email address | `noreply@yourdomain.com` |
| `NODE_ENV` | ❌ No | Environment mode | `development`, `production` |
| `PORT` | ❌ No | Server port | `3000` |

## 📋 Usage Examples

### 1. Access User Session in Controller

```typescript
import { Controller, Get } from '@nestjs/common';
import { Session } from '@thallesp/nestjs-better-auth';

@Controller('orders')
export class OrdersController {
  @Get()
  async getOrders(@Session() session) {
    const userId = session.user.id;
    const userRole = session.user.role;
    
    // Fetch orders for this user
    return { orders: [], userId, role: userRole };
  }
}
```

### 2. Check Permissions in Service

```typescript
import { Injectable } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class OrdersService {
  constructor(private authService: AuthService) {}

  async createOrder(userId: string, restaurantId: string) {
    // Check if user has permission
    const canCreate = await this.authService.userHasPermission(
      userId,
      'order',
      'create',
    );

    if (!canCreate) {
      throw new ForbiddenException('No permission to create orders');
    }

    // Create order logic
  }
}
```

### 3. Use Role Constants

```typescript
import { USER_ROLES, hasPermission } from 'src/lib/auth';

// Check role hierarchy
if (hasPermission(USER_ROLES.MANAGER, 'operations:create')) {
  // Manager can create operations
}

// Use in decorators
@Roles([USER_ROLES.SUPER_ADMIN, USER_ROLES.FRANCHISE_OWNER])
async adminRoute() {
  // Admin-only logic
}
```

### 4. Better Auth API Access

```typescript
import { Injectable } from '@nestjs/common';
import { AuthService as BetterAuthService } from '@thallesp/nestjs-better-auth';
import { auth } from 'src/lib/auth/auth.config';
import { fromNodeHeaders } from 'better-auth/node';

@Injectable()
export class UserService {
  constructor(
    private betterAuth: BetterAuthService<typeof auth>,
  ) {}

  async listAccounts(req: Request) {
    const accounts = await this.betterAuth.api.listUserAccounts({
      headers: fromNodeHeaders(req.headers),
    });
    return accounts;
  }
}
```

### 5. Custom Hook Example

```typescript
import { Injectable } from '@nestjs/common';
import { Hook, BeforeHook, AuthHookContext } from '@thallesp/nestjs-better-auth';
import { PrismaService } from '../prisma/prisma.service';

@Hook()
@Injectable()
export class UserRegistrationHook {
  constructor(private prisma: PrismaService) {}

  @BeforeHook('/sign-up/email')
  async validateRegistration(ctx: AuthHookContext) {
    const { email } = ctx.body;

    // Check if email domain is allowed
    if (!email.endsWith('@company.com')) {
      throw new Error('Only company emails allowed');
    }

    // Check if email is already in use
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new Error('Email already registered');
    }
  }

  @AfterHook('/sign-up/email')
  async afterRegistration(ctx: AuthHookContext) {
    const { user } = ctx.returned;

    // Create default business user entry
    await this.prisma.businessUser.create({
      data: {
        userId: user.id,
        restaurantId: 'default',
        role: 'staff',
      },
    });
  }
}
```

## 🔄 Authentication Flow

### 1. User Registration
```
User → POST /api/auth/sign-up/email
      ↓
Email verification OTP sent
      ↓
User → POST /api/auth/email-otp/verify-email (with OTP)
      ↓
Account verified & session created
```

### 2. User Login
```
User → POST /api/auth/sign-in/email
      ↓
Credentials validated
      ↓
Session created (7-day expiry)
      ↓
Session token returned in cookie
```

### 3. Password Reset
```
User → POST /api/auth/forget-password
      ↓
Reset link sent to email
      ↓
User → POST /api/auth/reset-password (with token)
      ↓
Password updated
```

### 4. Session Management
```
Request → AuthGuard checks session
        ↓
Session valid? → Proceed to route
        ↓
Session expired? → Refresh or re-authenticate
```

## 🛡️ Security Best Practices

### 1. Environment Variables
- ✅ Use strong secrets (min 32 chars)
- ✅ Store secrets in `.env.local` (gitignored)
- ✅ Use different secrets for dev/prod
- ✅ Enable `useSecureCookies` in production

### 2. Role-Based Access
- ✅ Use `@Roles([...])` for admin routes
- ✅ Check permissions in service layer too
- ✅ Follow principle of least privilege
- ✅ Regularly audit user permissions

### 3. Email Verification
- ✅ Require email verification for sensitive actions
- ✅ Implement OTP expiry (5 minutes)
- ✅ Rate-limit OTP requests
- ✅ Log failed verification attempts

### 4. Session Management
- ✅ 7-day session expiry (configurable)
- ✅ 1-day refresh interval
- ✅ Secure cookies in production
- ✅ Session invalidation on logout

### 5. Password Security
- ✅ Min 8 chars, max 128 chars
- ✅ Hashed with scrypt algorithm
- ✅ Password reset via email only
- ✅ No password exposure in logs/errors

## 🎓 Next Steps

### 1. Add More Guards
Create custom guards for business-specific logic:

```typescript
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

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
```

### 2. Implement Rate Limiting
Protect against brute force attacks:

```typescript
import { ThrottlerGuard } from '@nestjs/throttler';

@UseGuards(ThrottlerGuard)
@Post('sign-in/email')
async signIn() {
  // Rate-limited endpoint
}
```

### 3. Add Audit Logging
Track important auth events:

```typescript
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    console.log(`${request.user?.email} accessed ${request.url}`);
    return next.handle();
  }
}
```

### 4. Social Authentication
Add OAuth providers:

```typescript
export const auth = betterAuth({
  // ... other config
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    },
  },
});
```

### 5. Two-Factor Authentication
Enhance security with 2FA:

```typescript
import { twoFactor } from 'better-auth/plugins';

export const auth = betterAuth({
  // ... other config
  plugins: [
    twoFactor({
      // 2FA configuration
    }),
  ],
});
```

## 📚 Additional Resources

### Official Documentation
- **Better Auth**: https://www.better-auth.com/docs
- **NestJS Better Auth**: https://github.com/ThallesP/nestjs-better-auth
- **NestJS**: https://docs.nestjs.com
- **Prisma**: https://www.prisma.io/docs

### Related Guides
- `docs/guides/multi-business-architecture.md` - Multi-tenant setup
- `docs/guides/business-unification.md` - Business type abstraction
- `docs/guides/mail-setup.md` - Email service integration
- `docs/project-structure.md` - Project organization

### Package Documentation
- `@thallesp/nestjs-better-auth` - [NPM](https://www.npmjs.com/package/@thallesp/nestjs-better-auth)
- `better-auth` - [NPM](https://www.npmjs.com/package/better-auth)
- `resend` - [Docs](https://resend.com/docs)


## ✨ Key Features Summary

✅ **Production-Ready** - Follows NestJS & Better Auth best practices  
✅ **Secure by Default** - Global auth guard, password hashing, email verification  
✅ **Type-Safe** - Full TypeScript support with Better Auth API  
✅ **Scalable** - Multi-tenant support with role & permission system  
✅ **Flexible** - Easy to add new roles, permissions, and providers  
✅ **Well-Documented** - Comprehensive guides and inline documentation  
✅ **Integrated** - Seamless mail service and database integration  
✅ **Extensible** - Hook system for custom logic at any lifecycle stage

## 🐛 Troubleshooting

### Issue: Body parser conflicts
**Solution**: Ensure `bodyParser: false` in `main.ts`:
```typescript
const app = await NestFactory.create(AppModule, {
  bodyParser: false,
});
```

### Issue: Session not persisting
**Solution**: Check cookie settings in Better Auth config:
```typescript
advanced: {
  useSecureCookies: process.env.NODE_ENV === 'production',
}
```

### Issue: Email not sending
**Solution**: Verify Resend API key and mail service injection:
```typescript
// In auth.module.ts
onModuleInit() {
  setMailService(this.mailService);
}
```

### Issue: Permission denied errors
**Solution**: Check if user has the required role:
```typescript
// Add @Roles decorator
@Roles([USER_ROLES.SUPER_ADMIN])
async adminRoute() { }
```

### Issue: TypeScript errors with AuthService
**Solution**: Use generic type with auth instance:
```typescript
constructor(
  private authService: AuthService<typeof auth>,
) {}
```

## 📞 Support & Contributions

For issues, questions, or contributions:

- **Better Auth Issues**: https://github.com/better-auth/better-auth/issues
- **NestJS Better Auth Issues**: https://github.com/ThallesP/nestjs-better-auth/issues
- **Project Issues**: Create an issue in your repository

---

**Last Updated**: November 2025  
**Version**: @thallesp/nestjs-better-auth v2.1.0  
**Better Auth**: >= v1.3.8

## �️ Development & Testing

### Run the Application

```bash
# Install dependencies
pnpm install

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Start development server
pnpm run start:dev
```

### Test Authentication Endpoints

```bash
# Register new user
curl -X POST http://localhost:3000/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123",
    "name": "John Doe"
  }'

# Sign in
curl -X POST http://localhost:3000/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123"
  }'

# Get current session
curl -X GET http://localhost:3000/api/auth/session \
  -H "Cookie: better-auth.session_token=YOUR_SESSION_TOKEN"

# Get profile (custom endpoint)
curl -X GET http://localhost:3000/auth/profile \
  -H "Cookie: better-auth.session_token=YOUR_SESSION_TOKEN"
```

### Check Errors

```bash
# View compile errors
pnpm run build

# Run linter
pnpm run lint

# Check Prisma schema
npx prisma validate
```

## 📞 Support

For issues or questions about:
- Better Auth: https://www.better-auth.com/docs
- NestJS Better Auth: https://github.com/ThallesP/nestjs-better-auth
- Resend: https://resend.com/docs
