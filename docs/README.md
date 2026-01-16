# Documentation

Welcome to the backend documentation. This folder contains all guides and references.

## Structure

```
docs/
├── README.md                               # This file
├── project-structure.md                    # Project folder organization
└── guides/
    ├── auth-setup.md                      # Authentication setup (Better Auth)
    ├── multi-business-architecture.md     # Multi-business type system
    ├── business-unification.md            # Business model unification strategy
    ├── mail-setup.md                      # Mail service setup (Resend)
    └── dodo-payments-setup.md             # Subscription & payments (Dodo)
```

## Quick Links

### Getting Started
- **[Project Structure](./project-structure.md)** - Understand the folder organization and NestJS module structure

### Architecture
- **[Multi-Business Architecture](./guides/multi-business-architecture.md)** - Learn how the system supports multiple business types (restaurants, salons, gyms, etc.)
- **[Business Unification Strategy](./guides/business-unification.md)** - Database schema and migration plan for multi-business support

### Feature Guides
- **[Authentication Setup](./guides/auth-setup.md)** - Better Auth integration, JWT, email verification, OTP
- **[Mail Service Setup](./guides/mail-setup.md)** - Resend email service configuration
- **[Dodo Payments Setup](./guides/dodo-payments-setup.md)** - Subscription billing with Dodo Payments

## Key Concepts

### Role Hierarchy
```
SUPER_ADMIN
  ├─ Manage all franchises
  ├─ Manage subscriptions & billing
  └─ Manage platform users

FRANCHISE_OWNER
  ├─ Manage franchise businesses
  ├─ Manage franchise staff
  └─ Manage franchise billing

BUSINESS_OWNER
  ├─ Manage single business
  ├─ Manage business staff
  └─ View business analytics

MANAGER
  ├─ Day-to-day operations
  └─ Process orders/payments

STAFF
  └─ Basic operational access
```

### Folder Organization
```
src/
├── modules/           # NestJS modules (auth, mail, etc.)
├── lib/              # Shared utilities (roles, adapters, decorators)
├── app.module.ts     # Root module
└── main.ts           # Entry point
```

## Common Tasks

### Add a New Module
1. Create folder: `src/modules/feature-name/`
2. Add `.module.ts`, `.service.ts`, `.controller.ts`, `index.ts`
3. Create `config/` and `interfaces/` subdirectories as needed
4. Import in `app.module.ts`

See [Project Structure](./project-structure.md) for details.

### Add a Utility/Helper
1. Create file in `src/lib/common/` (decorators, guards, interceptors)
2. Export from `src/lib/common/index.ts`
3. Import as needed: `import { helper } from 'src/lib'`

### Check Permission System
See [Multi-Business Architecture](./guides/multi-business-architecture.md) for RBAC examples.

## Environment Variables

See `.env.example` for all required variables.

Key variables:
- `AUTH_BASE_URL` - Better Auth base URL
- `BETTER_AUTH_SECRET` - Better Auth secret key
- `RESEND_API_KEY` - Resend email API key
- `DATABASE_URL` - PostgreSQL connection string
- `DODO_API_KEY` - Dodo Payments API key
- `DODO_WEBHOOK_SECRET` - Dodo webhook signature secret

## Build & Deploy

```bash
# Development
pnpm dev

# Build
pnpm build

# Production
pnpm start
```

## Questions?

- Check the relevant guide in `docs/guides/`
- See code comments in `src/modules/`
- Review `prisma/schema.prisma` for database structure
