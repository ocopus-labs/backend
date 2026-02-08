import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { TaxService } from './tax.service';
import type { TaxSettings, TaxRegime, TaxBreakdown } from './interfaces';

interface OrderForExport {
  id: string;
  orderNumber: string;
  invoiceNumber: string | null;
  customerId: string | null;
  customerInfo: Record<string, unknown>;
  items: Array<{
    name: string;
    quantity: number;
    basePrice: number;
    totalPrice: number;
    taxCode?: string;
    taxCategory?: string;
    taxRate?: number;
  }>;
  pricing: {
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    total: number;
    taxBreakdown?: TaxBreakdown;
  };
  status: string;
  paymentStatus: string;
  createdAt: Date;
}

interface CustomerForExport {
  id: string;
  name: string;
  phone: string;
  taxId: string | null;
}

// ==================== EXPORT RESULT TYPES ====================

export interface TaxReportSummary {
  regime: string;
  regimeName: string;
  period: { from: string; to: string };
  businessInfo: {
    registrationNumber: string;
    legalName: string;
    regionCode: string;
    regionName: string;
  };
  totalInvoices: number;
  totalTaxableValue: number;
  totalTaxCollected: number;
  totalGrossValue: number;
  componentTotals: Record<string, number>;
  rateSummary: Array<{
    rate: number;
    taxableValue: number;
    taxAmount: number;
    invoiceCount: number;
  }>;
}

interface GstrB2BEntry {
  customerTaxId: string;
  customerName: string;
  invoices: Array<{
    invoiceNumber: string;
    invoiceDate: string;
    taxableValue: number;
    rate: number;
    cgst: number;
    sgst: number;
    igst: number;
    total: number;
  }>;
}

interface GstrHsnEntry {
  hsnCode: string;
  description: string;
  quantity: number;
  taxableValue: number;
  rate: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
}

export interface GstReport extends TaxReportSummary {
  b2b: GstrB2BEntry[];
  b2cLarge: Array<{
    invoiceNumber: string;
    invoiceDate: string;
    placeOfSupply: string;
    taxableValue: number;
    rate: number;
    igst: number;
  }>;
  b2cSmall: {
    taxableValue: number;
    cgst: number;
    sgst: number;
    totalTax: number;
  };
  hsnSummary: GstrHsnEntry[];
}

export interface VatReport extends TaxReportSummary {
  domesticSales: Array<{
    invoiceNumber: string;
    invoiceDate: string;
    customerName: string;
    taxableValue: number;
    vatRate: number;
    vatAmount: number;
    total: number;
  }>;
  ecSalesList?: Array<{
    customerVatId: string;
    customerName: string;
    country: string;
    totalValue: number;
  }>;
}

export interface SalesTaxReport extends TaxReportSummary {
  stateBreakdown: Array<{
    state: string;
    taxableValue: number;
    taxAmount: number;
    invoiceCount: number;
  }>;
}

type TaxExportResult =
  | GstReport
  | VatReport
  | SalesTaxReport
  | TaxReportSummary;

@Injectable()
export class TaxExportService {
  private readonly logger = new Logger(TaxExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly taxService: TaxService,
  ) {}

  async exportTaxReport(
    businessId: string,
    from: string,
    to: string,
    format: 'json' | 'csv' = 'json',
  ): Promise<{ data: TaxExportResult; csv?: string }> {
    const taxSettings = await this.taxService.getSettings(businessId);

    if (!taxSettings.enabled) {
      throw new BadRequestException('Tax is not enabled for this business');
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new BadRequestException('Invalid date range');
    }

    // Fetch paid orders in the date range
    const orders = await this.prisma.order.findMany({
      where: {
        restaurantId: businessId,
        paymentStatus: 'paid',
        createdAt: { gte: fromDate, lte: toDate },
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Fetch customers for B2B matching
    const customerIds = [
      ...new Set(orders.map((o) => o.customerId).filter(Boolean)),
    ] as string[];
    const customers =
      customerIds.length > 0
        ? await this.prisma.customer.findMany({
            where: { id: { in: customerIds }, restaurantId: businessId },
            select: { id: true, name: true, phone: true, taxId: true },
          })
        : [];

    const customerMap = new Map(customers.map((c) => [c.id, c]));

    const typedOrders: OrderForExport[] = orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      invoiceNumber: o.invoiceNumber,
      customerId: o.customerId,
      customerInfo: (o.customerInfo || {}) as Record<string, unknown>,
      items: (o.items as unknown as OrderForExport['items']) || [],
      pricing: (o.pricing as unknown as OrderForExport['pricing']) || {
        subtotal: 0,
        taxRate: 0,
        taxAmount: 0,
        total: 0,
      },
      status: o.status,
      paymentStatus: o.paymentStatus,
      createdAt: o.createdAt,
    }));

    let report: TaxExportResult;

    switch (taxSettings.regime) {
      case 'gst_india':
        report = this.buildGstReport(
          typedOrders,
          customerMap,
          taxSettings,
          from,
          to,
        );
        break;
      case 'vat_eu':
      case 'vat_uk':
        report = this.buildVatReport(
          typedOrders,
          customerMap,
          taxSettings,
          from,
          to,
        );
        break;
      case 'sales_tax_us':
        report = this.buildSalesTaxReport(
          typedOrders,
          customerMap,
          taxSettings,
          from,
          to,
        );
        break;
      default:
        report = this.buildGenericReport(typedOrders, taxSettings, from, to);
    }

    if (format === 'csv') {
      const csv = this.convertToCsv(report, taxSettings.regime);
      return { data: report, csv };
    }

    return { data: report };
  }

  // ==================== GST INDIA ====================

  private buildGstReport(
    orders: OrderForExport[],
    customerMap: Map<string, CustomerForExport>,
    settings: TaxSettings,
    from: string,
    to: string,
  ): GstReport {
    const summary = this.buildSummary(orders, settings, from, to);

    // B2B: Orders with customer having GSTIN
    const b2bMap = new Map<string, GstrB2BEntry>();
    const b2cLargeInvoices: GstReport['b2cLarge'] = [];
    const b2cSmall = { taxableValue: 0, cgst: 0, sgst: 0, totalTax: 0 };

    for (const order of orders) {
      const customer = order.customerId
        ? customerMap.get(order.customerId)
        : null;
      const breakdown = order.pricing.taxBreakdown;
      const componentTotals = breakdown?.componentTotals || {};

      const cgst = componentTotals['CGST'] || 0;
      const sgst = componentTotals['SGST'] || 0;
      const igst = componentTotals['IGST'] || 0;
      const isInterState = igst > 0;

      if (customer?.taxId) {
        // B2B transaction
        let entry = b2bMap.get(customer.taxId);
        if (!entry) {
          entry = {
            customerTaxId: customer.taxId,
            customerName: customer.name,
            invoices: [],
          };
          b2bMap.set(customer.taxId, entry);
        }
        entry.invoices.push({
          invoiceNumber: order.invoiceNumber || order.orderNumber,
          invoiceDate: order.createdAt.toISOString().split('T')[0],
          taxableValue: order.pricing.subtotal,
          rate: order.pricing.taxRate,
          cgst,
          sgst,
          igst,
          total: order.pricing.total,
        });
      } else if (isInterState && order.pricing.total > 250000) {
        // B2C Large (inter-state > 2.5 lakh)
        b2cLargeInvoices.push({
          invoiceNumber: order.invoiceNumber || order.orderNumber,
          invoiceDate: order.createdAt.toISOString().split('T')[0],
          placeOfSupply:
            settings.gstConfig?.placeOfSupply || settings.regionCode,
          taxableValue: order.pricing.subtotal,
          rate: order.pricing.taxRate,
          igst,
        });
      } else {
        // B2C Small
        b2cSmall.taxableValue += order.pricing.subtotal;
        b2cSmall.cgst += cgst;
        b2cSmall.sgst += sgst;
        b2cSmall.totalTax += cgst + sgst + igst;
      }
    }

    // HSN Summary
    const hsnMap = new Map<string, GstrHsnEntry>();
    for (const order of orders) {
      const breakdown = order.pricing.taxBreakdown;
      if (!breakdown) continue;

      for (const itemBreakdown of breakdown.items) {
        const hsnCode = itemBreakdown.taxCode || 'NA';
        let entry = hsnMap.get(hsnCode);
        if (!entry) {
          entry = {
            hsnCode,
            description: itemBreakdown.itemName,
            quantity: 0,
            taxableValue: 0,
            rate: itemBreakdown.taxRate,
            cgst: 0,
            sgst: 0,
            igst: 0,
            totalTax: 0,
          };
          hsnMap.set(hsnCode, entry);
        }
        entry.quantity += 1;
        entry.taxableValue += itemBreakdown.taxableValue;
        for (const comp of itemBreakdown.components) {
          if (comp.name === 'CGST') entry.cgst += comp.amount;
          else if (comp.name === 'SGST') entry.sgst += comp.amount;
          else if (comp.name === 'IGST') entry.igst += comp.amount;
        }
        entry.totalTax += itemBreakdown.totalTax;
      }
    }

    return {
      ...summary,
      b2b: Array.from(b2bMap.values()),
      b2cLarge: b2cLargeInvoices,
      b2cSmall,
      hsnSummary: Array.from(hsnMap.values()),
    };
  }

  // ==================== VAT EU/UK ====================

  private buildVatReport(
    orders: OrderForExport[],
    customerMap: Map<string, CustomerForExport>,
    settings: TaxSettings,
    from: string,
    to: string,
  ): VatReport {
    const summary = this.buildSummary(orders, settings, from, to);

    const domesticSales: VatReport['domesticSales'] = [];
    const ecSalesMap = new Map<
      string,
      {
        customerVatId: string;
        customerName: string;
        country: string;
        totalValue: number;
      }
    >();

    for (const order of orders) {
      const customer = order.customerId
        ? customerMap.get(order.customerId)
        : null;
      const customerName =
        customer?.name || (order.customerInfo?.name as string) || 'Walk-in';
      const breakdown = order.pricing.taxBreakdown;
      const vatAmount =
        breakdown?.componentTotals?.['VAT'] || order.pricing.taxAmount;

      domesticSales.push({
        invoiceNumber: order.invoiceNumber || order.orderNumber,
        invoiceDate: order.createdAt.toISOString().split('T')[0],
        customerName,
        taxableValue: order.pricing.subtotal,
        vatRate: order.pricing.taxRate,
        vatAmount,
        total: order.pricing.total,
      });

      // EC Sales List for cross-border EU sales
      if (
        settings.regime === 'vat_eu' &&
        customer?.taxId &&
        breakdown?.metadata?.isInterState
      ) {
        const existing = ecSalesMap.get(customer.taxId);
        if (existing) {
          existing.totalValue += order.pricing.subtotal;
        } else {
          ecSalesMap.set(customer.taxId, {
            customerVatId: customer.taxId,
            customerName: customer.name,
            country: (breakdown.metadata?.placeOfSupply as string) || '',
            totalValue: order.pricing.subtotal,
          });
        }
      }
    }

    return {
      ...summary,
      domesticSales,
      ecSalesList:
        ecSalesMap.size > 0 ? Array.from(ecSalesMap.values()) : undefined,
    };
  }

  // ==================== US SALES TAX ====================

  private buildSalesTaxReport(
    orders: OrderForExport[],
    _customerMap: Map<string, CustomerForExport>,
    settings: TaxSettings,
    from: string,
    to: string,
  ): SalesTaxReport {
    const summary = this.buildSummary(orders, settings, from, to);

    const stateMap = new Map<
      string,
      {
        state: string;
        taxableValue: number;
        taxAmount: number;
        invoiceCount: number;
      }
    >();

    for (const order of orders) {
      const state = settings.regionCode || 'Unknown';
      let entry = stateMap.get(state);
      if (!entry) {
        entry = { state, taxableValue: 0, taxAmount: 0, invoiceCount: 0 };
        stateMap.set(state, entry);
      }
      entry.taxableValue += order.pricing.subtotal;
      entry.taxAmount += order.pricing.taxAmount;
      entry.invoiceCount += 1;
    }

    return {
      ...summary,
      stateBreakdown: Array.from(stateMap.values()),
    };
  }

  // ==================== GENERIC ====================

  private buildGenericReport(
    orders: OrderForExport[],
    settings: TaxSettings,
    from: string,
    to: string,
  ): TaxReportSummary {
    return this.buildSummary(orders, settings, from, to);
  }

  // ==================== COMMON ====================

  private buildSummary(
    orders: OrderForExport[],
    settings: TaxSettings,
    from: string,
    to: string,
  ): TaxReportSummary {
    let totalTaxableValue = 0;
    let totalTaxCollected = 0;
    let totalGrossValue = 0;
    const componentTotals: Record<string, number> = {};
    const rateMap = new Map<
      number,
      { taxableValue: number; taxAmount: number; invoiceCount: number }
    >();

    for (const order of orders) {
      totalTaxableValue += order.pricing.subtotal;
      totalTaxCollected += order.pricing.taxAmount;
      totalGrossValue += order.pricing.total;

      const breakdown = order.pricing.taxBreakdown;
      if (breakdown) {
        for (const [name, amount] of Object.entries(
          breakdown.componentTotals,
        )) {
          componentTotals[name] = (componentTotals[name] || 0) + amount;
        }
      }

      const rate = order.pricing.taxRate || 0;
      const existing = rateMap.get(rate);
      if (existing) {
        existing.taxableValue += order.pricing.subtotal;
        existing.taxAmount += order.pricing.taxAmount;
        existing.invoiceCount += 1;
      } else {
        rateMap.set(rate, {
          taxableValue: order.pricing.subtotal,
          taxAmount: order.pricing.taxAmount,
          invoiceCount: 1,
        });
      }
    }

    const regimeConfig = this.taxService.getRegimeConfig(settings.regime);

    return {
      regime: settings.regime,
      regimeName: regimeConfig.name,
      period: { from, to },
      businessInfo: {
        registrationNumber: settings.registrationNumber,
        legalName: settings.legalName,
        regionCode: settings.regionCode,
        regionName: settings.regionName,
      },
      totalInvoices: orders.length,
      totalTaxableValue: this.round(totalTaxableValue),
      totalTaxCollected: this.round(totalTaxCollected),
      totalGrossValue: this.round(totalGrossValue),
      componentTotals: Object.fromEntries(
        Object.entries(componentTotals).map(([k, v]) => [k, this.round(v)]),
      ),
      rateSummary: Array.from(rateMap.entries())
        .map(([rate, data]) => ({
          rate,
          taxableValue: this.round(data.taxableValue),
          taxAmount: this.round(data.taxAmount),
          invoiceCount: data.invoiceCount,
        }))
        .sort((a, b) => a.rate - b.rate),
    };
  }

  // ==================== CSV CONVERSION ====================

  private convertToCsv(report: TaxExportResult, regime: TaxRegime): string {
    const lines: string[] = [];

    // Header info
    lines.push(`Tax Report - ${report.regimeName}`);
    lines.push(`Period,${report.period.from},${report.period.to}`);
    lines.push(`Registration,${report.businessInfo.registrationNumber}`);
    lines.push(`Legal Name,${report.businessInfo.legalName}`);
    lines.push(`Total Invoices,${report.totalInvoices}`);
    lines.push(`Total Taxable Value,${report.totalTaxableValue}`);
    lines.push(`Total Tax Collected,${report.totalTaxCollected}`);
    lines.push(`Total Gross Value,${report.totalGrossValue}`);
    lines.push('');

    // Component totals
    lines.push('Tax Component Totals');
    lines.push('Component,Amount');
    for (const [name, amount] of Object.entries(report.componentTotals)) {
      lines.push(`${name},${amount}`);
    }
    lines.push('');

    // Rate summary
    lines.push('Rate Summary');
    lines.push('Rate (%),Taxable Value,Tax Amount,Invoice Count');
    for (const rs of report.rateSummary) {
      lines.push(
        `${rs.rate},${rs.taxableValue},${rs.taxAmount},${rs.invoiceCount}`,
      );
    }
    lines.push('');

    // Regime-specific sections
    if (regime === 'gst_india' && 'b2b' in report) {
      const gst = report;

      lines.push('B2B Transactions');
      lines.push(
        'Customer GSTIN,Customer Name,Invoice Number,Invoice Date,Taxable Value,Rate (%),CGST,SGST,IGST,Total',
      );
      for (const entry of gst.b2b) {
        for (const inv of entry.invoices) {
          lines.push(
            `${entry.customerTaxId},${this.csvEscape(entry.customerName)},${inv.invoiceNumber},${inv.invoiceDate},${inv.taxableValue},${inv.rate},${inv.cgst},${inv.sgst},${inv.igst},${inv.total}`,
          );
        }
      }
      lines.push('');

      if (gst.b2cLarge.length > 0) {
        lines.push('B2C Large (Inter-state > 2.5L)');
        lines.push(
          'Invoice Number,Invoice Date,Place of Supply,Taxable Value,Rate (%),IGST',
        );
        for (const inv of gst.b2cLarge) {
          lines.push(
            `${inv.invoiceNumber},${inv.invoiceDate},${inv.placeOfSupply},${inv.taxableValue},${inv.rate},${inv.igst}`,
          );
        }
        lines.push('');
      }

      lines.push('B2C Small (Aggregate)');
      lines.push('Taxable Value,CGST,SGST,Total Tax');
      lines.push(
        `${gst.b2cSmall.taxableValue},${gst.b2cSmall.cgst},${gst.b2cSmall.sgst},${gst.b2cSmall.totalTax}`,
      );
      lines.push('');

      if (gst.hsnSummary.length > 0) {
        lines.push('HSN Summary');
        lines.push(
          'HSN Code,Description,Quantity,Taxable Value,Rate (%),CGST,SGST,IGST,Total Tax',
        );
        for (const h of gst.hsnSummary) {
          lines.push(
            `${h.hsnCode},${this.csvEscape(h.description)},${h.quantity},${h.taxableValue},${h.rate},${h.cgst},${h.sgst},${h.igst},${h.totalTax}`,
          );
        }
      }
    } else if (
      (regime === 'vat_eu' || regime === 'vat_uk') &&
      'domesticSales' in report
    ) {
      const vat = report;

      lines.push('Domestic Sales');
      lines.push(
        'Invoice Number,Invoice Date,Customer Name,Taxable Value,VAT Rate (%),VAT Amount,Total',
      );
      for (const sale of vat.domesticSales) {
        lines.push(
          `${sale.invoiceNumber},${sale.invoiceDate},${this.csvEscape(sale.customerName)},${sale.taxableValue},${sale.vatRate},${sale.vatAmount},${sale.total}`,
        );
      }
      lines.push('');

      if (vat.ecSalesList && vat.ecSalesList.length > 0) {
        lines.push('EC Sales List');
        lines.push('Customer VAT ID,Customer Name,Country,Total Value');
        for (const ec of vat.ecSalesList) {
          lines.push(
            `${ec.customerVatId},${this.csvEscape(ec.customerName)},${ec.country},${ec.totalValue}`,
          );
        }
      }
    } else if (regime === 'sales_tax_us' && 'stateBreakdown' in report) {
      const st = report;

      lines.push('State Breakdown');
      lines.push('State,Taxable Value,Tax Amount,Invoice Count');
      for (const entry of st.stateBreakdown) {
        lines.push(
          `${entry.state},${entry.taxableValue},${entry.taxAmount},${entry.invoiceCount}`,
        );
      }
    }

    return lines.join('\n');
  }

  private csvEscape(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
