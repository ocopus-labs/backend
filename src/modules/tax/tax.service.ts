import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import type { TaxSettings, TaxRegime } from './interfaces';
import { DEFAULT_TAX_SETTINGS } from './interfaces';
import { REGIME_CONFIGS } from './utils/regime-config';
import { validateRegistrationNumber } from './utils/tax-validators';

@Injectable()
export class TaxService {
  private readonly logger = new Logger(TaxService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getSettings(businessId: string): Promise<TaxSettings> {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: businessId },
      select: { settings: true },
    });

    if (!restaurant) {
      throw new NotFoundException('Business not found');
    }

    const settings = restaurant.settings as Record<string, unknown>;
    return {
      ...DEFAULT_TAX_SETTINGS,
      ...(settings?.tax as Partial<TaxSettings>),
    };
  }

  async updateSettings(
    businessId: string,
    updates: Partial<TaxSettings>,
    userId: string,
  ): Promise<TaxSettings> {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: businessId },
      select: { settings: true },
    });

    if (!restaurant) {
      throw new NotFoundException('Business not found');
    }

    const existingSettings = restaurant.settings as Record<string, unknown>;
    const currentTax = {
      ...DEFAULT_TAX_SETTINGS,
      ...(existingSettings?.tax as Partial<TaxSettings>),
    };

    const newTax: TaxSettings = {
      ...currentTax,
      ...updates,
      // Merge nested configs rather than replacing
      ...(updates.gstConfig && {
        gstConfig: { ...currentTax.gstConfig, ...updates.gstConfig },
      }),
      ...(updates.vatConfig && {
        vatConfig: { ...currentTax.vatConfig, ...updates.vatConfig },
      }),
      ...(updates.salesTaxConfig && {
        salesTaxConfig: {
          ...currentTax.salesTaxConfig,
          ...updates.salesTaxConfig,
        },
      }),
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.restaurant.update({
        where: { id: businessId },
        data: {
          settings: {
            ...existingSettings,
            tax: newTax,
          } as object,
        },
      });

      await tx.auditLog.create({
        data: {
          restaurantId: businessId,
          userId,
          action: 'tax.settings_updated',
          resource: 'tax',
          details: { changes: updates } as object,
        },
      });
    });

    return newTax;
  }

  async validateRegistration(regime: TaxRegime, registrationNumber: string) {
    return validateRegistrationNumber(regime, registrationNumber);
  }

  getRegimes() {
    return Object.entries(REGIME_CONFIGS).map(([key, config]) => ({
      id: key as TaxRegime,
      name: config.name,
      registrationLabel: config.registrationLabel,
      componentNames: config.componentNames,
      standardRates: config.standardRates,
      taxCodeLabel: config.taxCodeLabel,
      regions: config.regions,
      categories: config.categories,
    }));
  }

  getRegimeConfig(regime: TaxRegime) {
    const config = REGIME_CONFIGS[regime];
    if (!config) {
      throw new BadRequestException(`Unknown tax regime: ${regime}`);
    }
    return config;
  }

  async generateInvoiceNumber(businessId: string): Promise<string> {
    const taxSettings = await this.getSettings(businessId);

    if (!taxSettings.enabled) {
      throw new BadRequestException('Tax is not enabled for this business');
    }

    const fy = this.getCurrentFinancialYear(taxSettings.financialYearStart);
    const prefix = taxSettings.invoicePrefix || 'INV';

    const result = await this.prisma.$transaction(async (tx) => {
      // Upsert the counter — create if not exists, increment if exists
      const counter = await tx.invoiceCounter.upsert({
        where: {
          restaurantId_financialYear: {
            restaurantId: businessId,
            financialYear: fy,
          },
        },
        update: {
          lastNumber: { increment: 1 },
        },
        create: {
          restaurantId: businessId,
          financialYear: fy,
          lastNumber: 1,
        },
      });

      return this.formatInvoiceNumber(prefix, fy, counter.lastNumber);
    });

    return result;
  }

  getCurrentFinancialYear(startMonth: number): string {
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-based
    const currentYear = now.getFullYear();

    if (startMonth === 1) {
      return String(currentYear);
    }

    // For non-January starts (e.g., April for India)
    if (currentMonth >= startMonth) {
      return `${currentYear}-${String(currentYear + 1).slice(2)}`;
    }
    return `${currentYear - 1}-${String(currentYear).slice(2)}`;
  }

  private formatInvoiceNumber(prefix: string, fy: string, seq: number): string {
    const paddedSeq = String(seq).padStart(4, '0');
    return `${prefix}/${fy}/${paddedSeq}`;
  }
}
