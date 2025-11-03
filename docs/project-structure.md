# Project Structure Guide

## Overview

This is a NestJS backend project with a clean, modular architecture that separates concerns into **modules** (NestJS-specific) and **lib** (shared utilities).

---

## Directory Structure

```
backend/
├── src/
│   ├── modules/                    # NestJS Modules (each module is self-contained)
│   │   ├── auth/                  # Authentication module
│   │   │   ├── auth.module.ts      # Module definition
│   │   │   ├── auth.service.ts     # Business logic
│   │   │   ├── auth.controller.ts  # HTTP endpoints
│   │   │   ├── index.ts            # Module exports
│   │   │   ├── config/             # Module-specific config
│   │   │   │   └── (configs will be here)
│   │   │   └── interfaces/         # Module-specific interfaces
│   │   │       └── (interfaces will be here)
│   │   │
│   │   └── mail/                   # Mail module
│   │       ├── mail.module.ts
│   │       ├── mail.service.ts
│   │       ├── mail.controller.ts
│   │       ├── mail-config.service.ts
│   │       ├── index.ts
│   │       ├── config/
│   │       │   └── mail.config.ts  # Resend API config
│   │       └── interfaces/
│   │           └── mail.interface.ts
│   │
│   ├── lib/                        # Shared utilities & helpers (NOT NestJS modules)
│   │   ├── auth/                   # Auth utilities
│   │   │   ├── auth.config.ts      # Better Auth configuration
│   │   │   ├── roles.constants.ts  # Role & permission definitions
│   │   │   ├── business-adapter.ts # Multi-business type adapter
│   │   │   └── index.ts            # Barrel export
│   │   │
│   │   ├── common/                 # Common utilities
│   │   │   ├── decorators/         # Custom decorators (when added)
│   │   │   ├── guards/             # Custom guards (when added)
│   │   │   ├── interceptors/       # Custom interceptors (when added)
│   │   │   └── index.ts
│   │   │
│   │   └── index.ts                # Main lib barrel export
│   │
│   ├── app.module.ts               # Root app module
│   ├── app.controller.ts           # Root controller
│   ├── app.service.ts              # Root service
│   └── main.ts                     # Application entry point
│
├── prisma/
│   ├── schema.prisma               # Database schema
│   └── dbml/
│       └── schema.dbml
│
├── docs/                            # Documentation (when created)
│   ├── ARCHITECTURE.md
│   ├── API.md
│   └── GUIDES/
│
├── test/
│   └── e2e tests
│
├── .env.example                    # Environment variables template
├── package.json
├── tsconfig.json
├── nest-cli.json
└── README.md
```

---

## Module Structure

Each module in `src/modules/` follows the NestJS pattern:

```
module/
├── module.ts          # NestJS @Module() decorator defining imports/exports
├── service.ts         # @Injectable() - business logic & database operations
├── controller.ts      # @Controller() - HTTP endpoints
├── index.ts           # Barrel export (export * from './service', etc.)
├── config/
│   └── module.config.ts  # Configuration specific to this module
└── interfaces/
    └── module.interface.ts  # TypeScript interfaces
```

### Example: AuthModule

```typescript
// src/modules/auth/auth.module.ts
@Module({
  imports: [MailModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
```

---

## Library Structure

The `lib/` folder contains **reusable utilities** that are NOT NestJS modules:

```
lib/
├── auth/
│   ├── auth.config.ts       # Better Auth configuration (reusable)
│   ├── roles.constants.ts   # Role definitions (shared across app)
│   ├── business-adapter.ts  # Multi-business type logic (reusable)
│   └── index.ts             # Barrel export
│
├── common/
│   ├── decorators/          # Custom decorators (@CurrentUser, etc.)
│   ├── guards/              # Custom guards (RoleGuard, etc.)
│   ├── interceptors/        # Custom interceptors (TransformInterceptor, etc.)
│   └── index.ts
│
└── index.ts                 # Main export
```

### When to use `lib/`:
- ✅ Utility functions
- ✅ Constants & enums
- ✅ Interfaces & types
- ✅ Configuration logic
- ✅ Business adapters
- ❌ NOT NestJS modules
- ❌ NOT services with @Injectable
- ❌ NOT controllers with @Controller

---

## Import Patterns

### ✅ CORRECT

```typescript
// Importing from modules
import { MailService } from 'src/modules/mail/mail.service';
import { MailModule } from 'src/modules/mail/mail.module';

// Importing from lib
import { mapBusinessResource } from 'src/lib/auth/business-adapter';
import { USER_ROLES, hasPermission } from 'src/lib/auth/roles.constants';

// Using barrel exports
import { AuthService } from 'src/modules/auth';
import { mapBusinessResource, USER_ROLES } from 'src/lib/auth';
```

### ❌ WRONG

```typescript
// Don't import util functions as if they're modules
import { MailService } from 'src/lib/mail/mail.service';

// Don't mix lib and module imports
import { roles } from 'src/modules/auth/roles.constants';
```

---

## Adding New Modules

When adding a new feature module (e.g., `restaurants`):

```bash
mkdir -p src/modules/restaurants/{config,interfaces}
```

Create the following files:

```typescript
// src/modules/restaurants/restaurants.module.ts
@Module({
  controllers: [RestaurantsController],
  providers: [RestaurantsService],
  exports: [RestaurantsService],
})
export class RestaurantsModule {}

// src/modules/restaurants/restaurants.service.ts
@Injectable()
export class RestaurantsService { ... }

// src/modules/restaurants/restaurants.controller.ts
@Controller('restaurants')
export class RestaurantsController { ... }

// src/modules/restaurants/index.ts
export * from './restaurants.service';
export * from './restaurants.module';
export * from './restaurants.controller';
```

Then import in `app.module.ts`:

```typescript
@Module({
  imports: [MailModule, AuthModule, RestaurantsModule],
  ...
})
export class AppModule {}
```

---

## Adding New Utilities to `lib/`

When adding utilities (decorators, guards, etc.):

```bash
mkdir -p src/lib/common/decorators
mkdir -p src/lib/common/guards
```

Create files:

```typescript
// src/lib/common/decorators/current-user.decorator.ts
export const CurrentUser = () => Param('userId');

// src/lib/common/guards/role.guard.ts
@Injectable()
export class RoleGuard implements CanActivate { ... }

// src/lib/common/decorators/index.ts
export * from './current-user.decorator';

// src/lib/common/guards/index.ts
export * from './role.guard';

// src/lib/common/index.ts
export * from './decorators';
export * from './guards';
```

---

## File Organization Checklist

- ✅ All NestJS modules in `src/modules/`
- ✅ Module structure: `.module.ts`, `.service.ts`, `.controller.ts`, `index.ts`
- ✅ Shared config/interfaces in module subdirectories
- ✅ Utilities/constants in `src/lib/`
- ✅ Barrel exports in `index.ts` for easy imports
- ✅ No mix of modules and utilities in same directory
- ✅ Database models in `prisma/schema.prisma`
- ✅ Tests in `test/` folder

---

## Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Module class | `[Feature]Module` | `AuthModule`, `MailModule` |
| Service class | `[Feature]Service` | `AuthService`, `MailService` |
| Controller class | `[Feature]Controller` | `AuthController`, `MailController` |
| Interface file | `.interface.ts` | `mail.interface.ts` |
| Constants file | `.constants.ts` | `roles.constants.ts` |
| Config file | `.config.ts` | `auth.config.ts`, `mail.config.ts` |
| Decorator file | `.decorator.ts` | `current-user.decorator.ts` |
| Guard file | `.guard.ts` | `role.guard.ts` |

---

## Build & Deploy

```bash
# Development
pnpm dev       # Start with hot reload
pnpm build     # Build production bundle
pnpm start     # Run production build

# All builds compile to dist/ folder
# Structure mirrors src/ directory
```

---

## Benefits of This Structure

1. **Separation of Concerns** - Modules are self-contained, lib contains reusable code
2. **Scalability** - Easy to add new modules without affecting existing code
3. **Maintainability** - Clear directory structure, easy to find files
4. **Reusability** - Lib utilities used across multiple modules
5. **Type Safety** - Proper TypeScript organization prevents circular dependencies
6. **NestJS Best Practices** - Follows official NestJS recommendations
7. **Multi-Business Support** - Business adapter in lib makes multi-type support easy

---

## Next Steps

1. Add more modules as features are developed (restaurants, billing, etc.)
2. Add decorators/guards/interceptors to `lib/common/` as needed
3. Keep documentation updated as structure evolves
4. Use barrel exports (`index.ts`) for clean imports

