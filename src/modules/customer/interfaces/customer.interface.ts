export interface CustomerAddress {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}

export interface CustomerStats {
  total: number;
  active: number;
  inactive: number;
  newThisMonth: number;
}

export interface CustomerWithOrderStats {
  id: string;
  name: string;
  phone: string;
  email?: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate?: Date;
}
