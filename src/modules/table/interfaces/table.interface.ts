import { Table as PrismaTable } from '@prisma/client';

export type Table = PrismaTable;

export interface TablePosition {
  x: number;
  y: number;
  floor?: string;
  section?: string;
}

export interface TableDimensions {
  width: number;
  height: number;
}

export interface TableQrCode {
  url: string;
  generatedAt: Date;
}

export interface TableSession {
  orderId: string;
  orderNumber: string;
  startedAt: Date;
  customerCount?: number;
  staffId?: string;
  staffName?: string;
}

export interface TableReservation {
  id: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  partySize: number;
  reservedAt: Date;
  duration: number; // in minutes
  notes?: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  createdAt: Date;
}

export interface TableMaintenanceLog {
  action: string;
  notes?: string;
  performedBy: string;
  performedAt: Date;
}

export interface TableSettings {
  minPartySize?: number;
  maxPartySize?: number;
  isReservable?: boolean;
  defaultTurnoverTime?: number; // in minutes
  notes?: string;
}

export type TableStatus = 'available' | 'occupied' | 'reserved' | 'maintenance' | 'out_of_service';

export const TABLE_STATUSES: Record<string, TableStatus> = {
  AVAILABLE: 'available',
  OCCUPIED: 'occupied',
  RESERVED: 'reserved',
  MAINTENANCE: 'maintenance',
  OUT_OF_SERVICE: 'out_of_service',
};

export const TABLE_SHAPES = ['square', 'round', 'rectangle', 'oval'] as const;
export type TableShape = (typeof TABLE_SHAPES)[number];
