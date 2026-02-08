export interface OrderCustomerInfo {
  name?: string;
  phone?: string;
  email?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  };
}

export interface OrderItemModifier {
  id: string;
  name: string;
  price: number;
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  basePrice: number;
  totalPrice: number;
  modifiers?: {
    size?: OrderItemModifier;
    spiceLevel?: OrderItemModifier;
    preparation?: string[];
    addOns?: OrderItemModifier[];
    removals?: string[];
    specialInstructions?: string;
  };
  taxCode?: string;
  taxCategory?: string;
  taxRate?: number;
  status: 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled';
}

export interface OrderPricing {
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  discountAmount: number;
  serviceCharge?: number;
  total: number;
  taxBreakdown?: import('src/modules/tax/interfaces').TaxBreakdown;
}

export interface OrderTimestamps {
  placedAt: string;
  confirmedAt?: string;
  preparingAt?: string;
  readyAt?: string;
  completedAt?: string;
  cancelledAt?: string;
}

export interface OrderDiscount {
  id: string;
  code?: string;
  type: 'percentage' | 'fixed';
  value: number;
  amount: number;
  reason?: string;
}

export interface OrderAuditEntry {
  action: string;
  performedBy: string;
  performedAt: string;
  details?: Record<string, unknown>;
}

export type OrderType = 'dine_in' | 'takeaway' | 'delivery' | 'online';
export type OrderStatus = 'active' | 'completed' | 'cancelled' | 'refunded';
export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'refunded';
export type OrderPriority = 'low' | 'normal' | 'high' | 'urgent';
