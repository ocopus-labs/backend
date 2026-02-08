# POS Platform — Backend

REST API server for the multi-tenant POS & billing platform. Built with NestJS, Prisma, and PostgreSQL.

## Tech Stack

- **Framework**: NestJS 11 + TypeScript
- **Database**: PostgreSQL + Prisma ORM (v6)
- **Auth**: Better Auth (sessions, OAuth, email OTP, TOTP 2FA)
- **Payments**: Dodo Payments (webhooks with idempotency)
- **Email**: Resend (transactional)
- **Real-time**: Socket.io (kitchen display, table status)
- **Scheduling**: `@nestjs/schedule` (recurring expenses)
- **Rate Limiting**: `@nestjs/throttler` (3-tier: short/medium/long)

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- A [Resend](https://resend.com) API key (for emails)

### Setup

```bash
cd backend
npm install

# Copy env and fill in your values
cp .env.example .env

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed the database (creates super admin)
npm run seed

# Start dev server (port 3000)
npm run start:dev
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Hot-reload development server |
| `npm run build` | Compile TypeScript |
| `npm run start:prod` | Production server |
| `npm run lint` | ESLint with auto-fix |
| `npm run format` | Prettier formatting |
| `npm run test` | Jest unit tests |
| `npm run test:e2e` | End-to-end tests |
| `npm run test:cov` | Test coverage report |
| `npm run seed` | Seed database |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | Server port (default: `3000`) |
| `NODE_ENV` | `development` / `production` |
| `BETTER_AUTH_SECRET` | Session encryption key |
| `AUTH_BASE_URL` | Backend URL (e.g. `http://localhost:3000`) |
| `RESEND_API_KEY` | Resend email API key |
| `MAIL_FROM` | Sender email address |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary image CDN |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `DODO_API_KEY` | Dodo Payments API key |
| `DODO_WEBHOOK_SECRET` | Webhook signature secret |
| `DODO_TEST_MODE` | `true` / `false` |
| `SUPER_ADMIN_EMAIL` | Seed admin email |
| `SUPER_ADMIN_PASSWORD` | Seed admin password |
| `SUPER_ADMIN_NAME` | Seed admin display name |

See `.env.example` for the full list.

## Architecture

```
src/
├── main.ts                 # Bootstrap (CORS, cookies, API prefix)
├── app.module.ts           # Root module (guards, interceptors)
├── modules/                # Feature modules
│   ├── admin/              # Super admin operations
│   ├── analytics/          # Business analytics & reporting
│   ├── announcement/       # Platform announcements
│   ├── auth/               # Authentication (Better Auth)
│   ├── business/           # Business/restaurant CRUD
│   ├── expense/            # Expense tracking + recurring scheduler
│   ├── inventory/          # Stock & supplier management
│   ├── mail/               # Transactional emails (Resend)
│   ├── menu/               # Menu items, categories, modifiers
│   ├── order/              # Order lifecycle
│   ├── payment/            # Payment processing & refunds
│   ├── prisma/             # Database connection
│   ├── search/             # Global search
│   ├── subscription/       # SaaS plans & usage tracking
│   ├── table/              # Table management & sessions
│   └── team/               # Team members & invitations
└── lib/                    # Shared utilities (non-module)
    ├── auth/               # Roles, permissions, business adapter
    └── common/             # Decorators, guards, interceptors
```

### Key Modules

Each module follows the standard NestJS pattern: `module.ts`, `controller.ts`, `service.ts`, and `index.ts` barrel export.

| Module | Endpoints | Purpose |
|--------|-----------|---------|
| **Auth** | `/api/auth/*` | Sign up, login, OAuth (Google), email OTP, 2FA, sessions |
| **Business** | `/api/businesses` | CRUD, settings, setup wizard |
| **Menu** | `/api/businesses/:id/menu` | Items, categories, modifiers, availability |
| **Order** | `/api/businesses/:id/orders` | Create, update status, audit trail |
| **Payment** | `/api/businesses/:id/payments` | Process, split, refund (atomic transactions) |
| **Table** | `/api/businesses/:id/tables` | CRUD, sessions, reservations |
| **Inventory** | `/api/businesses/:id/inventory` | Stock, suppliers, adjustments, transactions |
| **Expense** | `/api/businesses/:id/expenses` | Daily/monthly tracking, recurring via cron |
| **Analytics** | `/api/businesses/:id/analytics` | Dashboard stats, revenue trends, hourly breakdown |
| **Team** | `/api/businesses/:id/team` | Members, roles, invitations |
| **Subscription** | `/api/subscriptions` | Plans, checkout, usage tracking |
| **Admin** | `/api/admin` | Users, businesses, stats, audit logs, announcements |

### Multi-Tenancy

All business data is scoped by `restaurantId`. Three global guards enforce isolation:

1. **AuthGuard** — Requires valid session (via Better Auth)
2. **RolesGuard** — Checks `@BusinessRoles()` decorator against user's role
3. **BusinessAccessGuard** — Extracts `businessId` from route params, verifies membership via `BusinessUser` table, sets `req.businessUser`

Role hierarchy: `SUPER_ADMIN > FRANCHISE_OWNER > BUSINESS_OWNER > MANAGER > STAFF > VIEWER`

### Security

- **Rate limiting**: 3-tier throttling (3/1s, 20/10s, 100/60s)
- **Input sanitization**: Global interceptor strips HTML from request bodies
- **Validation**: DTOs with `class-validator` decorators (`@Max`, `@MaxLength`, `@IsUrl`)
- **Audit logging**: All mutations logged with IP address and user agent
- **Atomic transactions**: Payment and order operations wrapped in `$transaction`
- **Webhook idempotency**: Dodo webhooks deduplicated via `WebhookEvent` table

## Database

Schema is defined in `prisma/schema.prisma`. Key models:

| Model | Purpose |
|-------|---------|
| `User` | Platform users (email, role, 2FA, preferences) |
| `Restaurant` | Business entities (name, type, settings, status) |
| `BusinessUser` | User ↔ Business junction (role, permissions) |
| `Order` | Orders with items, pricing, audit trail (JSON) |
| `Payment` | Payments with gateway tracking and refunds |
| `MenuItem` | Menu items with categories and version control |
| `Table` | Tables with position, shape, sessions, reservations |
| `InventoryItem` | Stock items with transactions and expiry tracking |
| `Expense` | Expenses with recurring support and approval workflow |
| `AuditLog` | Compliance trail (action, resource, IP, user agent) |
| `SubscriptionPlan` | SaaS tiers with limits and pricing |
| `Subscription` | Active subscriptions with usage records |

### Migrations

```bash
# Create a new migration
npx prisma migrate dev --name <name>

# Apply migrations in production
npx prisma migrate deploy

# Regenerate Prisma client
npx prisma generate
```

## Documentation

Additional guides are available in `docs/`:

- `guides/auth-setup.md` — Better Auth configuration
- `guides/mail-setup.md` — Resend email setup
- `guides/business-unification.md` — Multi-business support
- `guides/multi-business-architecture.md` — Multi-tenant design
