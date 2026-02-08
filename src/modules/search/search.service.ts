import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';

export interface SearchResult {
  type:
    | 'order'
    | 'menu_item'
    | 'team_member'
    | 'table'
    | 'expense'
    | 'inventory';
  id: string;
  title: string;
  subtitle?: string;
  status?: string;
  url: string;
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async globalSearch(
    businessId: string,
    query: string,
    types?: string[],
    limitPerType: number = 5,
  ) {
    const searchTypes = types || [
      'orders',
      'menu',
      'team',
      'tables',
      'expenses',
      'inventory',
    ];
    const results: SearchResult[] = [];

    const searches: Promise<SearchResult[]>[] = [];

    if (searchTypes.includes('orders')) {
      searches.push(this.searchOrders(businessId, query, limitPerType));
    }
    if (searchTypes.includes('menu')) {
      searches.push(this.searchMenuItems(businessId, query, limitPerType));
    }
    if (searchTypes.includes('team')) {
      searches.push(this.searchTeamMembers(businessId, query, limitPerType));
    }
    if (searchTypes.includes('tables')) {
      searches.push(this.searchTables(businessId, query, limitPerType));
    }
    if (searchTypes.includes('expenses')) {
      searches.push(this.searchExpenses(businessId, query, limitPerType));
    }
    if (searchTypes.includes('inventory')) {
      searches.push(this.searchInventory(businessId, query, limitPerType));
    }

    const searchResults = await Promise.all(searches);
    for (const batch of searchResults) {
      results.push(...batch);
    }

    return { query, results, totalCount: results.length };
  }

  private async searchOrders(
    businessId: string,
    query: string,
    limit: number,
  ): Promise<SearchResult[]> {
    const orders = await this.prisma.order.findMany({
      where: {
        restaurantId: businessId,
        deletedAt: null,
        OR: [{ orderNumber: { contains: query, mode: 'insensitive' } }],
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        customerInfo: true,
        createdAt: true,
      },
    });
    return orders.map((o) => ({
      type: 'order' as const,
      id: o.id,
      title: o.orderNumber,
      subtitle: (o.customerInfo as any)?.name || 'Guest',
      status: o.status,
      url: `/orders/${o.id}`,
    }));
  }

  private async searchTeamMembers(
    businessId: string,
    query: string,
    limit: number,
  ): Promise<SearchResult[]> {
    const members = await this.prisma.businessUser.findMany({
      where: {
        restaurantId: businessId,
        status: 'active',
        user: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        },
      },
      take: limit,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
    return members.map((m) => ({
      type: 'team_member' as const,
      id: m.id,
      title: m.user.name || m.user.email,
      subtitle: m.role,
      url: `/team`,
    }));
  }

  private async searchTables(
    businessId: string,
    query: string,
    limit: number,
  ): Promise<SearchResult[]> {
    const tables = await this.prisma.table.findMany({
      where: {
        restaurantId: businessId,
        OR: [
          { tableNumber: { contains: query, mode: 'insensitive' } },
          { displayName: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit,
      select: {
        id: true,
        tableNumber: true,
        displayName: true,
        status: true,
      },
    });
    return tables.map((t) => ({
      type: 'table' as const,
      id: t.id,
      title: t.displayName,
      subtitle: `Table ${t.tableNumber} - ${t.status}`,
      url: `/tables/layout`,
    }));
  }

  private async searchExpenses(
    businessId: string,
    query: string,
    limit: number,
  ): Promise<SearchResult[]> {
    const expenses = await this.prisma.expense.findMany({
      where: {
        restaurantId: businessId,
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { vendorName: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        vendorName: true,
        amount: true,
        status: true,
      },
    });
    return expenses.map((e) => ({
      type: 'expense' as const,
      id: e.id,
      title: e.title,
      subtitle: e.vendorName || '',
      status: e.status,
      url: `/expenses/daily`,
    }));
  }

  private async searchInventory(
    businessId: string,
    query: string,
    limit: number,
  ): Promise<SearchResult[]> {
    const items = await this.prisma.inventoryItem.findMany({
      where: {
        restaurantId: businessId,
        isActive: true,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { sku: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit,
      select: {
        id: true,
        name: true,
        sku: true,
        category: true,
        status: true,
      },
    });
    return items.map((i) => ({
      type: 'inventory' as const,
      id: i.id,
      title: i.name,
      subtitle: `${i.sku} - ${i.category}`,
      status: i.status,
      url: `/inventory/stock`,
    }));
  }

  private async searchMenuItems(
    businessId: string,
    query: string,
    limit: number,
  ): Promise<SearchResult[]> {
    const menuItems = await this.prisma.menuItem.findMany({
      where: { restaurantId: businessId },
      select: { id: true, categories: true },
    });

    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    for (const menu of menuItems) {
      const categories = menu.categories as any[];
      if (!Array.isArray(categories)) continue;

      for (const category of categories) {
        const items = category.items || [];
        for (const item of items) {
          if (item.name?.toLowerCase().includes(lowerQuery)) {
            results.push({
              type: 'menu_item' as const,
              id: `${menu.id}-${item.id || item.name}`,
              title: item.name,
              subtitle: category.name || '',
              url: `/menu/items`,
            });
            if (results.length >= limit) return results;
          }
        }
      }
    }

    return results;
  }
}
