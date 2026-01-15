export const BUSINESS_TYPES = {
  RESTAURANT: 'restaurant',
  CAFE: 'cafe',
  BAR: 'bar',
  SALON: 'salon',
  SPA: 'spa',
  GYM: 'gym',
  RETAIL: 'retail',
  CLINIC: 'clinic',
  OTHER: 'other',
} as const;

export type BusinessType = (typeof BUSINESS_TYPES)[keyof typeof BUSINESS_TYPES];

export const RESTAURANT_SUBTYPES = {
  FINE_DINING: 'fine-dining',
  CASUAL_DINING: 'casual-dining',
  QUICK_SERVICE: 'quick-service',
  FAST_FOOD: 'fast-food',
  BUFFET: 'buffet',
  FOOD_TRUCK: 'food-truck',
  CLOUD_KITCHEN: 'cloud-kitchen',
} as const;

export type RestaurantSubtype = (typeof RESTAURANT_SUBTYPES)[keyof typeof RESTAURANT_SUBTYPES];

export const BUSINESS_TYPE_CONFIG = {
  [BUSINESS_TYPES.RESTAURANT]: {
    label: 'Restaurant',
    description: 'Full-service restaurant with dine-in, takeaway, or delivery',
    subtypes: Object.values(RESTAURANT_SUBTYPES),
    features: ['menu', 'tables', 'orders', 'kitchen-display'],
  },
  [BUSINESS_TYPES.CAFE]: {
    label: 'Cafe',
    description: 'Coffee shop or casual eatery',
    subtypes: [],
    features: ['menu', 'orders', 'quick-checkout'],
  },
  [BUSINESS_TYPES.BAR]: {
    label: 'Bar / Pub',
    description: 'Bar, pub, or nightclub',
    subtypes: [],
    features: ['menu', 'tables', 'orders', 'age-verification'],
  },
  [BUSINESS_TYPES.SALON]: {
    label: 'Salon / Spa',
    description: 'Hair salon, nail salon, or spa',
    subtypes: ['hair-salon', 'nail-salon', 'beauty-salon', 'spa'],
    features: ['services', 'appointments', 'staff-scheduling'],
  },
  [BUSINESS_TYPES.GYM]: {
    label: 'Gym / Fitness',
    description: 'Gym, fitness center, or yoga studio',
    subtypes: ['gym', 'yoga-studio', 'crossfit', 'pilates'],
    features: ['memberships', 'classes', 'attendance'],
  },
  [BUSINESS_TYPES.RETAIL]: {
    label: 'Retail Store',
    description: 'Retail shop or boutique',
    subtypes: ['clothing', 'electronics', 'grocery', 'general'],
    features: ['inventory', 'pos', 'customers'],
  },
  [BUSINESS_TYPES.CLINIC]: {
    label: 'Clinic',
    description: 'Medical or dental clinic',
    subtypes: ['medical', 'dental', 'veterinary'],
    features: ['appointments', 'patients', 'prescriptions'],
  },
  [BUSINESS_TYPES.OTHER]: {
    label: 'Other',
    description: 'Other type of business',
    subtypes: [],
    features: ['basic-pos'],
  },
} as const;

export function isValidBusinessType(type: string): type is BusinessType {
  return Object.values(BUSINESS_TYPES).includes(type as BusinessType);
}

export function getBusinessTypeConfig(type: BusinessType) {
  return BUSINESS_TYPE_CONFIG[type];
}
