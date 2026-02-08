import type {
  TaxSettings,
  TaxBreakdown,
  TaxComponent,
  ItemTaxBreakdown,
  TaxRegime,
} from '../interfaces';

interface TaxableItem {
  id: string;
  name: string;
  taxCode?: string;
  taxCategory?: string;
  customTaxRate?: number;
  taxableValue: number;
}

function roundTo2(n: number): number {
  return Math.round(n * 100) / 100;
}

function calculateGstIndia(
  items: TaxableItem[],
  settings: TaxSettings,
  customerRegionCode?: string,
): TaxBreakdown {
  const businessState = settings.regionCode;
  const customerState = customerRegionCode || businessState;
  const isInterState = businessState !== customerState;

  const itemBreakdowns: ItemTaxBreakdown[] = [];

  for (const item of items) {
    const rate = item.customTaxRate ?? settings.defaultTaxRate;
    const taxableValue = item.taxableValue;
    let components: TaxComponent[];

    if (isInterState) {
      components = [
        { name: 'IGST', rate, amount: roundTo2((taxableValue * rate) / 100) },
      ];
    } else {
      const halfRate = rate / 2;
      components = [
        {
          name: 'CGST',
          rate: halfRate,
          amount: roundTo2((taxableValue * halfRate) / 100),
        },
        {
          name: 'SGST',
          rate: halfRate,
          amount: roundTo2((taxableValue * halfRate) / 100),
        },
      ];
    }

    const totalTax = components.reduce((sum, c) => sum + c.amount, 0);

    itemBreakdowns.push({
      itemId: item.id,
      itemName: item.name,
      taxCode: item.taxCode,
      taxableValue,
      taxRate: rate,
      components,
      totalTax,
    });
  }

  return buildBreakdown('gst_india', itemBreakdowns, {
    isInterState,
    placeOfSupply: customerState,
    businessState,
  });
}

function calculateVat(
  items: TaxableItem[],
  settings: TaxSettings,
): TaxBreakdown {
  const itemBreakdowns: ItemTaxBreakdown[] = [];

  for (const item of items) {
    const rate = item.customTaxRate ?? settings.defaultTaxRate;
    const taxableValue = item.taxableValue;
    const vatAmount = roundTo2((taxableValue * rate) / 100);

    const components: TaxComponent[] = [
      { name: 'VAT', rate, amount: vatAmount },
    ];

    itemBreakdowns.push({
      itemId: item.id,
      itemName: item.name,
      taxCode: item.taxCode,
      taxableValue,
      taxRate: rate,
      components,
      totalTax: vatAmount,
    });
  }

  const regime = settings.regime === 'vat_uk' ? 'vat_uk' : 'vat_eu';
  return buildBreakdown(regime, itemBreakdowns, {
    reverseCharge: settings.vatConfig?.reverseChargeApplicable,
  });
}

function calculateSalesTax(
  items: TaxableItem[],
  settings: TaxSettings,
): TaxBreakdown {
  const itemBreakdowns: ItemTaxBreakdown[] = [];

  for (const item of items) {
    const rate = item.customTaxRate ?? settings.defaultTaxRate;
    const taxableValue = item.taxableValue;
    const taxAmount = roundTo2((taxableValue * rate) / 100);

    // For US, the default rate is the combined rate (state + local)
    // We report it as a single "State Tax" component for simplicity
    const components: TaxComponent[] = [
      { name: 'State Tax', rate, amount: taxAmount },
    ];

    itemBreakdowns.push({
      itemId: item.id,
      itemName: item.name,
      taxCode: item.taxCode,
      taxableValue,
      taxRate: rate,
      components,
      totalTax: taxAmount,
    });
  }

  return buildBreakdown('sales_tax_us', itemBreakdowns, {
    regionCode: settings.regionCode,
  });
}

function calculateCustomTax(
  items: TaxableItem[],
  settings: TaxSettings,
): TaxBreakdown {
  const itemBreakdowns: ItemTaxBreakdown[] = [];

  for (const item of items) {
    const rate = item.customTaxRate ?? settings.defaultTaxRate;
    const taxableValue = item.taxableValue;
    const taxAmount = roundTo2((taxableValue * rate) / 100);

    const components: TaxComponent[] = [
      { name: 'Tax', rate, amount: taxAmount },
    ];

    itemBreakdowns.push({
      itemId: item.id,
      itemName: item.name,
      taxCode: item.taxCode,
      taxableValue,
      taxRate: rate,
      components,
      totalTax: taxAmount,
    });
  }

  return buildBreakdown('custom', itemBreakdowns);
}

function buildBreakdown(
  regime: TaxRegime,
  items: ItemTaxBreakdown[],
  metadata?: Record<string, unknown>,
): TaxBreakdown {
  // Aggregate component totals
  const componentTotals: Record<string, number> = {};
  for (const item of items) {
    for (const comp of item.components) {
      componentTotals[comp.name] =
        (componentTotals[comp.name] || 0) + comp.amount;
    }
  }

  // Round component totals
  for (const key of Object.keys(componentTotals)) {
    componentTotals[key] = roundTo2(componentTotals[key]);
  }

  // Build rate summary
  const rateMap = new Map<
    number,
    { taxableValue: number; components: Record<string, number>; total: number }
  >();
  for (const item of items) {
    const existing = rateMap.get(item.taxRate);
    if (existing) {
      existing.taxableValue += item.taxableValue;
      existing.total += item.totalTax;
      for (const comp of item.components) {
        existing.components[comp.name] =
          (existing.components[comp.name] || 0) + comp.amount;
      }
    } else {
      const components: Record<string, number> = {};
      for (const comp of item.components) {
        components[comp.name] = comp.amount;
      }
      rateMap.set(item.taxRate, {
        taxableValue: item.taxableValue,
        components,
        total: item.totalTax,
      });
    }
  }

  const rateSummary = Array.from(rateMap.entries())
    .map(([rate, data]) => ({
      rate,
      taxableValue: roundTo2(data.taxableValue),
      components: Object.fromEntries(
        Object.entries(data.components).map(([k, v]) => [k, roundTo2(v)]),
      ),
      total: roundTo2(data.total),
    }))
    .sort((a, b) => a.rate - b.rate);

  const totalTax = roundTo2(
    items.reduce((sum, item) => sum + item.totalTax, 0),
  );

  return {
    regime,
    items,
    componentTotals,
    rateSummary,
    totalTax,
    metadata,
  };
}

const CALCULATORS: Record<
  TaxRegime,
  (
    items: TaxableItem[],
    settings: TaxSettings,
    customerRegion?: string,
  ) => TaxBreakdown
> = {
  gst_india: calculateGstIndia,
  vat_eu: calculateVat,
  vat_uk: calculateVat,
  sales_tax_us: calculateSalesTax,
  custom: calculateCustomTax,
};

export function calculateTaxForOrder(
  items: TaxableItem[],
  taxSettings: TaxSettings,
  customerRegionCode?: string,
): TaxBreakdown {
  const calculator = CALCULATORS[taxSettings.regime];
  return calculator(items, taxSettings, customerRegionCode);
}

export type { TaxableItem };
