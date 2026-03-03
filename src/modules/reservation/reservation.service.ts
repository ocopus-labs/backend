import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { CreateReservationDto, UpdateReservationDto } from './dto';

const DEFAULT_DURATION = 90; // minutes

@Injectable()
export class ReservationService {
  private readonly logger = new Logger(ReservationService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Check if a table has a conflicting reservation at the given date/time.
   * Two reservations conflict if their time windows overlap on the same date.
   */
  private async checkTableConflict(
    tableId: string,
    reservationDate: string,
    reservationTime: string,
    duration: number | null | undefined,
    excludeReservationId?: string,
  ): Promise<void> {
    const existing = await this.prisma.reservation.findMany({
      where: {
        tableId,
        reservationDate,
        status: { in: ['pending', 'confirmed', 'seated'] },
        ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
      },
    });

    if (existing.length === 0) return;

    const newDuration = duration || DEFAULT_DURATION;
    const [newH, newM] = reservationTime.split(':').map(Number);
    const newStart = newH * 60 + newM;
    const newEnd = newStart + newDuration;

    for (const res of existing) {
      const [h, m] = res.reservationTime.split(':').map(Number);
      const existStart = h * 60 + m;
      const existEnd = existStart + (res.duration || DEFAULT_DURATION);

      // Two intervals overlap if one starts before the other ends
      if (newStart < existEnd && existStart < newEnd) {
        throw new ConflictException(
          `Table is already reserved from ${res.reservationTime} to ${this.minutesToTime(existEnd)} by ${res.customerName}`,
        );
      }
    }
  }

  private minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  async create(
    restaurantId: string,
    dto: CreateReservationDto,
    userId: string,
  ) {
    if (dto.tableId) {
      const table = await this.prisma.table.findFirst({
        where: { id: dto.tableId, restaurantId },
      });
      if (!table) {
        throw new BadRequestException('Table not found');
      }

      await this.checkTableConflict(
        dto.tableId,
        dto.reservationDate,
        dto.reservationTime,
        dto.duration,
      );
    }

    const reservation = await this.prisma.reservation.create({
      data: {
        restaurantId,
        tableId: dto.tableId || null,
        customerName: dto.customerName,
        customerPhone: dto.customerPhone || null,
        customerEmail: dto.customerEmail || null,
        partySize: dto.partySize,
        reservationDate: dto.reservationDate,
        reservationTime: dto.reservationTime,
        duration: dto.duration || null,
        notes: dto.notes || null,
        specialRequests: dto.specialRequests || null,
        source: 'manual',
        createdBy: userId,
        status: 'pending',
      },
      include: { table: true },
    });

    await this.createAuditLog(
      restaurantId,
      userId,
      'CREATE',
      'reservation',
      reservation.id,
      { customerName: dto.customerName, reservationDate: dto.reservationDate },
    );

    this.logger.log(
      `Reservation created for ${dto.customerName} on ${dto.reservationDate} at restaurant ${restaurantId}`,
    );

    return reservation;
  }

  async findAll(
    restaurantId: string,
    params: {
      date?: string;
      startDate?: string;
      endDate?: string;
      status?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const where: Record<string, unknown> = { restaurantId };

    if (params.date) {
      where.reservationDate = params.date;
    } else if (params.startDate || params.endDate) {
      const dateFilter: Record<string, string> = {};
      if (params.startDate) dateFilter.gte = params.startDate;
      if (params.endDate) dateFilter.lte = params.endDate;
      where.reservationDate = dateFilter;
    }

    if (params.status) {
      where.status = params.status;
    }

    const [reservations, total] = await Promise.all([
      this.prisma.reservation.findMany({
        where,
        include: { table: true },
        orderBy: [
          { reservationDate: 'asc' },
          { reservationTime: 'asc' },
        ],
        take: params.limit || 50,
        skip: params.offset || 0,
      }),
      this.prisma.reservation.count({ where }),
    ]);

    return { reservations, total };
  }

  async findById(restaurantId: string, id: string) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id, restaurantId },
      include: { table: true },
    });

    if (!reservation) {
      throw new NotFoundException(`Reservation with ID ${id} not found`);
    }

    return reservation;
  }

  async update(
    restaurantId: string,
    id: string,
    dto: UpdateReservationDto,
    userId: string,
  ) {
    const existing = await this.findById(restaurantId, id);

    if (dto.tableId) {
      const table = await this.prisma.table.findFirst({
        where: { id: dto.tableId, restaurantId },
      });
      if (!table) {
        throw new BadRequestException('Table not found');
      }
    }

    // Check table conflict if table, date, or time is changing
    const effectiveTableId = dto.tableId !== undefined ? dto.tableId : existing.tableId;
    const effectiveDate = dto.reservationDate || existing.reservationDate;
    const effectiveTime = dto.reservationTime || existing.reservationTime;
    const effectiveDuration = dto.duration !== undefined ? dto.duration : existing.duration;

    if (effectiveTableId) {
      await this.checkTableConflict(
        effectiveTableId,
        effectiveDate,
        effectiveTime,
        effectiveDuration,
        id,
      );
    }

    const updateData: Record<string, unknown> = {};

    if (dto.tableId !== undefined) updateData.tableId = dto.tableId || null;
    if (dto.customerName) updateData.customerName = dto.customerName;
    if (dto.customerPhone !== undefined)
      updateData.customerPhone = dto.customerPhone || null;
    if (dto.customerEmail !== undefined)
      updateData.customerEmail = dto.customerEmail || null;
    if (dto.partySize !== undefined) updateData.partySize = dto.partySize;
    if (dto.reservationDate) updateData.reservationDate = dto.reservationDate;
    if (dto.reservationTime) updateData.reservationTime = dto.reservationTime;
    if (dto.duration !== undefined) updateData.duration = dto.duration || null;
    if (dto.status) updateData.status = dto.status;
    if (dto.notes !== undefined) updateData.notes = dto.notes || null;
    if (dto.specialRequests !== undefined)
      updateData.specialRequests = dto.specialRequests || null;

    const reservation = await this.prisma.reservation.update({
      where: { id },
      data: updateData,
      include: { table: true },
    });

    await this.createAuditLog(
      restaurantId,
      userId,
      'UPDATE',
      'reservation',
      id,
      { updatedFields: Object.keys(dto) },
    );

    return reservation;
  }

  async confirm(restaurantId: string, id: string, userId: string) {
    const reservation = await this.findById(restaurantId, id);

    if (reservation.status !== 'pending') {
      throw new BadRequestException(
        `Cannot confirm reservation with status "${reservation.status}"`,
      );
    }

    const updated = await this.prisma.reservation.update({
      where: { id },
      data: {
        status: 'confirmed',
        confirmedAt: new Date(),
      },
      include: { table: true },
    });

    // Mark table as reserved if it has an assigned table
    if (reservation.tableId) {
      await this.syncTableStatus(reservation.tableId, restaurantId);
    }

    await this.createAuditLog(
      restaurantId,
      userId,
      'CONFIRM',
      'reservation',
      id,
      {},
    );

    return updated;
  }

  async cancel(
    restaurantId: string,
    id: string,
    userId: string,
    reason?: string,
  ) {
    const reservation = await this.findById(restaurantId, id);

    if (
      reservation.status === 'completed' ||
      reservation.status === 'cancelled'
    ) {
      throw new BadRequestException(
        `Cannot cancel reservation with status "${reservation.status}"`,
      );
    }

    const updated = await this.prisma.reservation.update({
      where: { id },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationReason: reason || null,
      },
      include: { table: true },
    });

    // Re-evaluate table status (may revert to available if no other reservations)
    if (reservation.tableId) {
      await this.syncTableStatus(reservation.tableId, restaurantId);
    }

    await this.createAuditLog(
      restaurantId,
      userId,
      'CANCEL',
      'reservation',
      id,
      { reason },
    );

    return updated;
  }

  async seat(
    restaurantId: string,
    id: string,
    userId: string,
    tableId?: string,
  ) {
    const reservation = await this.findById(restaurantId, id);

    if (
      reservation.status !== 'pending' &&
      reservation.status !== 'confirmed'
    ) {
      throw new BadRequestException(
        `Cannot seat reservation with status "${reservation.status}"`,
      );
    }

    const updateData: Record<string, unknown> = {
      status: 'seated',
      seatedAt: new Date(),
    };

    const seatTableId = tableId || reservation.tableId;
    if (tableId) {
      const table = await this.prisma.table.findFirst({
        where: { id: tableId, restaurantId },
      });
      if (!table) {
        throw new BadRequestException('Table not found');
      }
      updateData.tableId = tableId;
    }

    if (seatTableId) {
      await this.checkTableConflict(
        seatTableId,
        reservation.reservationDate,
        reservation.reservationTime,
        reservation.duration,
        id,
      );
    }

    const updated = await this.prisma.reservation.update({
      where: { id },
      data: updateData,
      include: { table: true },
    });

    await this.createAuditLog(
      restaurantId,
      userId,
      'SEAT',
      'reservation',
      id,
      { tableId: tableId || reservation.tableId },
    );

    return updated;
  }

  async complete(restaurantId: string, id: string, userId: string) {
    const reservation = await this.findById(restaurantId, id);

    if (reservation.status !== 'seated' && reservation.status !== 'confirmed') {
      throw new BadRequestException(
        `Cannot complete reservation with status "${reservation.status}"`,
      );
    }

    const updated = await this.prisma.reservation.update({
      where: { id },
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
      include: { table: true },
    });

    // Re-evaluate table status
    if (reservation.tableId) {
      await this.syncTableStatus(reservation.tableId, restaurantId);
    }

    await this.createAuditLog(
      restaurantId,
      userId,
      'COMPLETE',
      'reservation',
      id,
      {},
    );

    return updated;
  }

  async delete(restaurantId: string, id: string, userId: string) {
    await this.findById(restaurantId, id);

    await this.prisma.reservation.delete({
      where: { id },
    });

    await this.createAuditLog(
      restaurantId,
      userId,
      'DELETE',
      'reservation',
      id,
      {},
    );

    this.logger.log(
      `Reservation ${id} deleted from restaurant ${restaurantId}`,
    );
  }

  async getStats(restaurantId: string) {
    const today = new Date().toISOString().split('T')[0];

    const [total, todayCount, pending, confirmed, cancelled, upcoming] =
      await Promise.all([
        this.prisma.reservation.count({ where: { restaurantId } }),
        this.prisma.reservation.count({
          where: { restaurantId, reservationDate: today },
        }),
        this.prisma.reservation.count({
          where: { restaurantId, status: 'pending' },
        }),
        this.prisma.reservation.count({
          where: { restaurantId, status: 'confirmed' },
        }),
        this.prisma.reservation.count({
          where: { restaurantId, status: 'cancelled' },
        }),
        this.prisma.reservation.count({
          where: {
            restaurantId,
            reservationDate: { gte: today },
            status: { in: ['pending', 'confirmed'] },
          },
        }),
      ]);

    return {
      total,
      today: todayCount,
      upcoming,
      pending,
      confirmed,
      cancelled,
    };
  }

  /**
   * Sync a table's status based on its active reservations.
   * - If there's an active (pending/confirmed) reservation for today, set to 'reserved'
   * - Otherwise, leave it alone (don't override 'occupied' or 'maintenance')
   * - If table was 'reserved' and no more active reservations, set back to 'available'
   */
  async syncTableStatus(
    tableId: string,
    restaurantId: string,
  ): Promise<void> {
    const table = await this.prisma.table.findFirst({
      where: { id: tableId, restaurantId },
    });
    if (!table) return;

    // Don't touch occupied/maintenance/out_of_service tables
    if (
      table.status === 'occupied' ||
      table.status === 'maintenance' ||
      table.status === 'out_of_service'
    ) {
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const activeReservations = await this.prisma.reservation.count({
      where: {
        tableId,
        reservationDate: today,
        status: { in: ['pending', 'confirmed'] },
      },
    });

    if (activeReservations > 0 && table.status !== 'reserved') {
      await this.prisma.table.update({
        where: { id: tableId },
        data: { status: 'reserved' },
      });
    } else if (activeReservations === 0 && table.status === 'reserved') {
      await this.prisma.table.update({
        where: { id: tableId },
        data: { status: 'available' },
      });
    }
  }

  /**
   * Called by TableService when starting a session on a reserved table.
   * Finds the active reservation for this table and marks it as seated.
   */
  async seatActiveReservation(
    tableId: string,
    restaurantId: string,
  ): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    const reservation = await this.prisma.reservation.findFirst({
      where: {
        tableId,
        restaurantId,
        reservationDate: today,
        status: { in: ['pending', 'confirmed'] },
      },
      orderBy: { reservationTime: 'asc' },
    });

    if (reservation) {
      await this.prisma.reservation.update({
        where: { id: reservation.id },
        data: {
          status: 'seated',
          seatedAt: new Date(),
        },
      });

      this.logger.log(
        `Auto-seated reservation ${reservation.id} for ${reservation.customerName}`,
      );
    }
  }

  private async createAuditLog(
    restaurantId: string,
    userId: string,
    action: string,
    resource: string,
    resourceId: string,
    details: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        restaurantId,
        userId,
        action,
        resource,
        resourceId,
        details: details as object,
      },
    });
  }
}
