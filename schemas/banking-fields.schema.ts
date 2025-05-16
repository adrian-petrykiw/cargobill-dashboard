// schemas/banking-fields.schema.ts
import { z } from 'zod';
import { countryOptions } from '@/constants/countryData';
import { BankingCountryOption } from './payment-method.schema';
import { convertToAlpha2 } from '@/lib/helpers/countryCodeUtils';

export interface BankingFieldConfig {
  fields: string[];
  required: string[];
  validations: Record<string, z.ZodTypeAny>;
  uiLabels: Record<string, string>;
  uiHints?: Record<string, string>;
}

// Group countries by banking system type
export const bankingSystemGroups: Record<string, string[]> = {
  // Routing Number + Account Number
  routingSystem: ['US'],

  // IBAN + BIC System (primarily European and Middle Eastern countries)
  ibanSystem: ['IT', 'ES', 'AE', 'SA', 'QA', 'PK', 'TR'],

  // Transit Number + Institution Number + Account Number (Canadian system)
  transitSystem: ['CA'],

  // IFSC + Account Number (Indian system)
  ifscSystem: ['IN'],

  // Bank Code + Branch Code + Account Number (East Asian system)
  branchCodeSystem: ['JP', 'HK'],

  // Bank Code + Account Number (Various Asian and African systems)
  bankCodeSystem: ['MY', 'CN', 'SG', 'TH', 'VN', 'NG'],
};

// Complete map of banking fields by country
export const countryBankingFieldsMap: Record<string, BankingFieldConfig> = {
  // US (Routing Number + Account Number)
  US: {
    fields: ['accountNumber', 'routingNumber', 'accountHolderName', 'accountType', 'bankName'],
    required: ['accountNumber', 'routingNumber', 'accountHolderName', 'bankName'],
    validations: {
      routingNumber: z.string().regex(/^\d{9}$/, 'Routing number must be 9 digits'),
      accountNumber: z.string().min(4, 'Account number is required'),
    },
    uiLabels: {
      routingNumber: 'Routing Number (ABA)',
      accountNumber: 'Account Number',
    },
    uiHints: {
      routingNumber: 'The 9-digit number on the bottom left of your check',
    },
  },

  // India (IFSC + Account Number)
  IN: {
    fields: ['accountNumber', 'ifscCode', 'accountHolderName', 'bankName'],
    required: ['accountNumber', 'ifscCode', 'accountHolderName'],
    validations: {
      ifscCode: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'IFSC code must be 11 characters'),
      accountNumber: z.string().min(5).max(20, 'Account number must be 5-20 characters'),
    },
    uiLabels: {
      ifscCode: 'IFSC Code',
      accountNumber: 'Account Number',
    },
    uiHints: {
      ifscCode: 'Indian Financial System Code (e.g., HDFC0000123)',
    },
  },

  // Canada (Transit Number + Institution Number + Account Number)
  CA: {
    fields: [
      'accountNumber',
      'transitNumber',
      'institutionNumber',
      'accountHolderName',
      'bankName',
    ],
    required: ['accountNumber', 'transitNumber', 'institutionNumber', 'accountHolderName'],
    validations: {
      transitNumber: z.string().regex(/^\d{5}$/, 'Transit number must be 5 digits'),
      institutionNumber: z.string().regex(/^\d{3}$/, 'Institution number must be 3 digits'),
      accountNumber: z.string().min(5).max(12, 'Account number must be 5-12 digits'),
    },
    uiLabels: {
      transitNumber: 'Transit Number',
      institutionNumber: 'Institution Number',
      accountNumber: 'Account Number',
    },
  },

  // European & Middle Eastern IBAN Countries (Italy, Spain, UAE, Saudi Arabia, Qatar, Pakistan, Turkey)
  IT: getIbanConfig(),
  ES: getIbanConfig(),
  AE: getIbanConfig(),
  SA: getIbanConfig(),
  QA: getIbanConfig(),
  PK: getIbanConfig(),
  TR: getIbanConfig(),

  // East Asian Countries (Bank Code + Branch Code + Account Number)
  JP: {
    fields: ['accountNumber', 'bankCode', 'branchCode', 'accountHolderName', 'bankName'],
    required: ['accountNumber', 'bankCode', 'branchCode', 'accountHolderName'],
    validations: {
      bankCode: z.string().regex(/^\d{4}$/, 'Bank code must be 4 digits'),
      branchCode: z.string().regex(/^\d{3}$/, 'Branch code must be 3 digits'),
      accountNumber: z.string().regex(/^\d{7}$/, 'Account number must be 7 digits'),
    },
    uiLabels: {
      bankCode: 'Bank Code',
      branchCode: 'Branch Code',
      accountNumber: 'Account Number',
    },
  },

  HK: {
    fields: ['accountNumber', 'bankCode', 'branchCode', 'accountHolderName', 'bankName'],
    required: ['accountNumber', 'bankCode', 'accountHolderName'],
    validations: {
      bankCode: z.string().regex(/^\d{3}$/, 'Bank code must be 3 digits'),
      branchCode: z.string().regex(/^\d{3}$/, 'Branch code must be 3 digits'),
      accountNumber: z.string().min(6).max(12, 'Account number must be 6-12 digits'),
    },
    uiLabels: {
      bankCode: 'Bank Code',
      branchCode: 'Branch Code',
      accountNumber: 'Account Number',
    },
  },

  // Other Asian & African Countries (Bank Code + Account Number)
  MY: getBankCodeConfig(),
  CN: getBankCodeConfig(),
  SG: getBankCodeConfig(),
  TH: getBankCodeConfig(),
  VN: getBankCodeConfig(),
  NG: getBankCodeConfig(),
};

// Helper function for IBAN countries
function getIbanConfig(): BankingFieldConfig {
  return {
    fields: ['iban', 'swift', 'accountHolderName', 'bankName'],
    required: ['iban', 'accountHolderName'],
    validations: {
      iban: z.string().min(15).max(34, 'IBAN must be between 15-34 characters'),
      swift: z
        .string()
        .regex(/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/, 'Invalid BIC/SWIFT format')
        .optional(),
    },
    uiLabels: {
      iban: 'IBAN',
      swift: 'BIC/SWIFT Code (Optional)',
    },
  };
}

// Helper function for Bank Code countries
function getBankCodeConfig(): BankingFieldConfig {
  return {
    fields: ['accountNumber', 'bankCode', 'accountHolderName', 'bankName'],
    required: ['accountNumber', 'bankCode', 'accountHolderName'],
    validations: {
      bankCode: z.string().min(3).max(12, 'Bank code must be 3-12 characters'),
      accountNumber: z.string().min(5).max(20, 'Account number must be 5-20 characters'),
    },
    uiLabels: {
      bankCode: 'Bank Code',
      accountNumber: 'Account Number',
    },
  };
}

// Helper function to get country options in a format suitable for dropdown
export function getCountryOptionsForBanking(): BankingCountryOption[] {
  // Get all countries we support banking for (unique set from all groups)
  const supportedCountryCodes = new Set([
    ...bankingSystemGroups.routingSystem,
    ...bankingSystemGroups.ibanSystem,
    ...bankingSystemGroups.transitSystem,
    ...bankingSystemGroups.ifscSystem,
    ...bankingSystemGroups.branchCodeSystem,
    ...bankingSystemGroups.bankCodeSystem,
  ]);

  // Filter the full country options to only include supported countries
  return countryOptions
    .filter((country) => {
      const alpha2 = convertToAlpha2(country.code);
      return supportedCountryCodes.has(alpha2);
    })
    .map((country) => ({
      value: convertToAlpha2(country.code),
      label: country.name,
      code: country.code,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

// Helper function to get the appropriate bank account schema for a country
export function getBankAccountSchema(countryCode: string) {
  const alpha2 = convertToAlpha2(countryCode);
  const config = countryBankingFieldsMap[alpha2] || countryBankingFieldsMap.US; // Default to US

  // Create a schema object with the required fields
  const schemaObj: Record<string, z.ZodTypeAny> = {
    bankCountry: z.string(),
  };

  config.fields.forEach((field) => {
    if (config.validations[field]) {
      schemaObj[field] = config.validations[field];
    } else if (config.required.includes(field)) {
      schemaObj[field] = z.string().min(1, `${field} is required`);
    } else {
      schemaObj[field] = z.string().optional();
    }
  });

  // Special case for US account type
  if (alpha2 === 'US') {
    schemaObj.accountType = z.enum(['checking', 'savings', 'business']);
  }

  return z.object(schemaObj);
}

// Helper function to get config for a country
export function getBankingFieldsForCountry(countryCode: string): BankingFieldConfig {
  const alpha2 = convertToAlpha2(countryCode);
  return countryBankingFieldsMap[alpha2] || countryBankingFieldsMap.US; // Default to US
}

// Transform bank field data to a consistent API format
export function transformBankDataForApi(
  formData: Record<string, any>,
  countryCode: string,
): Record<string, any> {
  const alpha2 = convertToAlpha2(countryCode);

  // Base transformation with common fields
  const result: Record<string, any> = {
    accountHolderName: formData.accountHolderName || formData.accountName,
    bankName: formData.bankName || '',
    bankCountry: alpha2,
  };

  // Add all form data fields to result
  Object.entries(formData).forEach(([key, value]) => {
    if (
      key !== 'accountHolderName' &&
      key !== 'accountName' &&
      key !== 'bankName' &&
      key !== 'bankCountry'
    ) {
      result[key] = value;
    }
  });

  return result;
}
