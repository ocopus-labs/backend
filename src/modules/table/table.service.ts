import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import {
  CreateTableDto,
  UpdateTableDto,
  UpdateTableStatusDto,
  StartTableSessionDto,
  AddMaintenanceLogDto,
} from './dto';
import {
  Table,
  TableStatus,
  TABLE_STATUSES,
  TableSession,
  TableMaintenanceLog,
} from './interfaces';

@Injectable()
export class TableService {
  private readonly logger = new Logger(TableService.name);

  constructor(private prisma: PrismaService) {}

  async create(
    restaurantId: string,
    dto: CreateTableDto,
    userId: string,
  ): Promise<Table> {
    // Check for duplicate table number
    const existing = await this.prisma.table.findUnique({
      where: {
        restaurantId_tableNumber: {
          restaurantId,
          tableNumber: dto.tableNumber,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Table with number ${dto.tableNumber} already exists`,
      );
    }

    const table = await this.prisma.table.create({
      data: {
        restaurantId,
        tableNumber: dto.tableNumber,
        displayName: dto.displayName,
        capacity: dto.capacity,
        position: { ...dto.position },
        shape: dto.shape || 'square',
        dimensions: dto.dimensions ? { ...dto.dimensions } : null,
        status: TABLE_STATUSES.AVAILABLE,
        settings: dto.settings
          ? { ...dto.settings }
          : {
              isReservable: true,
              defaultTurnoverTime: 60,
            },
        reservations: [],
        maintenanceLog: [],
      },
    });

    await this.createAuditLog(restaurantId, userId, 'CREATE', 'table', table.id, {
      tableNumber: table.tableNumber,
    });

    this.logger.log(
      `Table ${table.tableNumber} created for restaurant ${restaurantId}`,
    );

    return table;
  }

  async findAll(restaurantId: string): Promise<Table[]> {
    return this.prisma.table.findMany({
      where: { restaurantId },
      orderBy: { tableNumber: 'asc' },
    });
  }

  async findById(restaurantId: string, id: string): Promise<Table | null> {
    return this.prisma.table.findFirst({
      where: { id, restaurantId },
    });
  }

  async findByIdOrFail(restaurantId: string, id: string): Promise<Table> {
    const table = await this.findById(restaurantId, id);
    if (!table) {
      throw new NotFoundException(`Table with ID ${id} not found`);
    }
    return table;
  }

  async findByTableNumber(
    restaurantId: string,
    tableNumber: string,
  ): Promise<Table | null> {
    return this.prisma.table.findUnique({
      where: {
        restaurantId_tableNumber: { restaurantId, tableNumber },
      },
    });
  }

  async findByStatus(
    restaurantId: string,
    status: TableStatus,
  ): Promise<Table[]> {
    return this.prisma.table.findMany({
      where: { restaurantId, status },
      orderBy: { tableNumber: 'asc' },
    });
  }

  async update(
    restaurantId: string,
    id: string,
    dto: UpdateTableDto,
    userId: string,
  ): Promise<Table> {
    const existing = await this.findByIdOrFail(restaurantId, id);

    // Check for duplicate table number if being changed
    if (dto.tableNumber && dto.tableNumber !== existing.tableNumber) {
      const duplicate = await this.findByTableNumber(
        restaurantId,
        dto.tableNumber,
      );
      if (duplicate) {
        throw new ConflictException(
          `Table with number ${dto.tableNumber} already exists`,
        );
      }
    }

    const updateData: Record<string, unknown> = {};

    if (dto.tableNumber) updateData.tableNumber = dto.tableNumber;
    if (dto.displayName) updateData.displayName = dto.displayName;
    if (dto.capacity !== undefined) updateData.capacity = dto.capacity;
    if (dto.position) updateData.position = dto.position;
    if (dto.shape) updateData.shape = dto.shape;
    if (dto.dimensions !== undefined) updateData.dimensions = dto.dimensions;
    if (dto.status) updateData.status = dto.status;
    if (dto.settings) {
      const currentSettings = existing.settings as Record<string, unknown>;
      updateData.settings = { ...currentSettings, ...dto.settings };
    }

    const table = await this.prisma.table.update({
      where: { id },
      data: updateData,
    });

    await this.createAuditLog(restaurantId, userId, 'UPDATE', 'table', id, {
      updatedFields: Object.keys(dto),
    });

    return table;
  }

  async updateStatus(
    restaurantId: string,
    id: string,
    dto: UpdateTableStatusDto,
    userId: string,
  ): Promise<Table> {
    const table = await this.findByIdOrFail(restaurantId, id);

    // Validate status transitions
    if (
      table.status === TABLE_STATUSES.OCCUPIED &&
      dto.status === TABLE_STATUSES.AVAILABLE
    ) {
      // Clear current session when marking as available
      const updatedTable = await this.prisma.table.update({
        where: { id },
        data: {
          status: dto.status,
          currentSession: null,
        },
      });

      await this.createAuditLog(
        restaurantId,
        userId,
        'UPDATE_STATUS',
        'table',
        id,
        { previousStatus: table.status, newStatus: dto.status },
      );

      return updatedTable;
    }

    const updatedTable = await this.prisma.table.update({
      where: { id },
      data: { status: dto.status },
    });

    await this.createAuditLog(
      restaurantId,
      userId,
      'UPDATE_STATUS',
      'table',
      id,
      { previousStatus: table.status, newStatus: dto.status, notes: dto.notes },
    );

    return updatedTable;
  }

  async startSession(
    restaurantId: string,
    id: string,
    dto: StartTableSessionDto,
    userId: string,
    userName: string,
  ): Promise<Table> {
    const table = await this.findByIdOrFail(restaurantId, id);

    if (table.status === TABLE_STATUSES.OCCUPIED) {
      throw new BadRequestException('Table is already occupied');
    }

    if (table.status === TABLE_STATUSES.OUT_OF_SERVICE) {
      throw new BadRequestException('Table is out of service');
    }

    if (table.status === TABLE_STATUSES.MAINTENANCE) {
      throw new BadRequestException('Table is under maintenance');
    }

    const session = {
      orderId: dto.orderId,
      orderNumber: dto.orderNumber,
      startedAt: new Date().toISOString(),
      customerCount: dto.customerCount,
      staffId: userId,
      staffName: userName,
    };

    const updatedTable = await this.prisma.table.update({
      where: { id },
      data: {
        status: TABLE_STATUSES.OCCUPIED,
        currentSession: session,
      },
    });

    await this.createAuditLog(
      restaurantId,
      userId,
      'START_SESSION',
      'table',
      id,
      { orderId: dto.orderId, orderNumber: dto.orderNumber },
    );

    this.logger.log(
      `Session started on table ${table.tableNumber} for order ${dto.orderNumber}`,
    );

    return updatedTable;
  }

  async endSession(
    restaurantId: string,
    id: string,
    userId: string,
  ): Promise<Table> {
    const table = await this.findByIdOrFail(restaurantId, id);

    // Idempotent: if table is already available with no session, just return it
    if (table.status === TABLE_STATUSES.AVAILABLE && !table.currentSession) {
      this.logger.log(`Table ${table.tableNumber} already available, skipping endSession`);
      return table;
    }

    const currentSession = table.currentSession as Record<string, unknown> | null;

    const updatedTable = await this.prisma.table.update({
      where: { id },
      data: {
        status: TABLE_STATUSES.AVAILABLE,
        currentSession: null,
      },
    });

    await this.createAuditLog(
      restaurantId,
      userId,
      'END_SESSION',
      'table',
      id,
      { previousSession: currentSession },
    );

    this.logger.log(`Session ended on table ${table.tableNumber}`);

    return updatedTable;
  }

  async addMaintenanceLog(
    restaurantId: string,
    id: string,
    dto: AddMaintenanceLogDto,
    userId: string,
    userName: string,
  ): Promise<Table> {
    const table = await this.findByIdOrFail(restaurantId, id);

    const existingLog = (table.maintenanceLog || []) as object[];

    const newLog = {
      action: dto.action,
      notes: dto.notes,
      performedBy: userName,
      performedAt: new Date().toISOString(),
    };

    const updatedTable = await this.prisma.table.update({
      where: { id },
      data: {
        maintenanceLog: [...existingLog, newLog] as object[],
        status: TABLE_STATUSES.MAINTENANCE,
      },
    });

    await this.createAuditLog(
      restaurantId,
      userId,
      'MAINTENANCE',
      'table',
      id,
      { action: dto.action },
    );

    return updatedTable;
  }

  async delete(
    restaurantId: string,
    id: string,
    userId: string,
  ): Promise<void> {
    const table = await this.findByIdOrFail(restaurantId, id);

    if (table.status === TABLE_STATUSES.OCCUPIED) {
      throw new BadRequestException(
        'Cannot delete an occupied table. End the session first.',
      );
    }

    // Check for active orders on this table
    const activeOrders = await this.prisma.order.count({
      where: {
        tableId: id,
        status: { in: ['active', 'pending'] },
      },
    });

    if (activeOrders > 0) {
      throw new BadRequestException(
        'Cannot delete table with active orders',
      );
    }

    await this.prisma.table.delete({
      where: { id },
    });

    await this.createAuditLog(
      restaurantId,
      userId,
      'DELETE',
      'table',
      id,
      { tableNumber: table.tableNumber },
    );

    this.logger.log(`Table ${table.tableNumber} deleted from restaurant ${restaurantId}`);
  }

  async getTableStats(restaurantId: string): Promise<{
    total: number;
    available: number;
    occupied: number;
    reserved: number;
    maintenance: number;
    outOfService: number;
    totalCapacity: number;
    occupiedCapacity: number;
  }> {
    const tables = await this.findAll(restaurantId);

    const stats = {
      total: tables.length,
      available: 0,
      occupied: 0,
      reserved: 0,
      maintenance: 0,
      outOfService: 0,
      totalCapacity: 0,
      occupiedCapacity: 0,
    };

    for (const table of tables) {
      stats.totalCapacity += table.capacity;

      switch (table.status) {
        case TABLE_STATUSES.AVAILABLE:
          stats.available++;
          break;
        case TABLE_STATUSES.OCCUPIED:
          stats.occupied++;
          stats.occupiedCapacity += table.capacity;
          break;
        case TABLE_STATUSES.RESERVED:
          stats.reserved++;
          break;
        case TABLE_STATUSES.MAINTENANCE:
          stats.maintenance++;
          break;
        case TABLE_STATUSES.OUT_OF_SERVICE:
          stats.outOfService++;
          break;
      }
    }

    return stats;
  }

  private async createAuditLog(
    restaurantId: string,
    userId: string,
    action: string,
    resource: string,
    resourceId: string,
    details: Record<string, unknown>,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        restaurantId,
        userId,
        action,
        resource,
        resourceId,
        details: {
          ...details,
          ipAddress: context?.ipAddress,
          userAgent: context?.userAgent,
        } as object,
      },
    });
  }
}
