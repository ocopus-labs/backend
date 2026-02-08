import { OrderService } from 'src/modules/order';
import { MenuService } from 'src/modules/menu';
import { TableService } from 'src/modules/table';
import { InventoryService } from 'src/modules/inventory';
import { PaymentService } from 'src/modules/payment';
import { AnalyticsService } from 'src/modules/analytics';
import { TeamService } from 'src/modules/team';
import { ExpenseService } from 'src/modules/expense';
import { SearchService } from 'src/modules/search';
import { BusinessService } from 'src/modules/business';
import { PrismaService } from 'src/modules/prisma/prisma.service';

export interface McpContext {
  businessId: string;
  userId: string;
  userName: string;
  apiKeyId: string;
  apiKeyName: string;
  scopes: string[];
  permissions: string[];

  hasScope(scope: string): boolean;
  hasPermission(perm: string): boolean;
  audit(
    action: string,
    resource: string,
    resourceId: string | null,
    details?: Record<string, unknown>,
  ): Promise<void>;

  // Injected services
  orderService: OrderService;
  menuService: MenuService;
  tableService: TableService;
  inventoryService: InventoryService;
  paymentService: PaymentService;
  analyticsService: AnalyticsService;
  teamService: TeamService;
  expenseService: ExpenseService;
  searchService: SearchService;
  businessService: BusinessService;
  prisma: PrismaService;
}

export const VALID_SCOPES = [
  'orders',
  'menu',
  'tables',
  'inventory',
  'payments',
  'analytics',
  'team',
  'expenses',
  'search',
] as const;

export type McpScope = (typeof VALID_SCOPES)[number];

export const VALID_PERMISSIONS = [
  'operations:create',
  'operations:read',
  'operations:update',
  'operations:cancel',
  'operations:complete',
  'operations:view_all',
  'catalog:create',
  'catalog:read',
  'catalog:update',
  'catalog:delete',
  'catalog:publish',
  'scheduling:create',
  'scheduling:read',
  'scheduling:update',
  'scheduling:delete',
  'scheduling:reserve',
  'scheduling:manage',
  'inventory:create',
  'inventory:read',
  'inventory:update',
  'inventory:delete',
  'inventory:manage_stock',
  'billing:create_invoice',
  'billing:read_invoice',
  'billing:process_payment',
  'billing:refund',
  'billing:view_reports',
  'analytics:view',
  'analytics:export',
  'analytics:advanced_reporting',
  'business:read',
  'business:update',
  'business:manage_settings',
  'expense:create',
  'expense:read',
  'expense:update',
  'expense:delete',
  'expense:approve',
  'expense:reject',
] as const;
