# Copilot Instructions for Backend Codebase

## 🏗️ Architecture Overview

This is a **multi-tenant, multi-business-type billing platform** built with NestJS. The core design principle separates **NestJS modules** (`src/modules/`) from **shared utilities** (`src/lib/`).

### Core Systems
- **Authentication**: Better Auth with email/password, email verification, OTP, admin roles
- **Mail Service**: Resend email provider for transactional emails
- **RBAC**: Generic role-based system supporting multiple business types (restaurants, salons, gyms, clinics)
- **Database**: Prisma ORM with PostgreSQL, multi-tenant via `restaurantId` (being generalized to `businessId`)

## 📁 Folder Organization Rules

### ✅ CORRECT patterns
- **NestJS modules**: `src/modules/{feature}/` → Always create `.module.ts`, `.service.ts`, `.controller.ts`, `index.ts`
- **Shared utils**: `src/lib/{category}/` → Constants, adapters, decorators, guards (no @Module, no @Injectable)
- **Module config**: `src/modules/{feature}/config/` → Config files specific to that module
- **Module interfaces**: `src/modules/{feature}/interfaces/` → TypeScript types for that module only
- **Barrel exports**: Every `index.ts` file exports all public symbols for clean imports

### ❌ WRONG patterns
- Don't mix NestJS modules and utilities in the same folder
- Don't import utilities from `src/modules/` — import from `src/lib/`
- Don't create utilities directly in `src/` root
- Don't scatter utilities across modules — consolidate in `src/lib/`
- Don't create docs directly in root directory in uppercase it should be in docs folder with proper structure
- dont create docs for small fixes or changes

### Example: Adding a new module
```bash
# Create folder structure
mkdir -p src/modules/restaurants/{config,interfaces}

# Files to create
src/modules/restaurants/
  ├── restaurants.module.ts    # @Module decorator
  ├── restaurants.service.ts   # @Injectable
  ├── restaurants.controller.ts # @Controller
  ├── index.ts                 # export * from ...
  ├── config/
  └── interfaces/
```

## 🔐 Authentication & Authorization

### Multi-Role Hierarchy (in `src/lib/auth/roles.constants.ts`)
```
SUPER_ADMIN       → Manage all franchises, subscriptions, platform users
FRANCHISE_OWNER   → Manage restaurants in franchise, franchise staff/billing
BUSINESS_OWNER    → Manage their restaurant, staff, inventory
MANAGER           → Day-to-day operations (orders, payments)
STAFF             → Basic operations (create/read orders)
VIEWER            → Read-only access
ACCOUNTANT        → Financial operations only
```

### How to check permissions
```typescript
// Method 1: Use role constants from lib
import { hasPermission, USER_ROLES } from 'src/lib/auth';
hasPermission('manager', 'operations:create') // → true/false

// Method 2: For controllers, inject AuthService
constructor(private authService: AuthService) {}
const hasAccess = await this.authService.userHasPermission(userId, 'orders', 'create');
```

## 🏢 Multi-Business Architecture

**Key Insight**: System is designed for restaurants but being generalized to ANY business type (salons, gyms, clinics).

### Generic Resource Mapping (in `src/lib/auth/business-adapter.ts`)
```typescript
// Instead of hardcoding "order" for restaurants:
mapBusinessResource('restaurant', 'order', 'create')      // → 'operations:create'
mapBusinessResource('salon', 'appointment', 'create')     // → 'operations:create'
// Same permission, different business term!
```

**When adding features**:
1. Use generic terms: `operations`, `catalog`, `scheduling`, `inventory`, `billing`
2. Map business-specific terms through adapter
3. See `docs/guides/multi-business-architecture.md` for complete mapping

## 📧 Mail Service Integration

**Provider**: Resend (API-key based, configured in `.env` as `RESEND_API_KEY`)

**Location**: `src/modules/mail/` — Already integrated with Better Auth for verification emails

**How to use**:
```typescript
constructor(private mailService: MailService) {}

// Send email
await this.mailService.send({
  to: 'user@example.com',
  subject: 'Hello',
  html: '<p>Content</p>',
  text: 'Content'
});

// Verification email
await this.mailService.sendVerificationEmail(email, verificationLink);
```

## 🔧 Configuration & Environment

**Global config**: `ConfigModule.forRoot()` with `isGlobal: true` in `app.module.ts` — access via `@nestjs/config`

**Multi-env support**: Priority is `.env.local` > `.env` (see `app.module.ts`)

**Key variables**:
- `AUTH_BASE_URL` / `BETTER_AUTH_SECRET` — Better Auth setup
- `RESEND_API_KEY` — Email service
- `DATABASE_URL` — PostgreSQL connection

## 🗄️ Database (Prisma)

**Schema location**: `prisma/schema.prisma`

**Key models**:
- `User` — Better Auth users (email, verified status, profile)
- `BusinessUser` — Junction table linking User → Restaurant with role/permissions
- `Restaurant` — Main business entity (name, address, subscription, settings)
- Related: `Order`, `Payment`, `MenuItem`, `Table`, `InventoryItem`, `Expense`, etc.

**Multi-tenancy**: Currently uses `restaurantId` foreign key — being generalized to `businessId`

**Migrations**:
```bash
npx prisma migrate dev --name migration_name
npx prisma generate  # Regenerate Prisma client
```

## 🏗️ Build & Development

**Commands**:
```bash
pnpm install           # Install deps
pnpm run start:dev     # Hot-reload development
pnpm run build         # Compile to dist/
pnpm run lint          # ESLint + fix
pnpm test              # Jest unit tests
pnpm test:e2e          # End-to-end tests
```

**Build outputs**: All TypeScript compiles to `dist/` mirroring `src/` structure

**Important**: NestJS requires `bodyParser: false` in `main.ts` for Better Auth to access raw request body

## 📚 Documentation

- **`docs/README.md`** — Start here, links to all guides
- **`docs/project-structure.md`** — Detailed folder organization
- **`docs/guides/auth-setup.md`** — Better Auth implementation
- **`docs/guides/multi-business-architecture.md`** — Multi-type business system
- **`docs/guides/mail-setup.md`** — Email service setup

## ⚠️ Critical Patterns to Follow

1. **Module Imports**: Always export barrel index — `import { MailService } from 'src/modules/mail'` not from `.service.ts`
2. **Permissions**: Check against generic resources, not specific terms — allows multi-business support
3. **Database Queries**: Use Prisma, multi-tenant queries must include `restaurantId` filter
4. **Error Handling**: Let NestJS exception filters handle HTTP responses (throw `BadRequestException`, `ForbiddenException`, etc.)
5. **Type Safety**: Use Prisma-generated types for database models, custom interfaces in `src/lib/` or module `interfaces/`

## 🚫 Common Mistakes to Avoid

- ❌ Creating new modules in `src/` root instead of `src/modules/`
- ❌ Mixing @Injectable utilities with library constants
- ❌ Hardcoding business-specific terms (use business-adapter)
- ❌ Missing permission checks on business-modifying endpoints
- ❌ Forgetting `restaurantId` filter in Prisma queries (security issue!)
- ❌ Importing from module `.service.ts` instead of barrel `index.ts`

## 📖 How to Read the Codebase

1. Start: `src/app.module.ts` — See all imported modules
2. Auth system: `src/lib/auth/` — Understand roles/permissions first
3. Mail: `src/modules/mail/` — Already working, see as reference for new modules
4. Database: `prisma/schema.prisma` — Understand data structure
5. Features: Add to `src/modules/{new-feature}/`

---

**Last Updated**: November 2025 | Questions? Check `docs/` folder or read specific `.ts` files
