# Multi-Business Type Architecture Guide

## Overview

This system supports multiple business types (restaurants, salons, gyms, clinics, hotels, cafes, spas, etc.) with a **unified role-based access control (RBAC)** system.

Instead of hardcoding restaurant-specific terms, we use **generic resources** that map to business-specific operations.

---

## Key Concepts

### 1. **Generic Resources** vs **Business-Specific Resources**

| Generic Resource | Restaurant | Salon | Gym | Hotel | Clinic |
|---|---|---|---|---|---|
| **operations** | Order | Appointment | Class | Reservation | Appointment |
| **catalog** | Menu | Services | Classes | Services | Services |
| **scheduling** | Table | Slot | Schedule | Room | Doctor Schedule |
| **inventory** | Ingredients | Products | Equipment | Supplies | Medical Records |
| **billing** | Payment | Payment | Membership | Payment | Patient Billing |
| **staff** | Staff | Stylists | Trainers | Staff | Doctors |

### 2. **Permission Hierarchy**

```
SUPER_ADMIN
├── Manages entire platform
├── All franchises, subscriptions, billing
└── Full access to all resources

FRANCHISE_OWNER
├── Manages franchise
├── All businesses in franchise
└── Franchise-level billing

BUSINESS_OWNER
├── Owns specific business
├── Day-to-day management
└── Staff & inventory management

MANAGER
├── Day-to-day operations
├── Can't manage staff hiring
└── Can process operations/payments

STAFF
├── Basic operational access
└── Create/read operations

VIEWER
└── Read-only access

ACCOUNTANT
└── Financial operations only
```

---

## Implementation

### 1. **Role Definitions**

Located in `src/auth/roles.constants.ts`:

```typescript
export const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  FRANCHISE_OWNER: 'franchise_owner',
  BUSINESS_OWNER: 'business_owner',
  MANAGER: 'manager',
  STAFF: 'staff',
  VIEWER: 'viewer',
  ACCOUNTANT: 'accountant',
};
```

### 2. **Generic Permissions**

```typescript
export const PERMISSIONS = {
  PLATFORM: { ... },        // Super admin only
  FRANCHISE: { ... },       // Franchise management
  BUSINESS: { ... },        // Generic business management
  OPERATIONS: { ... },      // Create/read/update orders/appointments
  BILLING: { ... },         // Payment processing
  CATALOG: { ... },         // Menu/services management
  INVENTORY: { ... },       // Stock management
  SCHEDULING: { ... },      // Tables/slots/rooms
  EXPENSE: { ... },         // Expense management
  ANALYTICS: { ... },       // Reporting
  STAFF: { ... },          // Staff management
  // Business-specific (for complex operations)
  RESTAURANT: { ... },
  SALON: { ... },
  GYM: { ... },
};
```

### 3. **Business Adapter**

The `business-adapter.ts` service maps business-specific resources to generic permissions:

```typescript
// Maps "table" (restaurant) to generic "scheduling" resource
mapBusinessResource('restaurant', 'table', 'create')
// Returns: 'scheduling:create'

// Maps "appointment" (salon) to generic "operations" resource
mapBusinessResource('salon', 'appointment', 'read')
// Returns: 'operations:read'
```

---

## Usage Examples

### Example 1: Check Permission for Restaurant Operation

```typescript
import { canPerformBusinessOperation } from 'src/auth/business-adapter';
import { getRolePermissions } from 'src/auth/roles.constants';

// Get manager's permissions
const managerPermissions = getRolePermissions('manager');

// Check if manager can create order
const canCreate = canPerformBusinessOperation(
  managerPermissions,
  'restaurant',
  'order',
  'create'
);
// Returns: true (manager has 'operations:create')
```

### Example 2: Check Permission for Salon Operation

```typescript
// Same permission system works for salon
const canBook = canPerformBusinessOperation(
  managerPermissions,
  'salon',
  'appointment',
  'create'
);
// Returns: true (manager has 'operations:create')
```

### Example 3: Get Business-Specific Operation Labels

```typescript
import { getResourceLabel } from 'src/auth/business-adapter';

// For restaurant
getResourceLabel('restaurant', 'operations') // 'Orders'
getResourceLabel('restaurant', 'catalog')    // 'Menu'
getResourceLabel('restaurant', 'scheduling') // 'Tables'

// For salon
getResourceLabel('salon', 'operations')      // 'Appointments'
getResourceLabel('salon', 'catalog')         // 'Services'
getResourceLabel('salon', 'scheduling')      // 'Slots'

// For gym
getResourceLabel('gym', 'operations')        // 'Classes/Attendance'
getResourceLabel('gym', 'billing')           // 'Memberships'
```

---

## Extending to New Business Types

### Step 1: Add Business Type

```typescript
// business-adapter.ts
export type BusinessType = 'restaurant' | 'salon' | 'gym' | 'clinic' | 'spa' | 'yoga_studio';
```

### Step 2: Define Resource Mapping

```typescript
export const BUSINESS_RESOURCE_MAP: Record<BusinessType, Record<string, string>> = {
  yoga_studio: {
    class: 'operations',        // Classes are operations
    service: 'catalog',         // Services/packages
    schedule: 'scheduling',     // Class schedule
    member: 'billing',          // Membership billing
    equipment: 'inventory',
  },
  // ... existing mappings
};
```

### Step 3: Add Labels

```typescript
export function getResourceLabel(businessType: BusinessType, genericResource: string): string {
  const labels: Record<BusinessType, Record<string, string>> = {
    yoga_studio: {
      operations: 'Classes',
      catalog: 'Packages',
      scheduling: 'Schedule',
      inventory: 'Equipment',
      billing: 'Memberships',
      staff: 'Instructors',
      analytics: 'Analytics',
    },
    // ... existing labels
  };
  // ...
}
```

### Step 4: Database Schema (Future)

```prisma
model Business {
  id              String
  type            String // "restaurant", "salon", "yoga_studio", etc.
  // ... generic fields
  yogaStudioData  YogaStudioBusiness?
}

model YogaStudioBusiness {
  businessId    String   @unique
  business      Business @relation(fields: [businessId], references: [id])
  classes       Class[]
  instructors   Instructor[]
}
```

---

## API Integration Example

### Controller: Handle Any Business Type

```typescript
import { Controller, Post, UseGuards, Body } from '@nestjs/common';
import { canPerformBusinessOperation } from 'src/auth/business-adapter';

@Controller(':businessType/:businessId/operations')
export class OperationsController {
  @Post()
  @UseGuards(AuthGuard)
  async createOperation(
    @Param('businessType') businessType: string,
    @Param('businessId') businessId: string,
    @Body() dto: CreateOperationDto,
    @CurrentUser() user: User,
  ) {
    // Get user permissions for this business
    const permissions = await this.authService.getUserBusinessPermissions(
      user.id,
      businessId,
    );

    // Check generic permission (works for all business types)
    if (!canPerformBusinessOperation(permissions, businessType, 'order', 'create')) {
      throw new ForbiddenException('Cannot create operation');
    }

    // Handle creation (service handles business-type-specific logic)
    return this.operationService.create(businessType, businessId, dto);
  }
}
```

### Service: Handle Different Business Types

```typescript
export class OperationService {
  async create(businessType: string, businessId: string, dto: CreateOperationDto) {
    switch (businessType) {
      case 'restaurant':
        return this.createOrder(businessId, dto);
      case 'salon':
        return this.createAppointment(businessId, dto);
      case 'gym':
        return this.createClassAttendance(businessId, dto);
      default:
        throw new BadRequestException('Unknown business type');
    }
  }

  private async createOrder(businessId: string, dto: any) {
    // Restaurant-specific logic
  }

  private async createAppointment(businessId: string, dto: any) {
    // Salon-specific logic
  }

  private async createClassAttendance(businessId: string, dto: any) {
    // Gym-specific logic
  }
}
```

---

## Permission Check Helpers

### In Role Constants

```typescript
// Check if role has permission
hasPermission('manager', 'operations:create') // true

// Get all permissions for role
getRolePermissions('manager')
// Returns: ['operations:create', 'operations:read', ...]

// Check if role is admin
isAdminRole('franchise_owner') // true
```

### In Business Adapter

```typescript
// Map business-specific to generic
mapBusinessResource('salon', 'appointment', 'create')
// Returns: 'operations:create'

// Get resource label for UI
getResourceLabel('salon', 'operations')
// Returns: 'Appointments'

// Check if user can perform operation
canPerformBusinessOperation(permissions, 'gym', 'class', 'read')
// Returns: true/false

// Get all operations for permission
getBusinessOperations('restaurant', 'operations:create')
// Returns: ['order:create', 'item:create', ...]
```

---

## Migration Path

### Phase 1: Current State
- ✅ Generic roles defined
- ✅ Generic permissions system implemented
- ✅ Business adapter created for mapping

### Phase 2: Database Schema
- [ ] Create `Business` model in Prisma
- [ ] Create business-type-specific sub-models
- [ ] Migrate `Restaurant` data to `Business` with type='restaurant'

### Phase 3: Service Layer
- [ ] Update auth service for business operations
- [ ] Create business service for multi-type support
- [ ] Implement business adapters for each type

### Phase 4: API Routes
- [ ] Generic operation endpoints
- [ ] Business-type-specific endpoints
- [ ] Update controllers to use adapters

### Phase 5: New Business Types
- [ ] Add salon module with appointments
- [ ] Add gym module with classes & memberships
- [ ] Add clinic module with doctor appointments

---

## Benefits

1. **Single RBAC System** - Works for all business types
2. **Easy to Extend** - Add new business type in 5 minutes
3. **Consistent API** - Same endpoints for all businesses
4. **Type-Safe** - TypeScript ensures correctness
5. **Scalable** - No permission duplications
6. **Flexible** - Can fallback to business-specific permissions when needed

---

## Next Steps

1. Create `Business` model in Prisma schema
2. Update auth.service.ts to support multi-business queries
3. Create business service layer
4. Build salon module as proof of concept
5. Create API routes for generic operations

