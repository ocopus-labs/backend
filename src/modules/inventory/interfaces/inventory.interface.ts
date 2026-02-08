import { InventoryItem as PrismaInventoryItem } from '@prisma/client';

export type InventoryItem = PrismaInventoryItem;

export type InventoryStatus =
  | 'in_stock'
  | 'low_stock'
  | 'out_of_stock'
  | 'discontinued';

export const INVENTORY_STATUSES: Record<string, InventoryStatus> = {
  IN_STOCK: 'in_stock',
  LOW_STOCK: 'low_stock',
  OUT_OF_STOCK: 'out_of_stock',
  DISCONTINUED: 'discontinued',
};

export type TransactionType =
  | 'add'
  | 'remove'
  | 'adjust'
  | 'waste'
  | 'transfer';

export const TRANSACTION_TYPES: Record<string, TransactionType> = {
  ADD: 'add',
  REMOVE: 'remove',
  ADJUST: 'adjust',
  WASTE: 'waste',
  TRANSFER: 'transfer',
};

export interface InventoryTransaction {
  id: string;
  type: TransactionType;
  quantity: number;
  previousStock: number;
  newStock: number;
  reason?: string;
  reference?: string;
  performedBy: string;
  performedAt: string;
}

export interface LinkedMenuItem {
  menuItemId: string;
  itemName: string;
  quantityUsed: number;
  unit: string;
}

export interface InventoryAlert {
  type: 'low_stock' | 'expiry_warning' | 'out_of_stock';
  message: string;
  createdAt: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

export const INVENTORY_UNITS = [
  'kg',
  'g',
  'mg',
  'l',
  'ml',
  'piece',
  'dozen',
  'box',
  'pack',
  'bottle',
  'can',
  'bag',
] as const;

export type InventoryUnit = (typeof INVENTORY_UNITS)[number];

export const INVENTORY_CATEGORIES = [
  'raw_materials',
  'beverages',
  'dairy',
  'meat',
  'seafood',
  'vegetables',
  'fruits',
  'spices',
  'condiments',
  'packaging',
  'cleaning',
  'equipment',
  'other',
] as const;

export type InventoryCategory = (typeof INVENTORY_CATEGORIES)[number];
