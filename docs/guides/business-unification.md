# Business System Unification Strategy

## Current State
- Hardcoded `Restaurant` model
- Role/permission system tied to restaurant operations
- Duplicated logic for different business types

## Target State
- Generic `Business` model that supports all business types
- Universal role hierarchy that works across all business types
- Configurable business modules

---

## Phase 1: Database Schema (Prisma)

### Option A: Keep Restaurant model + Add Business (Recommended for easier migration)
```prisma
model Business {
  id              String   @id @default(uuid())
  type            String   // "restaurant", "salon", "gym", "cafe", "hotel", etc.
  name            String
  slug            String   @unique
  address         Json
  contact         Json
  owner           User     @relation("BusinessOwner", fields: [ownerId], references: [id])
  ownerId         String
  subscription    Json
  settings        Json     // Flexible JSON for business-specific settings
  status          String   @default("active")
  
  // Universal relations
  staff           BusinessUser[]
  permissions     BusinessPermission[]
  auditLogs       AuditLog[]
  
  // Polymorphic support via type discriminator
  restaurantData  RestaurantBusiness?  // restaurant-specific
  salonData       SalonBusiness?       // salon-specific
  gymData         GymBusiness?         // gym-specific
}

// Business-specific sub-models
model RestaurantBusiness {
  businessId    String   @unique
  business      Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  
  orders        Order[]
  tables        Table[]
  menu          MenuItem[]
  inventory     InventoryItem[]
}

model SalonBusiness {
  businessId    String   @unique
  business      Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  
  services      Service[]
  appointments  Appointment[]
  staff         SalonStaff[]
}
```

### Option B: Complete Migration (Rename Restaurant → Business)
- Rename `Restaurant` to `Business`
- Add `type` enum field
- Update all relations

---

## Phase 2: Role & Permission System

### Current Structure
```
super_admin → manages platform
franchise_owner → manages franchise's restaurants
restaurant_owner → manages single restaurant
manager → manages operations
staff → basic access
```

### New Universal Structure
```
PLATFORM_OWNER (super_admin)
├── Manage all businesses across all franchises
├── Manage subscriptions & billing
└── View platform analytics

FRANCHISE_OWNER
├── Manage multiple businesses in their franchise
├── Regardless of business type
└── Control franchise finances

BUSINESS_OWNER
├── Own single business (restaurant, salon, gym, etc.)
├── Manage business operations
└── Manage business staff

MANAGER
├── Manage daily operations of specific business
└── Staff coordination

STAFF / TEAM_MEMBER
└── Basic operations in business

VIEWER / CLIENT (Business-specific)
└── Read-only access
```

---

## Phase 3: Generic Permissions

### Replace Business-Specific with Generic Resources

**OLD:**
```typescript
RESTAURANT: { CREATE, READ, UPDATE, DELETE, ... }
MENU: { CREATE, READ, UPDATE, DELETE, ... }
TABLE: { ... }
ORDER: { ... }
```

**NEW:**
```typescript
BUSINESS: { 
  CREATE, READ, UPDATE, DELETE,
  MANAGE_SETTINGS, VIEW_ANALYTICS, MANAGE_STAFF
}

OPERATIONS: {
  // Orders/Appointments/Services - generic
  CREATE_ORDER, READ_ORDER, UPDATE_ORDER, CANCEL_ORDER, COMPLETE_ORDER
}

STAFF: {
  MANAGE, VIEW_ATTENDANCE, MANAGE_SHIFTS, ASSIGN_TO_ORDER
}

INVENTORY: {
  CREATE, READ, UPDATE, DELETE, MANAGE_STOCK
}

BILLING: {
  CREATE_INVOICE, PROCESS_PAYMENT, REFUND, VIEW_REPORTS
}

ANALYTICS: {
  VIEW, EXPORT, SHARE, ADVANCED_REPORTING
}

USERS: {
  MANAGE, CREATE, DELETE, GRANT_PERMISSION, REVOKE_PERMISSION
}
```

---

## Phase 4: Implementation Steps

### Step 1: Update roles.constants.ts
- Add `businessType` context to permission checking
- Support resource aliasing (menu → catalog, table → slot, etc.)
- Add helper function: `canAccess(role, resource, action, businessType)`

### Step 2: Create business.service.ts
```typescript
getBusinessType(businessId): string
canUserAccessBusiness(userId, businessId, permission): boolean
getBusinessPermissions(userId, businessId): string[]
```

### Step 3: Create business-adapter middleware
- Maps business-type-specific resources to generic permissions
- Example: Restaurant `ORDER` → Generic `OPERATION.CREATE_ORDER`

### Step 4: Database Migration
- Backup current data
- Run Prisma migration for new `Business` model
- Migrate `Restaurant` data → `Business` with type="restaurant"

---

## Phase 5: Business Type Modules

Create modular business-specific implementations:

```
src/modules/
├── restaurant/
│   ├── restaurant.service.ts
│   ├── menu.service.ts
│   ├── orders.service.ts
│   └── tables.service.ts
├── salon/
│   ├── salon.service.ts
│   ├── services.service.ts
│   ├── appointments.service.ts
│   └── staff.service.ts
├── gym/
│   ├── gym.service.ts
│   ├── memberships.service.ts
│   ├── classes.service.ts
│   └── attendance.service.ts
└── shared/
    ├── business.service.ts (core)
    ├── billing.service.ts
    ├── staff.service.ts
    └── analytics.service.ts
```

---

## Recommendation

**Start with Option A (Keep Restaurant, Add Business):**
1. ✅ Easier incremental migration
2. ✅ No breaking changes to existing code
3. ✅ Can run both models in parallel
4. ✅ Test with new business types without affecting restaurants
5. ✅ Gradually migrate data

**Timeline:**
- Week 1: Create Business model, update roles system
- Week 2: Create business adapters, migrate data
- Week 3: Build salon/gym modules as proof of concept
- Week 4: Deprecate Restaurant model

---

## Database Schema Summary

```
User (1) ──→ (*) Business
          ├─ BusinessUser (role, permissions)
          ├─ Subscription
          ├─ AuditLog
          └─ BusinessPermission

Business (1) ──→ (0..1) RestaurantBusiness
            └─ (0..1) SalonBusiness
            └─ (0..1) GymBusiness
```

---

## Example: Multi-Business Query

```typescript
// Works for any business type
const permissions = await authService.getBusinessPermissions(userId, businessId)
const canCreate = hasPermission('operations:create_order', permissions)

// Restaurant specific
if (business.type === 'restaurant') {
  const table = await restaurantService.getTable(tableId)
}

// Salon specific
if (business.type === 'salon') {
  const appointment = await salonService.getAppointment(appointmentId)
}
```

