/**
 * Business Adapter Service
 * Maps business-type-specific resources to generic permissions
 * Enables RBAC to work across different business types
 */

export type BusinessType =
  | 'restaurant'
  | 'salon'
  | 'gym'
  | 'cafe'
  | 'hotel'
  | 'clinic'
  | 'spa';

/**
 * Maps business-type-specific resources to generic permission names
 * Example: restaurant "table" → generic "scheduling" resource
 */
export const BUSINESS_RESOURCE_MAP: Record<
  BusinessType,
  Record<string, string>
> = {
  restaurant: {
    order: 'operations',
    menu: 'catalog',
    table: 'scheduling',
    recipe: 'catalog',
    ingredient: 'inventory',
  },
  salon: {
    appointment: 'operations',
    service: 'catalog',
    stylist: 'staff',
    product: 'inventory',
    slot: 'scheduling',
  },
  gym: {
    membership: 'billing',
    class: 'catalog',
    attendance: 'operations',
    equipment: 'inventory',
    schedule: 'scheduling',
  },
  cafe: {
    order: 'operations',
    menu: 'catalog',
    table: 'scheduling',
    ingredient: 'inventory',
    recipe: 'catalog',
  },
  hotel: {
    reservation: 'operations',
    room: 'scheduling',
    service: 'catalog',
    staff: 'staff',
    inventory: 'inventory',
  },
  clinic: {
    appointment: 'operations',
    service: 'catalog',
    doctor: 'staff',
    patient: 'billing',
    record: 'inventory',
  },
  spa: {
    appointment: 'operations',
    service: 'catalog',
    therapist: 'staff',
    product: 'inventory',
    slot: 'scheduling',
  },
};

/**
 * Get generic permission resource name for business type
 */
export function mapBusinessResource(
  businessType: BusinessType,
  resource: string,
  action: string,
): string {
  const genericResource = BUSINESS_RESOURCE_MAP[businessType]?.[resource];
  if (!genericResource) {
    return `${resource}:${action}`;
  }
  return `${genericResource}:${action}`;
}

/**
 * Get business-specific label for generic resource
 */
export function getResourceLabel(
  businessType: BusinessType,
  genericResource: string,
): string {
  const labels: Record<BusinessType, Record<string, string>> = {
    restaurant: {
      operations: 'Orders',
      catalog: 'Menu',
      scheduling: 'Tables',
      inventory: 'Ingredients',
      billing: 'Payments',
      staff: 'Staff',
      analytics: 'Analytics',
    },
    salon: {
      operations: 'Appointments',
      catalog: 'Services',
      scheduling: 'Slots',
      inventory: 'Products',
      billing: 'Payments',
      staff: 'Stylists',
      analytics: 'Analytics',
    },
    gym: {
      operations: 'Classes/Attendance',
      catalog: 'Classes',
      scheduling: 'Class Schedule',
      inventory: 'Equipment',
      billing: 'Memberships',
      staff: 'Trainers',
      analytics: 'Analytics',
    },
    cafe: {
      operations: 'Orders',
      catalog: 'Menu',
      scheduling: 'Tables',
      inventory: 'Ingredients',
      billing: 'Payments',
      staff: 'Staff',
      analytics: 'Analytics',
    },
    hotel: {
      operations: 'Reservations',
      catalog: 'Services',
      scheduling: 'Rooms',
      inventory: 'Supplies',
      billing: 'Payments',
      staff: 'Staff',
      analytics: 'Analytics',
    },
    clinic: {
      operations: 'Appointments',
      catalog: 'Services',
      scheduling: 'Doctor Schedule',
      inventory: 'Medical Records',
      billing: 'Patient Billing',
      staff: 'Doctors',
      analytics: 'Analytics',
    },
    spa: {
      operations: 'Appointments',
      catalog: 'Services',
      scheduling: 'Slots',
      inventory: 'Products',
      billing: 'Payments',
      staff: 'Therapists',
      analytics: 'Analytics',
    },
  };
  return labels[businessType]?.[genericResource] || genericResource;
}

/**
 * Check if user has permission for business operation
 */
export function canPerformBusinessOperation(
  userPermissions: string[],
  businessType: BusinessType,
  resource: string,
  action: string,
): boolean {
  const genericPermission = mapBusinessResource(businessType, resource, action);
  return userPermissions.includes(genericPermission);
}

/**
 * Get all business-specific operations for a generic action
 */
export function getBusinessOperations(
  businessType: BusinessType,
  genericPermission: string,
): string[] {
  const [genericResource, action] = genericPermission.split(':');
  const operations: string[] = [];
  const resourceMap = BUSINESS_RESOURCE_MAP[businessType];
  for (const [businessResource, mappedResource] of Object.entries(
    resourceMap,
  )) {
    if (mappedResource === genericResource) {
      operations.push(`${businessResource}:${action}`);
    }
  }
  return operations;
}
