export interface PlanFeatures {
  kitchenDisplay: boolean;
  analytics: 'basic' | 'advanced';
  inventory: boolean;
  expenses: boolean;
  api: boolean;
  whiteLabel: boolean;
}

export interface SubscriptionLimits {
  maxLocations: number;
  maxTeamMembers: number;
  maxOrdersPerMonth: number;
}

export interface UsageStats {
  ordersThisMonth: number;
  orderLimit: number;
  locationsCount: number;
  locationLimit: number;
  teamMembersCount: number;
  teamMemberLimit: number;
  periodStart: Date;
  periodEnd: Date;
}

export interface LimitCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
  message?: string;
}
