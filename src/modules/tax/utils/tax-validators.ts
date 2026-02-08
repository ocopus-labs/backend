import type { TaxRegime } from '../interfaces';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

function validateGSTIN(gstin: string): ValidationResult {
  if (!gstin) {
    return { valid: false, error: 'GSTIN is required' };
  }

  const pattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!pattern.test(gstin)) {
    return { valid: false, error: 'Invalid GSTIN format. Expected: 22AAAAA0000A1Z5' };
  }

  // Validate state code (01-38)
  const stateCode = parseInt(gstin.substring(0, 2), 10);
  if (stateCode < 1 || stateCode > 38) {
    return { valid: false, error: 'Invalid state code in GSTIN' };
  }

  // Checksum validation (Luhn-like algorithm for GSTIN)
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const idx = chars.indexOf(gstin[i]);
    let val = ((i % 2 === 0) ? idx : idx * 2);
    val = Math.floor(val / 36) + (val % 36);
    sum += val;
  }
  const checkChar = chars[(36 - (sum % 36)) % 36];
  if (gstin[14] !== checkChar) {
    return { valid: false, error: 'Invalid GSTIN checksum' };
  }

  return { valid: true };
}

function validateVATNumber(vatNumber: string): ValidationResult {
  if (!vatNumber) {
    return { valid: false, error: 'VAT number is required' };
  }

  // Basic EU VAT format: 2-letter country code + 2-12 alphanumeric characters
  const pattern = /^[A-Z]{2}[0-9A-Z+*.]{2,12}$/;
  if (!pattern.test(vatNumber)) {
    return { valid: false, error: 'Invalid VAT number format. Expected: XX followed by 2-12 characters' };
  }

  return { valid: true };
}

function validateUKVATNumber(vatNumber: string): ValidationResult {
  if (!vatNumber) {
    return { valid: false, error: 'VAT number is required' };
  }

  const pattern = /^GB[0-9]{9}$|^GB[0-9]{12}$|^GBGD[0-9]{3}$|^GBHA[0-9]{3}$/;
  if (!pattern.test(vatNumber)) {
    return { valid: false, error: 'Invalid UK VAT number. Expected: GB followed by 9 or 12 digits' };
  }

  return { valid: true };
}

function validateEIN(ein: string): ValidationResult {
  if (!ein) {
    return { valid: false, error: 'Tax ID (EIN) is required' };
  }

  const pattern = /^[0-9]{2}-[0-9]{7}$/;
  if (!pattern.test(ein)) {
    return { valid: false, error: 'Invalid EIN format. Expected: XX-XXXXXXX' };
  }

  return { valid: true };
}

function validateCustomTaxId(taxId: string): ValidationResult {
  if (!taxId) {
    return { valid: false, error: 'Tax ID is required' };
  }

  if (taxId.length < 2 || taxId.length > 50) {
    return { valid: false, error: 'Tax ID must be between 2 and 50 characters' };
  }

  return { valid: true };
}

const VALIDATORS: Record<TaxRegime, (id: string) => ValidationResult> = {
  gst_india: validateGSTIN,
  vat_eu: validateVATNumber,
  vat_uk: validateUKVATNumber,
  sales_tax_us: validateEIN,
  custom: validateCustomTaxId,
};

export function validateRegistrationNumber(
  regime: TaxRegime,
  registrationNumber: string,
): ValidationResult {
  const validator = VALIDATORS[regime];
  if (!validator) {
    return { valid: false, error: `Unknown tax regime: ${regime}` };
  }
  return validator(registrationNumber);
}

export function validateTaxCode(
  taxCode: string,
  pattern?: string,
): ValidationResult {
  if (!taxCode) {
    return { valid: true }; // Tax code is optional
  }

  if (pattern) {
    const regex = new RegExp(pattern);
    if (!regex.test(taxCode)) {
      return { valid: false, error: `Invalid tax code format` };
    }
  }

  return { valid: true };
}
