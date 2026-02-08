import { Franchise, FranchiseUser } from '@prisma/client';

export type FranchiseEntity = Franchise;

export interface FranchiseWithBusinessCount extends Franchise {
  _count: { businesses: number; staff: number };
}

export interface FranchiseStaffMember extends FranchiseUser {
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
}

export interface FranchiseAnalytics {
  totalRevenue: number;
  totalOrders: number;
  totalLocations: number;
  totalStaff: number;
  locationBreakdown: {
    businessId: string;
    businessName: string;
    revenue: number;
    orders: number;
  }[];
}
