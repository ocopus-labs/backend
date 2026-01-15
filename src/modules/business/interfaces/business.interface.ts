import { Restaurant, BusinessUser } from '@prisma/client';

export interface BusinessAddress {
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface BusinessContact {
  email: string;
  phone: string;
  website?: string;
  socialMedia?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
  };
}

export interface BusinessSettings {
  timezone: string;
  currency: string;
  taxRate: string;
  businessHours?: {
    [day: string]: {
      open: string;
      close: string;
      isClosed?: boolean;
    };
  };
  features?: string[];
}

export interface BusinessInfo {
  type: string;
  subType?: string;
  metadata?: Record<string, unknown>;
}

export interface BusinessSubscription {
  plan: string;
  status: string;
  expiresAt?: Date;
  features?: string[];
}

export type Business = Restaurant;

export interface BusinessWithUsers extends Business {
  businessUsers: BusinessUser[];
}
