export type TaxRegime =
  | 'gst_india'
  | 'vat_eu'
  | 'vat_uk'
  | 'sales_tax_us'
  | 'custom';

export interface GstConfig {
  compositionScheme: boolean;
  placeOfSupply: string;
  eInvoiceEnabled: boolean;
}

export interface VatConfig {
  reverseChargeApplicable: boolean;
  ossRegistered: boolean;
}

export interface SalesTaxConfig {
  nexusStates: string[];
  taxExemptionId?: string;
}

export interface TaxSettings {
  enabled: boolean;
  regime: TaxRegime;
  registrationNumber: string;
  legalName: string;
  regionCode: string;
  regionName: string;
  defaultTaxRate: number;
  invoicePrefix: string;
  financialYearStart: number;
  gstConfig?: GstConfig;
  vatConfig?: VatConfig;
  salesTaxConfig?: SalesTaxConfig;
}

export const DEFAULT_TAX_SETTINGS: TaxSettings = {
  enabled: false,
  regime: 'custom',
  registrationNumber: '',
  legalName: '',
  regionCode: '',
  regionName: '',
  defaultTaxRate: 0,
  invoicePrefix: 'INV',
  financialYearStart: 1,
};

export interface TaxCategoryConfig {
  id: string;
  label: string;
  rate: number;
}

export interface RegimeConfig {
  name: string;
  registrationLabel: string;
  registrationPattern: string;
  componentNames: string[];
  standardRates: number[];
  taxCodeLabel: string;
  taxCodePattern?: string;
  regions: Record<string, string>;
  categories: TaxCategoryConfig[];
}

export interface TaxComponent {
  name: string;
  rate: number;
  amount: number;
}

export interface ItemTaxBreakdown {
  itemId: string;
  itemName: string;
  taxCode?: string;
  taxableValue: number;
  taxRate: number;
  components: TaxComponent[];
  totalTax: number;
}

export interface TaxBreakdown {
  regime: TaxRegime;
  items: ItemTaxBreakdown[];
  componentTotals: Record<string, number>;
  rateSummary: Array<{
    rate: number;
    taxableValue: number;
    components: Record<string, number>;
    total: number;
  }>;
  totalTax: number;
  metadata?: Record<string, unknown>;
}
