/**
 * User Roles - Proper Hierarchy
 * 
 * SUPER_ADMIN (Platform Owner)
 * ├── Manage all franchises
 * ├── Manage subscriptions & billing
 * ├── Manage users across platform
 * └── View platform analytics
 * 
 * FRANCHISE_OWNER (Franchise Owner)
 * ├── Manage multiple restaurants in their franchise
 * ├── Manage franchise staff
 * ├── Manage franchise billing
 * └── View franchise analytics
 * 
 * RESTAURANT_OWNER (Single Restaurant Owner)
 * ├── Manage their restaurant
 * ├── Manage restaurant staff
 * └── View restaurant analytics
 * 
 * MANAGER (Restaurant Manager)
 * ├── Day-to-day operations
 * ├── Staff management (limited)
 * └── Order & payment processing
 * 
 * STAFF (Restaurant Staff)
 * └── Order & basic operations
 */

export const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  FRANCHISE_OWNER: 'franchise_owner',
  RESTAURANT_OWNER: 'restaurant_owner',
  MANAGER: 'manager',
  STAFF: 'staff',
  VIEWER: 'viewer',
  ACCOUNTANT: 'accountant',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

/**
 * Generic Business Resource Actions
 * Works across all business types (restaurants, salons, gyms, etc.)
 * Defines all available actions for each resource
 */
export const PERMISSIONS = {
  // ==================== PLATFORM MANAGEMENT ====================
  // Super Admin only - manages entire platform
  PLATFORM: {
    MANAGE_FRANCHISES: 'platform:manage_franchises',
    MANAGE_SUBSCRIPTIONS: 'platform:manage_subscriptions',
    MANAGE_BILLING: 'platform:manage_billing',
    VIEW_PLATFORM_ANALYTICS: 'platform:view_platform_analytics',
    MANAGE_PLATFORM_USERS: 'platform:manage_platform_users',
    MANAGE_SYSTEM_SETTINGS: 'platform:manage_system_settings',
  },

  // ==================== FRANCHISE MANAGEMENT ====================
  // Franchise Owner - manages franchise & multiple businesses
  FRANCHISE: {
    CREATE: 'franchise:create',
    READ: 'franchise:read',
    UPDATE: 'franchise:update',
    DELETE: 'franchise:delete',
    MANAGE_BUSINESSES: 'franchise:manage_businesses', // Generic: replaces "manage_restaurants"
    MANAGE_FRANCHISE_STAFF: 'franchise:manage_franchise_staff',
    VIEW_FRANCHISE_ANALYTICS: 'franchise:view_franchise_analytics',
    MANAGE_FRANCHISE_BILLING: 'franchise:manage_franchise_billing',
  },

  // ==================== BUSINESS MANAGEMENT ====================
  // Business Owner - manages their business (restaurant, salon, gym, etc.)
  BUSINESS: {
    CREATE: 'business:create',
    READ: 'business:read',
    UPDATE: 'business:update',
    DELETE: 'business:delete',
    MANAGE_SETTINGS: 'business:manage_settings',
    VIEW_ANALYTICS: 'business:view_analytics',
    MANAGE_STAFF: 'business:manage_staff',
    MANAGE_INVENTORY: 'business:manage_inventory',
  },

  // ==================== USER MANAGEMENT ====================
  USER: {
    CREATE: 'user:create',
    READ: 'user:read',
    UPDATE: 'user:update',
    DELETE: 'user:delete',
    BAN: 'user:ban',
    UNBAN: 'user:unban',
    GRANT_PERMISSION: 'user:grant_permission',
    REVOKE_PERMISSION: 'user:revoke_permission',
  },

  // ==================== OPERATIONS ====================
  // Generic operations (Orders/Services/Appointments depending on business type)
  OPERATIONS: {
    CREATE: 'operations:create',
    READ: 'operations:read',
    UPDATE: 'operations:update',
    CANCEL: 'operations:cancel',
    COMPLETE: 'operations:complete',
    VIEW_ALL: 'operations:view_all',
  },

  // ==================== BILLING & PAYMENTS ====================
  BILLING: {
    CREATE_INVOICE: 'billing:create_invoice',
    READ_INVOICE: 'billing:read_invoice',
    PROCESS_PAYMENT: 'billing:process_payment',
    REFUND: 'billing:refund',
    VIEW_REPORTS: 'billing:view_reports',
    MANAGE_SUBSCRIPTIONS: 'billing:manage_subscriptions',
  },

  // ==================== CATALOG/MENU MANAGEMENT ====================
  // Generic: Menu (Restaurant), Services (Salon), Classes (Gym), etc.
  CATALOG: {
    CREATE: 'catalog:create',
    READ: 'catalog:read',
    UPDATE: 'catalog:update',
    DELETE: 'catalog:delete',
    PUBLISH: 'catalog:publish',
  },

  // ==================== INVENTORY MANAGEMENT ====================
  INVENTORY: {
    CREATE: 'inventory:create',
    READ: 'inventory:read',
    UPDATE: 'inventory:update',
    DELETE: 'inventory:delete',
    MANAGE_STOCK: 'inventory:manage_stock',
  },

  // ==================== SCHEDULING ====================
  // Generic: Tables (Restaurant), Appointments (Salon), Class Slots (Gym), etc.
  SCHEDULING: {
    CREATE: 'scheduling:create',
    READ: 'scheduling:read',
    UPDATE: 'scheduling:update',
    DELETE: 'scheduling:delete',
    RESERVE: 'scheduling:reserve',
    MANAGE: 'scheduling:manage',
  },

  // ==================== EXPENSE MANAGEMENT ====================
  EXPENSE: {
    CREATE: 'expense:create',
    READ: 'expense:read',
    UPDATE: 'expense:update',
    DELETE: 'expense:delete',
    APPROVE: 'expense:approve',
    REJECT: 'expense:reject',
  },

  // ==================== ANALYTICS & REPORTING ====================
  ANALYTICS: {
    VIEW: 'analytics:view',
    EXPORT: 'analytics:export',
    SHARE: 'analytics:share',
    ADVANCED_REPORTING: 'analytics:advanced_reporting',
  },

  // ==================== STAFF MANAGEMENT ====================
  STAFF: {
    MANAGE: 'staff:manage',
    VIEW_ATTENDANCE: 'staff:view_attendance',
    MANAGE_SHIFTS: 'staff:manage_shifts',
    ASSIGN_TO_OPERATION: 'staff:assign_to_operation', // Generic: assign to order/appointment/class
  },

  // ==================== BUSINESS-TYPE SPECIFIC ====================
  // For operations specific to certain business types
  RESTAURANT: {
    MANAGE_TABLES: 'restaurant:manage_tables',
    MANAGE_MENU: 'restaurant:manage_menu',
  },

  SALON: {
    MANAGE_SERVICES: 'salon:manage_services',
    MANAGE_APPOINTMENTS: 'salon:manage_appointments',
    MANAGE_STYLISTS: 'salon:manage_stylists',
  },

  GYM: {
    MANAGE_MEMBERSHIPS: 'gym:manage_memberships',
    MANAGE_CLASSES: 'gym:manage_classes',
    MANAGE_ATTENDANCE: 'gym:manage_attendance',
  },
} as const;

/**
 * Role-Based Permission Mapping
 * Defines which permissions each role has
 * Works across all business types (restaurants, salons, gyms, etc.)
 */
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  [USER_ROLES.SUPER_ADMIN]: [
    // Super admin has all platform and franchise management permissions
    ...Object.values(PERMISSIONS.PLATFORM),
    ...Object.values(PERMISSIONS.FRANCHISE),
    ...Object.values(PERMISSIONS.USER),
    ...Object.values(PERMISSIONS.BUSINESS),
    ...Object.values(PERMISSIONS.OPERATIONS),
    ...Object.values(PERMISSIONS.BILLING),
    ...Object.values(PERMISSIONS.CATALOG),
    ...Object.values(PERMISSIONS.INVENTORY),
    ...Object.values(PERMISSIONS.SCHEDULING),
    ...Object.values(PERMISSIONS.EXPENSE),
    ...Object.values(PERMISSIONS.ANALYTICS),
    ...Object.values(PERMISSIONS.STAFF),
    // Business-type specific
    ...Object.values(PERMISSIONS.RESTAURANT),
    ...Object.values(PERMISSIONS.SALON),
    ...Object.values(PERMISSIONS.GYM),
  ],

  [USER_ROLES.FRANCHISE_OWNER]: [
    // Franchise owner manages all businesses within their franchise
    PERMISSIONS.FRANCHISE.READ,
    PERMISSIONS.FRANCHISE.UPDATE,
    PERMISSIONS.FRANCHISE.MANAGE_BUSINESSES,
    PERMISSIONS.FRANCHISE.MANAGE_FRANCHISE_STAFF,
    PERMISSIONS.FRANCHISE.VIEW_FRANCHISE_ANALYTICS,
    PERMISSIONS.FRANCHISE.MANAGE_FRANCHISE_BILLING,
    PERMISSIONS.USER.CREATE,
    PERMISSIONS.USER.READ,
    PERMISSIONS.USER.UPDATE,
    PERMISSIONS.USER.BAN,
    PERMISSIONS.USER.UNBAN,
    ...Object.values(PERMISSIONS.BUSINESS),
    ...Object.values(PERMISSIONS.OPERATIONS),
    ...Object.values(PERMISSIONS.BILLING),
    ...Object.values(PERMISSIONS.CATALOG),
    ...Object.values(PERMISSIONS.INVENTORY),
    ...Object.values(PERMISSIONS.SCHEDULING),
    ...Object.values(PERMISSIONS.EXPENSE),
    ...Object.values(PERMISSIONS.ANALYTICS),
    ...Object.values(PERMISSIONS.STAFF),
    // Business-type specific
    ...Object.values(PERMISSIONS.RESTAURANT),
    ...Object.values(PERMISSIONS.SALON),
    ...Object.values(PERMISSIONS.GYM),
  ],

  [USER_ROLES.RESTAURANT_OWNER]: [
    // Restaurant owner manages their business
    PERMISSIONS.BUSINESS.READ,
    PERMISSIONS.BUSINESS.UPDATE,
    PERMISSIONS.BUSINESS.MANAGE_SETTINGS,
    PERMISSIONS.BUSINESS.VIEW_ANALYTICS,
    PERMISSIONS.BUSINESS.MANAGE_STAFF,
    PERMISSIONS.BUSINESS.MANAGE_INVENTORY,
    ...Object.values(PERMISSIONS.OPERATIONS),
    ...Object.values(PERMISSIONS.BILLING),
    ...Object.values(PERMISSIONS.CATALOG),
    ...Object.values(PERMISSIONS.INVENTORY),
    ...Object.values(PERMISSIONS.SCHEDULING),
    ...Object.values(PERMISSIONS.EXPENSE),
    ...Object.values(PERMISSIONS.ANALYTICS),
    PERMISSIONS.STAFF.MANAGE,
    PERMISSIONS.STAFF.VIEW_ATTENDANCE,
    PERMISSIONS.STAFF.MANAGE_SHIFTS,
    PERMISSIONS.STAFF.ASSIGN_TO_OPERATION,
    // Business-type specific
    ...Object.values(PERMISSIONS.RESTAURANT),
    ...Object.values(PERMISSIONS.SALON),
    ...Object.values(PERMISSIONS.GYM),
  ],

  [USER_ROLES.MANAGER]: [
    // Manager handles day-to-day operations
    PERMISSIONS.BUSINESS.READ,
    PERMISSIONS.OPERATIONS.CREATE,
    PERMISSIONS.OPERATIONS.READ,
    PERMISSIONS.OPERATIONS.UPDATE,
    PERMISSIONS.OPERATIONS.COMPLETE,
    PERMISSIONS.OPERATIONS.CANCEL,
    PERMISSIONS.BILLING.CREATE_INVOICE,
    PERMISSIONS.BILLING.READ_INVOICE,
    PERMISSIONS.BILLING.PROCESS_PAYMENT,
    PERMISSIONS.CATALOG.READ,
    PERMISSIONS.CATALOG.UPDATE,
    PERMISSIONS.INVENTORY.READ,
    PERMISSIONS.INVENTORY.UPDATE,
    PERMISSIONS.INVENTORY.MANAGE_STOCK,
    PERMISSIONS.SCHEDULING.READ,
    PERMISSIONS.SCHEDULING.UPDATE,
    PERMISSIONS.SCHEDULING.RESERVE,
    PERMISSIONS.EXPENSE.READ,
    PERMISSIONS.EXPENSE.CREATE,
    PERMISSIONS.ANALYTICS.VIEW,
    PERMISSIONS.STAFF.VIEW_ATTENDANCE,
    PERMISSIONS.STAFF.ASSIGN_TO_OPERATION,
    // Business-type specific
    PERMISSIONS.RESTAURANT.MANAGE_TABLES,
    PERMISSIONS.SALON.MANAGE_APPOINTMENTS,
    PERMISSIONS.GYM.MANAGE_ATTENDANCE,
  ],

  [USER_ROLES.STAFF]: [
    // Staff has basic operational access
    PERMISSIONS.OPERATIONS.CREATE,
    PERMISSIONS.OPERATIONS.READ,
    PERMISSIONS.OPERATIONS.UPDATE,
    PERMISSIONS.OPERATIONS.COMPLETE,
    PERMISSIONS.BILLING.READ_INVOICE,
    PERMISSIONS.CATALOG.READ,
    PERMISSIONS.INVENTORY.READ,
    PERMISSIONS.SCHEDULING.READ,
    PERMISSIONS.SCHEDULING.RESERVE,
    // Business-type specific
    PERMISSIONS.RESTAURANT.MANAGE_TABLES,
    PERMISSIONS.SALON.MANAGE_APPOINTMENTS,
    PERMISSIONS.GYM.MANAGE_ATTENDANCE,
  ],

  [USER_ROLES.VIEWER]: [
    // Viewer has read-only access
    PERMISSIONS.BUSINESS.READ,
    PERMISSIONS.OPERATIONS.READ,
    PERMISSIONS.BILLING.READ_INVOICE,
    PERMISSIONS.CATALOG.READ,
    PERMISSIONS.INVENTORY.READ,
    PERMISSIONS.SCHEDULING.READ,
    PERMISSIONS.ANALYTICS.VIEW,
  ],

  [USER_ROLES.ACCOUNTANT]: [
    // Accountant handles financial operations
    PERMISSIONS.OPERATIONS.READ,
    PERMISSIONS.BILLING.READ_INVOICE,
    PERMISSIONS.BILLING.VIEW_REPORTS,
    PERMISSIONS.BILLING.PROCESS_PAYMENT,
    PERMISSIONS.BILLING.REFUND,
    PERMISSIONS.EXPENSE.READ,
    PERMISSIONS.EXPENSE.CREATE,
    PERMISSIONS.EXPENSE.APPROVE,
    PERMISSIONS.EXPENSE.REJECT,
    PERMISSIONS.ANALYTICS.VIEW,
    PERMISSIONS.ANALYTICS.EXPORT,
  ],
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: UserRole, permission: string): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: UserRole): string[] {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Get role display name
 */
export function getRoleDisplayName(role: UserRole): string {
  const displayNames: Record<UserRole, string> = {
    [USER_ROLES.SUPER_ADMIN]: 'Super Admin',
    [USER_ROLES.FRANCHISE_OWNER]: 'Franchise Owner',
    [USER_ROLES.RESTAURANT_OWNER]: 'Restaurant Owner',
    [USER_ROLES.MANAGER]: 'Manager',
    [USER_ROLES.STAFF]: 'Staff',
    [USER_ROLES.VIEWER]: 'Viewer',
    [USER_ROLES.ACCOUNTANT]: 'Accountant',
  };
  return displayNames[role] || role;
}

/**
 * Check if a role is an admin role
 */
export function isAdminRole(role: string): boolean {
  return role === USER_ROLES.SUPER_ADMIN || role === USER_ROLES.FRANCHISE_OWNER;
}
