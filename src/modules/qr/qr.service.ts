import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as QRCode from 'qrcode';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import type { UpiSettings, QrCodeResult } from './interfaces';
import { DEFAULT_UPI_SETTINGS } from './interfaces';

@Injectable()
export class QrService {
  private readonly logger = new Logger(QrService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getUpiSettings(businessId: string): Promise<UpiSettings> {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: businessId },
      select: { settings: true },
    });

    if (!restaurant) {
      throw new NotFoundException('Business not found');
    }

    const settings = restaurant.settings as Record<string, unknown>;
    return {
      ...DEFAULT_UPI_SETTINGS,
      ...(settings?.upi as Partial<UpiSettings>),
    };
  }

  async updateUpiSettings(
    businessId: string,
    updates: Partial<UpiSettings>,
    userId: string,
  ): Promise<UpiSettings> {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: businessId },
      select: { settings: true },
    });

    if (!restaurant) {
      throw new NotFoundException('Business not found');
    }

    const existingSettings = restaurant.settings as Record<string, unknown>;
    const currentUpi = {
      ...DEFAULT_UPI_SETTINGS,
      ...(existingSettings?.upi as Partial<UpiSettings>),
    };

    const newUpi: UpiSettings = {
      ...currentUpi,
      ...updates,
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.restaurant.update({
        where: { id: businessId },
        data: {
          settings: {
            ...existingSettings,
            upi: newUpi,
          } as object,
        },
      });

      await tx.auditLog.create({
        data: {
          restaurantId: businessId,
          userId,
          action: 'upi.settings_updated',
          resource: 'upi',
          details: { changes: updates } as object,
        },
      });
    });

    return newUpi;
  }

  async generatePaymentQr(
    businessId: string,
    amount: number,
    note?: string,
  ): Promise<QrCodeResult> {
    const upiSettings = await this.getUpiSettings(businessId);

    if (!upiSettings.enabled) {
      throw new BadRequestException('UPI payments are not enabled');
    }

    if (!upiSettings.vpa) {
      throw new BadRequestException('UPI VPA is not configured');
    }

    const upiString = this.buildUpiString(
      upiSettings.vpa,
      upiSettings.merchantName,
      amount,
      note,
    );

    const dataUrl = await QRCode.toDataURL(upiString, {
      width: 300,
      margin: 2,
    });

    return { dataUrl, upiString };
  }

  async generateTableQr(
    businessId: string,
    tableId: string,
    baseUrl: string,
  ): Promise<{ dataUrl: string; url: string }> {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: businessId },
      select: { slug: true },
    });

    if (!restaurant) {
      throw new NotFoundException('Business not found');
    }

    const table = await this.prisma.table.findFirst({
      where: { id: tableId, restaurantId: businessId },
    });

    if (!table) {
      throw new NotFoundException('Table not found');
    }

    const url = `${baseUrl}/order/${restaurant.slug}/${table.tableNumber}`;
    const dataUrl = await QRCode.toDataURL(url, {
      width: 300,
      margin: 2,
    });

    await this.prisma.table.update({
      where: { id: tableId },
      data: {
        qrCode: {
          url,
          dataUrl,
          generatedAt: new Date().toISOString(),
        } as object,
      },
    });

    return { dataUrl, url };
  }

  async generateAllTableQrs(
    businessId: string,
    baseUrl: string,
  ): Promise<{ count: number }> {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: businessId },
      select: { slug: true },
    });

    if (!restaurant) {
      throw new NotFoundException('Business not found');
    }

    const tables = await this.prisma.table.findMany({
      where: { restaurantId: businessId },
      orderBy: { tableNumber: 'asc' },
    });

    for (const table of tables) {
      const url = `${baseUrl}/order/${restaurant.slug}/${table.tableNumber}`;
      const dataUrl = await QRCode.toDataURL(url, {
        width: 300,
        margin: 2,
      });

      await this.prisma.table.update({
        where: { id: table.id },
        data: {
          qrCode: {
            url,
            dataUrl,
            generatedAt: new Date().toISOString(),
          } as object,
        },
      });
    }

    this.logger.log(
      `Generated QR codes for ${tables.length} tables in business ${businessId}`,
    );

    return { count: tables.length };
  }

  async getTableQr(
    businessId: string,
    tableId: string,
  ): Promise<{ qrCode: object | null }> {
    const table = await this.prisma.table.findFirst({
      where: { id: tableId, restaurantId: businessId },
      select: { qrCode: true },
    });

    if (!table) {
      throw new NotFoundException('Table not found');
    }

    return { qrCode: table.qrCode as object | null };
  }

  private buildUpiString(
    vpa: string,
    merchantName: string,
    amount?: number,
    note?: string,
  ): string {
    const params = new URLSearchParams();
    params.set('pa', vpa);
    params.set('pn', merchantName);
    if (amount !== undefined) {
      params.set('am', amount.toFixed(2));
    }
    params.set('cu', 'INR');
    if (note) {
      params.set('tn', note);
    }
    return `upi://pay?${params.toString()}`;
  }
}
