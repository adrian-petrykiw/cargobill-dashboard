// pages/api/_services/footprintService.ts
import axios, { AxiosError, AxiosInstance } from 'axios';

// Custom error class for Footprint service errors
export class FootprintServiceError extends Error {
  code: string;
  details?: any;

  constructor(code: string, message: string, details?: any) {
    super(message);
    this.name = 'FootprintServiceError';
    this.code = code;
    this.details = details;
  }
}

// Types for Footprint API entities and request parameters
export interface FootprintBusinessVault {
  'business.name'?: string;
  'business.dba'?: string;
  'business.website'?: string;
  'business.phone_number'?: string;
  'business.tin'?: string;
  'business.address_line1'?: string;
  'business.address_line2'?: string;
  'business.city'?: string;
  'business.state'?: string;
  'business.zip'?: string;
  'business.country'?: string;
  'business.corporation_type'?:
    | 'c_corporation'
    | 's_corporation'
    | 'b_corporation'
    | 'llc'
    | 'llp'
    | 'partnership'
    | 'sole_proprietorship'
    | 'non_profit'
    | 'unknown'
    | 'trust'
    | 'agent';
  'business.formation_state'?: string;
  'business.formation_date'?: string;
  [key: `custom.${string}`]: any;
}

export interface FootprintBusinessData {
  id: string;
  external_id?: string;
  sandbox_id?: string;
}

export interface FootprintBusinessDetailsResponse {
  id: string;
  external_id?: string;
  requires_manual_review: boolean;
  status: 'pass' | 'fail' | 'incomplete' | 'pending' | 'none';
}

export interface FootprintVaultFieldsResponse {
  [key: string]: boolean;
}

export interface FootprintVaultDecryptResponse {
  [key: string]: any;
}

export interface FootprintClientTokenResponse {
  token: string;
  expires_at: string;
  fields?: string[];
}

export interface FootprintKybResponse {
  fp_id: string;
  onboarding_id: string;
  playbook_key: string;
  requires_manual_review: boolean;
  status: 'pass' | 'fail' | 'incomplete' | 'pending' | 'none';
}

export interface CreateBusinessParams {
  initialData?: FootprintBusinessVault;
  externalId?: string;
}

export interface UpdateBusinessVaultParams {
  businessId: string;
  data: FootprintBusinessVault;
}

export interface DecryptBusinessVaultParams {
  businessId: string;
  fields: string[];
  reason: string;
  transforms?: string[];
}

export interface KybBusinessParams {
  businessId: string;
  playbookKey: string;
  allowReonboard?: boolean;
}

export interface CreateClientTokenParams {
  userId: string;
  fields: string[];
  scope: 'vault' | 'decrypt' | 'vault_and_decrypt' | 'decrypt_download' | 'vault_card';
  ttl?: number;
  decryptReason?: string;
}

interface BankPrimary {
  ach_account_number: string;
  ach_routing_number: string;
  name: string;
  institution_name: string;
  account_type?: string;
  bank_country?: string;
  [key: string]: any; // Allow additional properties
}

interface CardPrimary {
  name: string;
  number: string;
  expiration: string;
  cvc: string;
  card_type?: string;
  billing_address?: {
    zip?: string;
    country?: string;
    [key: string]: any;
  };
  [key: string]: any; // Allow additional properties
}

interface VaultData {
  bank?: {
    [key: string]: BankPrimary;
  };
  card?: {
    [key: string]: CardPrimary;
  };
  [key: string]: any;
}

interface GroupedFields {
  [mainType: string]: {
    [alias: string]: {
      [field: string]: any;
    };
  };
}

export const footprintService = {
  apiClient: null as AxiosInstance | null,

  initialize(): AxiosInstance {
    if (!this.apiClient) {
      const apiKey = process.env.FOOTPRINT_API_KEY;

      if (!apiKey) {
        throw new FootprintServiceError('MISSING_API_KEY', 'Footprint API key is not configured');
      }

      const baseURL = 'https://api.onefootprint.com';

      const encodedApiKey = Buffer.from(`${apiKey}:`).toString('base64');

      this.apiClient = axios.create({
        baseURL,
        headers: {
          Authorization: `Basic ${encodedApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      // Add response interceptor for error handling
      this.apiClient.interceptors.response.use(
        (response) => response,
        (error: AxiosError) => {
          if (error.response) {
            const status = error.response.status;
            const data = error.response.data as any;

            let code = 'UNKNOWN_ERROR';
            let message = 'An unknown error occurred';

            if (data && data.message) {
              message = data.message;

              if (data.code) {
                code = data.code;
              } else if (status === 400) {
                code = 'BAD_REQUEST';
              } else if (status === 401) {
                code = 'UNAUTHORIZED';
              } else if (status === 403) {
                code = 'FORBIDDEN';
              } else if (status === 404) {
                code = 'NOT_FOUND';
              } else if (status === 409) {
                code = 'CONFLICT';
              } else if (status >= 500) {
                code = 'SERVER_ERROR';
              }
            }

            throw new FootprintServiceError(code, message, {
              status,
              data: data,
            });
          }

          throw new FootprintServiceError(
            'NETWORK_ERROR',
            'Network error occurred while connecting to Footprint API',
            { originalError: error.message },
          );
        },
      );
    }

    return this.apiClient;
  },

  /**
   * Get business details
   */
  async getBusinessDetails(businessId: string): Promise<FootprintBusinessDetailsResponse> {
    try {
      const client = this.initialize();

      const response = await client.get(`/businesses/${businessId}`);

      return response.data as FootprintBusinessDetailsResponse;
    } catch (error) {
      if (error instanceof FootprintServiceError) {
        throw error;
      }

      throw new FootprintServiceError(
        'GET_BUSINESS_FAILED',
        `Failed to get details for business: ${businessId}`,
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  },

  /**
   * Update business vault data
   */
  async updateBusinessVault(params: UpdateBusinessVaultParams): Promise<void> {
    try {
      const client = this.initialize();

      await client.patch(`/businesses/${params.businessId}/vault`, params.data);
    } catch (error) {
      if (error instanceof FootprintServiceError) {
        throw error;
      }

      throw new FootprintServiceError(
        'UPDATE_BUSINESS_VAULT_FAILED',
        `Failed to update business vault for: ${params.businessId}`,
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  },

  /**
   * Check which fields exist in a business vault
   */
  async checkBusinessVaultFields(
    businessId: string,
    fields?: string[],
  ): Promise<FootprintVaultFieldsResponse> {
    try {
      const client = this.initialize();

      const params = fields ? { fields: fields.join(',') } : undefined;

      const response = await client.get(`/businesses/${businessId}/vault`, { params });

      return response.data as FootprintVaultFieldsResponse;
    } catch (error) {
      if (error instanceof FootprintServiceError) {
        throw error;
      }

      throw new FootprintServiceError(
        'CHECK_VAULT_FIELDS_FAILED',
        `Failed to check vault fields for business: ${businessId}`,
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  },

  /**
   * Decrypt data from a business vault
   */
  async decryptBusinessVault(
    params: DecryptBusinessVaultParams,
  ): Promise<FootprintVaultDecryptResponse> {
    try {
      const client = this.initialize();

      const requestData = {
        fields: params.fields,
        reason: params.reason,
        ...(params.transforms ? { transforms: params.transforms } : {}),
      };

      const response = await client.post(
        `/businesses/${params.businessId}/vault/decrypt`,
        requestData,
      );

      return response.data as FootprintVaultDecryptResponse;
    } catch (error) {
      if (error instanceof FootprintServiceError) {
        throw error;
      }

      throw new FootprintServiceError(
        'DECRYPT_VAULT_FAILED',
        `Failed to decrypt vault data for business: ${params.businessId}`,
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  },

  /**
   * Validate the business vault data before storing it
   */
  async validateBusinessVaultData(businessId: string, data: FootprintBusinessVault): Promise<void> {
    try {
      const client = this.initialize();

      await client.post(`/businesses/${businessId}/vault/validate`, data);
    } catch (error) {
      if (error instanceof FootprintServiceError) {
        throw error;
      }

      throw new FootprintServiceError(
        'VALIDATE_VAULT_DATA_FAILED',
        `Failed to validate vault data for business: ${businessId}`,
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  },

  /**
   * Run KYB verification on a business
   */
  async runKybVerification(params: KybBusinessParams): Promise<FootprintKybResponse> {
    try {
      const client = this.initialize();

      const requestData = {
        key: params.playbookKey,
        allow_reonboard: params.allowReonboard !== undefined ? params.allowReonboard : true,
      };

      const response = await client.post(`/businesses/${params.businessId}/kyb`, requestData);

      return response.data as FootprintKybResponse;
    } catch (error) {
      if (error instanceof FootprintServiceError) {
        throw error;
      }

      throw new FootprintServiceError(
        'KYB_VERIFICATION_FAILED',
        `Failed to run KYB verification for business: ${params.businessId}`,
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  },

  /**
   * Create user vault for individuals
   */
  async createUserVault(
    initialData?: Record<string, any>,
    idempotencyId?: string,
  ): Promise<{ id: string }> {
    try {
      const client = this.initialize();

      const headers: Record<string, string> = {};

      if (idempotencyId) {
        headers['x-idempotency-id'] = idempotencyId;
      }

      const response = await client.post('/users', initialData || {}, { headers });

      return response.data as { id: string };
    } catch (error) {
      if (error instanceof FootprintServiceError) {
        throw error;
      }

      throw new FootprintServiceError('CREATE_USER_VAULT_FAILED', 'Failed to create user vault', {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  },

  /**
   * Update user vault data
   */
  async updateUserVault(userId: string, data: Record<string, any>): Promise<void> {
    try {
      const client = this.initialize();

      await client.patch(`/users/${userId}/vault`, data);
    } catch (error) {
      if (error instanceof FootprintServiceError) {
        throw error;
      }

      throw new FootprintServiceError(
        'UPDATE_USER_VAULT_FAILED',
        `Failed to update user vault for: ${userId}`,
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  },

  /**
   * Create client token for frontend vaulting
   */
  async createClientToken(params: CreateClientTokenParams): Promise<FootprintClientTokenResponse> {
    try {
      const client = this.initialize();

      const requestData = {
        fields: params.fields,
        scope: params.scope,
        ttl: params.ttl || 1800, // Default to 30 minutes
        ...(params.decryptReason ? { decrypt_reason: params.decryptReason } : {}),
      };

      const response = await client.post(`/users/${params.userId}/client_token`, requestData);

      return response.data as FootprintClientTokenResponse;
    } catch (error) {
      if (error instanceof FootprintServiceError) {
        throw error;
      }

      throw new FootprintServiceError(
        'CREATE_CLIENT_TOKEN_FAILED',
        `Failed to create client token for user: ${params.userId}`,
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  },

  /**
   * Decrypt data from a user vault
   */
  async decryptUserVault(
    userId: string,
    fields: string[],
    reason: string,
  ): Promise<Record<string, any>> {
    try {
      const client = this.initialize();

      const response = await client.post(`/users/${userId}/vault/decrypt`, {
        fields,
        reason,
      });

      return response.data as Record<string, any>;
    } catch (error) {
      if (error instanceof FootprintServiceError) {
        throw error;
      }

      throw new FootprintServiceError(
        'DECRYPT_USER_VAULT_FAILED',
        `Failed to decrypt user vault data for: ${userId}`,
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  },

  /**
   * Create a client token for a business entity
   * Note: This is assuming Footprint supports business client tokens similar to user client tokens
   */
  async createBusinessClientToken(
    businessId: string,
    fields: string[],
    scope: 'vault' | 'decrypt' | 'vault_and_decrypt',
    ttl: number = 1800,
    decryptReason?: string,
  ): Promise<FootprintClientTokenResponse> {
    try {
      const client = this.initialize();

      const requestData = {
        fields,
        scope,
        ttl,
        ...(decryptReason ? { decrypt_reason: decryptReason } : {}),
      };

      const response = await client.post(`/businesses/${businessId}/client_token`, requestData);

      return response.data as FootprintClientTokenResponse;
    } catch (error) {
      if (error instanceof FootprintServiceError) {
        throw error;
      }

      throw new FootprintServiceError(
        'CREATE_BUSINESS_CLIENT_TOKEN_FAILED',
        `Failed to create client token for business: ${businessId}`,
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  },

  /**
   * Use Vault Proxy to decrypt business data
   */
  async proxyDecryptBusinessData(
    businessId: string,
    reason: string = 'Organization details view',
  ): Promise<Record<string, any>> {
    try {
      const client = this.initialize();

      // First, check which fields actually exist in the vault
      const availableFields = await this.checkBusinessVaultFields(businessId);

      // Create the template only with fields that exist
      const templateObj: Record<string, string> = {};

      // Map of field names to their template equivalents
      const fieldMap: Record<string, string> = {
        'business.name': 'name',
        'business.dba': 'dba',
        'business.tin': 'tin',
        'business.phone_number': 'phone_number',
        'business.address_line1': 'address_line1',
        'business.address_line2': 'address_line2',
        'business.city': 'city',
        'business.state': 'state',
        'business.zip': 'zip',
        'business.country': 'country',
        'business.corporation_type': 'corporation_type',
        'business.formation_state': 'formation_state',
        'business.formation_date': 'formation_date',
        'business.website': 'website',
      };

      // Only include fields that exist in the vault
      Object.entries(fieldMap).forEach(([fieldName, templateName]) => {
        if (availableFields[fieldName]) {
          templateObj[templateName] = `{{ ${fieldName} }}`;
        }
      });

      // If no fields exist, return an empty object
      if (Object.keys(templateObj).length === 0) {
        return {};
      }

      // Convert to JSON template string
      const template = JSON.stringify(templateObj);

      const response = await client.post('/vault_proxy/reflect', template, {
        headers: {
          'x-fp-id': businessId,
          'x-fp-proxy-access-reason': reason,
          'Content-Type': 'application/json',
        },
      });

      return JSON.parse(response.data) as Record<string, any>;
    } catch (error) {
      // If vault proxy fails, fall back to direct decryption
      if (error instanceof FootprintServiceError) {
        console.warn('Vault proxy failed, falling back to direct decryption:', error.message);

        try {
          // Use the regular decrypt endpoint which is more forgiving
          const fields = [
            'business.name',
            'business.dba',
            'business.tin',
            'business.phone_number',
            'business.address_line1',
            'business.address_line2',
            'business.city',
            'business.state',
            'business.zip',
            'business.country',
            'business.corporation_type',
            'business.formation_state',
            'business.formation_date',
            'business.website',
          ];

          return await this.decryptBusinessVault({
            businessId,
            fields,
            reason,
          });
        } catch (decryptError) {
          console.error('Both vault proxy and direct decryption failed:', decryptError);
          throw new FootprintServiceError(
            'BUSINESS_DATA_RETRIEVAL_FAILED',
            'Could not retrieve business data using any available method',
            { proxyError: error, decryptError },
          );
        }
      }

      throw new FootprintServiceError(
        'PROXY_DECRYPT_BUSINESS_DATA_FAILED',
        `Failed to decrypt business data using vault proxy for: ${businessId}`,
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  },

  /**
   * Use direct decryption to get business data
   */
  async getBusinessData(
    businessId: string,
    reason: string = 'Organization details view',
  ): Promise<Record<string, any>> {
    try {
      const client = this.initialize();

      // Check which fields exist first
      let availableFields: Record<string, boolean>;
      try {
        availableFields = await this.checkBusinessVaultFields(businessId);
        console.log(`Available fields for ${businessId}:`, availableFields);
      } catch (error) {
        console.error(`Error checking fields for ${businessId}:`, error);
        availableFields = {};
      }

      // Standard business fields to check
      const standardFields = [
        'business.name',
        'business.dba',
        'business.tin',
        'business.phone_number',
        'business.address_line1',
        'business.address_line2',
        'business.city',
        'business.state',
        'business.zip',
        'business.country',
        'business.corporation_type',
        'business.formation_state',
        'business.formation_date',
        'business.website',
      ];

      // Only include fields that exist or standard fields if check failed
      const fields =
        Object.keys(availableFields).length > 0
          ? standardFields.filter((field) => availableFields[field])
          : standardFields;

      // If no fields exist, return an empty object
      if (fields.length === 0) {
        console.warn(`No fields available for ${businessId}`);
        return {};
      }

      console.log(`Decrypting fields for ${businessId}:`, fields);

      try {
        // Use the standard decrypt endpoint instead of proxy
        const data = await this.decryptBusinessVault({
          businessId,
          fields,
          reason,
        });

        // Normalize the response to ensure we have a clean object structure
        const result: Record<string, any> = {};
        Object.entries(data).forEach(([key, value]) => {
          // Strip the "business." prefix for cleaner object structure
          const normalizedKey = key.replace('business.', '');
          result[normalizedKey] = value;
        });

        return result;
      } catch (error) {
        console.error(`Error decrypting vault data for ${businessId}:`, error);

        // If we get specific field errors, try one field at a time
        if (error instanceof FootprintServiceError && error.code === 'BAD_REQUEST') {
          console.log('Trying individual field decryption as fallback');

          // Try to decrypt each field individually
          const result: Record<string, any> = {};
          for (const field of fields) {
            try {
              const singleFieldData = await this.decryptBusinessVault({
                businessId,
                fields: [field],
                reason: `${reason} (individual field)`,
              });

              const normalizedKey = field.replace('business.', '');
              result[normalizedKey] = singleFieldData[field];
            } catch (fieldError) {
              console.warn(`Failed to decrypt field ${field}:`, fieldError);
              // Continue with other fields
            }
          }

          return result;
        }

        throw error;
      }
    } catch (error) {
      console.error(`Final error getting business data for ${businessId}:`, error);

      if (error instanceof FootprintServiceError) {
        throw error;
      }

      throw new FootprintServiceError(
        'BUSINESS_DATA_RETRIEVAL_FAILED',
        `Failed to retrieve business data for: ${businessId}`,
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  },

  /**
   * Get document data directly
   */
  async getBusinessDocument(
    businessId: string,
    documentType: string,
    reason: string = 'Document download',
  ): Promise<Buffer> {
    try {
      const client = this.initialize();

      // The correct field name pattern for your documents
      const fieldName = `document.custom.${documentType}`;

      console.log(`Trying to fetch document using field: ${fieldName}`);

      // Check if this field exists
      const fields = await this.checkBusinessVaultFields(businessId, [fieldName]);

      if (!fields[fieldName]) {
        throw new FootprintServiceError(
          'DOCUMENT_NOT_FOUND',
          `Document "${documentType}" not found for business: ${businessId}`,
          {},
        );
      }

      // Decrypt the document field
      const data = await this.decryptBusinessVault({
        businessId,
        fields: [fieldName],
        reason,
      });

      if (!data[fieldName]) {
        throw new FootprintServiceError(
          'DOCUMENT_EMPTY',
          `Document "${documentType}" exists but has no content`,
          {},
        );
      }

      // The document should be base64 encoded
      return Buffer.from(data[fieldName], 'base64');
    } catch (error) {
      console.error(`Error getting document for ${businessId}, type ${documentType}:`, error);

      if (error instanceof FootprintServiceError) {
        throw error;
      }

      throw new FootprintServiceError(
        'GET_BUSINESS_DOCUMENT_FAILED',
        `Failed to get document for business: ${businessId}, type: ${documentType}`,
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  },

  /**
   * More robustly check available document types
   */
  async getBusinessDocumentTypes(businessId: string): Promise<string[]> {
    try {
      let availableTypes: string[] = [];

      // Check for custom document fields in the vault
      const allFields = await this.checkBusinessVaultFields(businessId);
      console.log(`All fields for ${businessId}:`, allFields);

      // Pattern to extract document names from document.custom.* fields
      const documentFieldPattern = /^document\.custom\.(.+)$/;

      for (const field of Object.keys(allFields)) {
        const match = field.match(documentFieldPattern);
        if (match && match[1]) {
          // The actual document name is after document.custom.
          availableTypes.push(match[1]);
        }
      }

      return availableTypes;
    } catch (error) {
      console.error(`Error getting document types for ${businessId}:`, error);
      return [];
    }
  },

  /**
   * Store a bank account in the business vault
   */
  async storeBusinessBankAccount(
    businessId: string,
    bankData: {
      accountNumber: string;
      routingNumber: string;
      accountHolderName: string;
      bankName: string;
      accountType?: string;
      bankCountry?: string;
    },
  ): Promise<boolean> {
    try {
      const client = this.initialize();

      // Format for proper API structure - this is the key fix
      const vaultData: VaultData = {
        bank: {
          primary: {
            ach_account_number: bankData.accountNumber,
            ach_routing_number: bankData.routingNumber,
            name: bankData.accountHolderName,
            institution_name: bankData.bankName,
          } as BankPrimary,
        },
      };

      // Add account type if provided
      if (bankData.accountType) {
        vaultData.bank!.primary.account_type = bankData.accountType;
      }

      // Add bank country if provided
      if (bankData.bankCountry) {
        vaultData.bank!.primary.bank_country = bankData.bankCountry;
      }

      console.log('Sending bank data to Footprint:', JSON.stringify(vaultData, null, 2));

      // Store the bank account in the vault
      await client.patch(`/businesses/${businessId}/vault`, vaultData);

      return true;
    } catch (error) {
      console.error(`Error storing bank account for business: ${businessId}`, error);
      if (error instanceof FootprintServiceError) {
        throw error;
      }

      throw new FootprintServiceError(
        'STORE_BUSINESS_BANK_ACCOUNT_FAILED',
        `Failed to store bank account for business: ${businessId}`,
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  },

  /**
   * Store a credit/debit card in the business vault using custom fields
   */
  async storeBusinessCard(
    businessId: string,
    cardData: {
      cardholderName: string;
      cardNumber: string;
      expiryDate: string;
      cvv: string;
      cardType?: string;
      billingZip?: string;
      billingCountry?: string;
    },
  ): Promise<boolean> {
    try {
      const client = this.initialize();

      // Format the card number: remove any non-digit characters
      const formattedCardNumber = cardData.cardNumber.replace(/\D/g, '');

      // Format the expiry date: ensure it's in the MM/YYYY format
      let formattedExpiryDate = cardData.expiryDate;
      if (formattedExpiryDate.match(/^\d{2}\/\d{2}$/)) {
        // Convert MM/YY to MM/YYYY
        const [month, year] = formattedExpiryDate.split('/');
        formattedExpiryDate = `${month}/20${year}`;
      }

      // Format the CVV: remove any non-digit characters
      const formattedCVV = cardData.cvv.replace(/\D/g, '');

      // Use custom fields for card storage
      const vaultData: Record<string, any> = {
        'custom.card_primary_name': cardData.cardholderName,
        'custom.card_primary_number': formattedCardNumber,
        'custom.card_primary_expiration': formattedExpiryDate,
        'custom.card_primary_cvc': formattedCVV,
      };

      // Add card type if provided
      if (cardData.cardType) {
        vaultData['custom.card_primary_type'] = cardData.cardType;
      }

      // Add billing address fields if provided
      if (cardData.billingZip) {
        vaultData['custom.card_primary_billing_zip'] = cardData.billingZip;
      }

      if (cardData.billingCountry) {
        vaultData['custom.card_primary_billing_country'] = cardData.billingCountry;
      }

      console.log('Sending card data to Footprint:', JSON.stringify(vaultData, null, 2));

      // Store the card in the vault
      await client.patch(`/businesses/${businessId}/vault`, vaultData);

      return true;
    } catch (error) {
      console.error(`Error storing card for business: ${businessId}`, error);
      if (error instanceof FootprintServiceError) {
        throw error;
      }

      throw new FootprintServiceError(
        'STORE_BUSINESS_CARD_FAILED',
        `Failed to store card for business: ${businessId}`,
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  },

  /**
   * Get all payment methods (bank accounts and cards) for a business
   */
  async getBusinessPaymentMethods(
    businessId: string,
    reason: string = 'Payment methods view',
  ): Promise<{
    bankAccounts: Array<Record<string, any>>;
    cards: Array<Record<string, any>>;
  }> {
    try {
      const client = this.initialize();

      // Check available fields first
      const availableFields = await this.checkBusinessVaultFields(businessId);
      console.log('Available fields:', availableFields);

      // Bank account field patterns - support both legacy and new format
      const bankPatterns = [/^bank_account\./, /^bank\./];
      const bankAccountFields = Object.keys(availableFields).filter(
        (field) =>
          (bankPatterns[0].test(field) || bankPatterns[1].test(field)) && availableFields[field],
      );

      // Card field patterns - support both legacy and new format
      const cardPatterns = [/^payment_card\./, /^card\./];
      const cardFields = Object.keys(availableFields).filter(
        (field) =>
          (cardPatterns[0].test(field) || cardPatterns[1].test(field)) && availableFields[field],
      );

      // Custom card fields pattern
      const customCardFields = Object.keys(availableFields).filter(
        (field) => field.startsWith('custom.card_primary_') && availableFields[field],
      );

      // Initialize result containers
      let bankAccounts: Array<Record<string, any>> = [];
      let cards: Array<Record<string, any>> = [];

      // Group fields by account/card ID for easier decryption
      const bankAccountGroups: Record<string, string[]> = {};
      const cardGroups: Record<string, string[]> = {};

      // Process bank account fields
      for (const field of bankAccountFields) {
        let match;

        // Try new format first: bank.{accountId}.{fieldName}
        match = field.match(/^bank\.([^.]+)\.(.+)$/);

        if (!match) {
          // Try legacy format: bank_account.{accountId}.{fieldName} or bank_account.{fieldName}
          match = field.match(/^bank_account(?:\.([^.]+))?\.(.+)$/);
        }

        if (match) {
          const accountId = match[1] || 'primary';

          if (!bankAccountGroups[accountId]) {
            bankAccountGroups[accountId] = [];
          }

          bankAccountGroups[accountId].push(field);
        }
      }

      // Process card fields
      for (const field of cardFields) {
        let match;

        // Try new format first: card.{cardId}.{fieldName}
        match = field.match(/^card\.([^.]+)\.(.+)$/);

        if (!match) {
          // Try legacy format: payment_card.{cardId}.{fieldName} or payment_card.{fieldName}
          match = field.match(/^payment_card(?:\.([^.]+))?\.(.+)$/);
        }

        if (match) {
          const cardId = match[1] || 'primary';

          if (!cardGroups[cardId]) {
            cardGroups[cardId] = [];
          }

          cardGroups[cardId].push(field);
        }
      }

      // Decrypt and process each bank account
      for (const [accountId, fields] of Object.entries(bankAccountGroups)) {
        try {
          const data = await this.decryptBusinessVault({
            businessId,
            fields,
            reason: `${reason} - Bank account data`,
          });

          // Format the account data
          const accountData: Record<string, any> = {
            id: accountId === 'default' ? 'primary' : accountId,
          };

          // Process each field for this account
          for (const field of fields) {
            let fieldName: string;

            if (field.startsWith('bank.')) {
              fieldName = field.replace(/^bank\.[^.]+\./, '');
            } else {
              fieldName = field.replace(/^bank_account(?:\.[^.]+)?\./, '');
            }

            // Map field names from format to expected display format
            if (fieldName === 'name') {
              accountData['account_holder_name'] = data[field];
            } else if (fieldName === 'institution_name') {
              accountData['bank_name'] = data[field];
            } else if (fieldName === 'ach_account_number') {
              accountData['account_number'] = data[field];
            } else if (fieldName === 'ach_routing_number') {
              accountData['routing_number'] = data[field];
            } else {
              accountData[fieldName] = data[field];
            }
          }

          // Only add if we have essential account info
          if (
            accountData.account_number ||
            accountData.account_holder_name ||
            accountData.bank_name
          ) {
            // Mask account number for security
            if (accountData.account_number) {
              const fullNumber = accountData.account_number;
              accountData.masked_account_number = '••••' + fullNumber.slice(-4);
              delete accountData.account_number; // Remove the sensitive data
            }

            // Mask routing number if present
            if (accountData.routing_number) {
              delete accountData.routing_number; // Remove the sensitive data
            }

            bankAccounts.push(accountData);
          }
        } catch (error) {
          console.warn(`Error decrypting bank account ${accountId}:`, error);
          // Continue with other accounts
        }
      }

      // Decrypt and process each card
      for (const [cardId, fields] of Object.entries(cardGroups)) {
        try {
          const data = await this.decryptBusinessVault({
            businessId,
            fields,
            reason: `${reason} - Card data`,
          });

          // Format the card data
          const cardData: Record<string, any> = {
            id: cardId === 'default' ? 'primary' : cardId,
          };

          // Process each field for this card and handle nested fields
          const billingAddress: Record<string, any> = {};

          for (const field of fields) {
            let fieldName: string | undefined;
            let isNestedField = false;

            if (field.startsWith('card.')) {
              const parts = field.replace(/^card\.[^.]+\./, '').split('.');
              if (parts.length > 1) {
                // Handle nested fields like billing_address.zip
                if (parts[0] === 'billing_address') {
                  billingAddress[parts[1]] = data[field];
                  isNestedField = true;
                }
              }
              if (!isNestedField) {
                fieldName = parts[0];
              }
            } else {
              // Handle legacy format
              const parts = field.replace(/^payment_card(?:\.[^.]+)?\./, '').split('.');
              if (parts.length > 1) {
                if (parts[0] === 'billing_address') {
                  billingAddress[parts[1]] = data[field];
                  isNestedField = true;
                }
              }
              if (!isNestedField) {
                fieldName = parts[0];
              }
            }

            if (!isNestedField && fieldName) {
              // Map field names from API format to expected display format
              if (fieldName === 'name') {
                cardData['cardholder_name'] = data[field];
              } else if (fieldName === 'number') {
                cardData['card_number'] = data[field];
              } else if (fieldName === 'cvc') {
                cardData['cvv'] = data[field];
              } else if (fieldName === 'expiration') {
                cardData['expiry_date'] = data[field];
              } else {
                cardData[fieldName] = data[field];
              }
            }
          }

          // Add billing address info if any was found
          if (Object.keys(billingAddress).length > 0) {
            cardData.billing_address = billingAddress;
          }

          // Only add if we have essential card info
          if (cardData.card_number || cardData.cardholder_name) {
            // Determine card type from card number if available
            if (cardData.card_number && !cardData.card_type) {
              const firstDigit = cardData.card_number.charAt(0);
              const firstTwoDigits = cardData.card_number.substring(0, 2);

              if (firstDigit === '4') {
                cardData.card_type = 'Visa';
              } else if (firstDigit === '5') {
                cardData.card_type = 'Mastercard';
              } else if (
                firstDigit === '3' &&
                (cardData.card_number.charAt(1) === '4' || cardData.card_number.charAt(1) === '7')
              ) {
                cardData.card_type = 'American Express';
              } else if (firstTwoDigits === '35') {
                cardData.card_type = 'JCB';
              } else if (firstTwoDigits === '60' || firstTwoDigits === '65') {
                cardData.card_type = 'Discover';
              } else {
                cardData.card_type = 'Card';
              }
            }

            // Mask card number for security
            if (cardData.card_number) {
              const fullNumber = cardData.card_number;
              cardData.masked_card_number = '••••' + fullNumber.slice(-4);
              delete cardData.card_number; // Remove the sensitive data
            }

            // Remove CVV for security
            if (cardData.cvv) {
              delete cardData.cvv;
            }

            cards.push(cardData);
          }
        } catch (error) {
          console.warn(`Error decrypting card ${cardId}:`, error);
          // Continue with other cards
        }
      }

      // Process custom card fields
      if (customCardFields.length > 0) {
        try {
          const data = await this.decryptBusinessVault({
            businessId,
            fields: customCardFields,
            reason: `${reason} - Custom card data`,
          });

          // Format the card data
          const cardData: Record<string, any> = {
            id: 'primary',
          };

          // Build billing address if needed
          const billingAddress: Record<string, any> = {};
          let hasBillingInfo = false;

          // Process each field
          for (const field of customCardFields) {
            const fieldName = field.replace('custom.card_primary_', '');

            // Map field names
            if (fieldName === 'name') {
              cardData['cardholder_name'] = data[field];
            } else if (fieldName === 'number') {
              cardData['card_number'] = data[field];
            } else if (fieldName === 'cvc') {
              cardData['cvv'] = data[field];
            } else if (fieldName === 'expiration') {
              cardData['expiry_date'] = data[field];
            } else if (fieldName === 'type') {
              cardData['card_type'] = data[field];
            } else if (fieldName === 'billing_zip') {
              billingAddress['zip'] = data[field];
              hasBillingInfo = true;
            } else if (fieldName === 'billing_country') {
              billingAddress['country'] = data[field];
              hasBillingInfo = true;
            } else {
              cardData[fieldName] = data[field];
            }
          }

          // Add billing address if any was found
          if (hasBillingInfo) {
            cardData.billing_address = billingAddress;
          }

          // Only add if we have essential card info
          if (data['custom.card_primary_number'] || data['custom.card_primary_name']) {
            // Determine card type from card number if available
            if (data['custom.card_primary_number'] && !cardData.card_type) {
              const cardNumber = data['custom.card_primary_number'];
              const firstDigit = cardNumber.charAt(0);
              const firstTwoDigits = cardNumber.substring(0, 2);

              if (firstDigit === '4') {
                cardData.card_type = 'Visa';
              } else if (firstDigit === '5') {
                cardData.card_type = 'Mastercard';
              } else if (
                firstDigit === '3' &&
                (cardNumber.charAt(1) === '4' || cardNumber.charAt(1) === '7')
              ) {
                cardData.card_type = 'American Express';
              } else if (firstTwoDigits === '35') {
                cardData.card_type = 'JCB';
              } else if (firstTwoDigits === '60' || firstTwoDigits === '65') {
                cardData.card_type = 'Discover';
              } else {
                cardData.card_type = 'Card';
              }
            }

            // Mask card number for security
            if (data['custom.card_primary_number']) {
              const fullNumber = data['custom.card_primary_number'];
              cardData.masked_card_number = '••••' + fullNumber.slice(-4);
            }

            // Don't include the actual sensitive data
            if (cardData.card_number) delete cardData.card_number;
            if (cardData.cvv) delete cardData.cvv;

            cards.push(cardData);
          }
        } catch (error) {
          console.warn(`Error decrypting custom card fields:`, error);
          // Continue with other methods
        }
      }

      return { bankAccounts, cards };
    } catch (error) {
      console.error(`Error getting payment methods for business: ${businessId}`, error);

      if (error instanceof FootprintServiceError) {
        throw error;
      }

      throw new FootprintServiceError(
        'GET_BUSINESS_PAYMENT_METHODS_FAILED',
        `Failed to get payment methods for business: ${businessId}`,
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  },

  /**
   * Remove a payment method from the business vault
   */
  async removeBusinessPaymentMethod(
    businessId: string,
    methodType: 'bank' | 'card',
    methodId: string = 'primary',
  ): Promise<boolean> {
    try {
      const client = this.initialize();

      // Check which fields exist
      const availableFields = await this.checkBusinessVaultFields(businessId);

      // Define customCardFields at the top level scope so it's available throughout the function
      const customCardFields =
        methodType === 'card'
          ? Object.keys(availableFields).filter(
              (field) => field.startsWith('custom.card_primary_') && availableFields[field],
            )
          : [];

      // If removing a card with methodId "primary" using custom fields
      if (methodType === 'card' && methodId === 'primary' && customCardFields.length > 0) {
        // Create a payload to set all fields to null
        const vaultUpdate: Record<string, any> = {};
        customCardFields.forEach((field) => {
          vaultUpdate[field] = null;
        });

        console.log('Removing custom card fields:', Object.keys(vaultUpdate));

        // Update the vault to remove the fields
        await client.patch(`/businesses/${businessId}/vault`, vaultUpdate);
        return true;
      }

      // Continue with standard field patterns for non-custom fields
      // Pattern to match fields for the specified payment method
      const pattern = new RegExp(`^${methodType === 'card' ? 'card' : 'bank'}\\.${methodId}\\..+$`);

      // Find all fields for this payment method
      const fieldsToRemove = Object.keys(availableFields).filter(
        (field) => pattern.test(field) && availableFields[field],
      );

      if (fieldsToRemove.length === 0) {
        // Fall back to legacy pattern if needed
        const legacyType = methodType === 'bank' ? 'bank_account' : 'payment_card';
        const legacyPattern = new RegExp(`^${legacyType}(?:\\.${methodId})?\\..+$`);

        const legacyFieldsToRemove = Object.keys(availableFields).filter(
          (field) => legacyPattern.test(field) && availableFields[field],
        );

        if (
          legacyFieldsToRemove.length === 0 &&
          !(methodType === 'card' && customCardFields.length > 0)
        ) {
          throw new FootprintServiceError(
            'PAYMENT_METHOD_NOT_FOUND',
            `Payment method not found: ${methodType} with ID ${methodId}`,
            {},
          );
        }

        fieldsToRemove.push(...legacyFieldsToRemove);
      }

      // If we found standard (non-custom) fields to remove
      if (fieldsToRemove.length > 0) {
        // Group fields by prefix to create proper structure
        const vaultUpdate: Record<string, any> = {};

        // Structure is different for removal - we need to set fields to null but
        // maintain the proper object structure
        const groupedFields: {
          [mainType: string]: {
            [alias: string]: {
              [field: string]: any;
            };
          };
        } = {};

        fieldsToRemove.forEach((field) => {
          // Extract components (eg: bank.primary.name => ['bank', 'primary', 'name'])
          const parts = field.split('.');

          if (parts.length >= 3) {
            const [mainType, alias, ...restParts] = parts;

            if (!groupedFields[mainType]) groupedFields[mainType] = {};
            if (!groupedFields[mainType][alias]) groupedFields[mainType][alias] = {};

            // Handle nested paths like billing_address.zip
            if (restParts.length > 1) {
              if (!groupedFields[mainType][alias][restParts[0]]) {
                groupedFields[mainType][alias][restParts[0]] = {};
              }
              let current = groupedFields[mainType][alias][restParts[0]];
              for (let i = 1; i < restParts.length - 1; i++) {
                if (!current[restParts[i]]) current[restParts[i]] = {};
                current = current[restParts[i]];
              }
              current[restParts[restParts.length - 1]] = null;
            } else {
              groupedFields[mainType][alias][restParts[0]] = null;
            }
          }
        });

        // Only include the target type/alias in the update
        const actualMethodType = methodType === 'card' ? 'card' : 'bank';
        if (groupedFields[actualMethodType] && groupedFields[actualMethodType][methodId]) {
          vaultUpdate[actualMethodType] = { [methodId]: groupedFields[actualMethodType][methodId] };
        }

        // For legacy format
        const legacyMethodType = methodType === 'bank' ? 'bank_account' : 'payment_card';
        if (groupedFields[legacyMethodType] && groupedFields[legacyMethodType][methodId]) {
          vaultUpdate[legacyMethodType] = { [methodId]: groupedFields[legacyMethodType][methodId] };
        }

        console.log('Removal update payload:', JSON.stringify(vaultUpdate, null, 2));

        // Update the vault to remove the fields
        await client.patch(`/businesses/${businessId}/vault`, vaultUpdate);
      }

      return true;
    } catch (error) {
      console.error(`Error removing payment method from business: ${businessId}`, error);

      if (error instanceof FootprintServiceError) {
        throw error;
      }

      throw new FootprintServiceError(
        'REMOVE_BUSINESS_PAYMENT_METHOD_FAILED',
        `Failed to remove payment method from business: ${businessId}`,
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  },

  /**
   * Store generic data in the business vault
   */
  async storeBusinessVaultData(
    businessId: string,
    vaultData: Record<string, any>,
  ): Promise<boolean> {
    try {
      const client = this.initialize();

      // Create a properly structured payload for the Footprint API
      const formattedData: Record<string, any> = {};

      // Process bank_account prefix fields
      const bankFields: Record<string, any> = {};
      const cardFields: Record<string, any> = {};
      const bankBillingAddress: Record<string, any> = {};
      const cardBillingAddress: Record<string, any> = {};
      const otherFields: Record<string, any> = {};

      for (const [key, value] of Object.entries(vaultData)) {
        if (key.startsWith('bank_account.')) {
          const fieldName = key.replace('bank_account.', '');
          bankFields[fieldName] = value;
        } else if (key.startsWith('payment_card.')) {
          const fieldName = key.replace('payment_card.', '');

          // Handle special case for billing address
          if (fieldName.startsWith('billing_address.')) {
            const addrField = fieldName.replace('billing_address.', '');
            cardBillingAddress[addrField] = value;
          } else {
            cardFields[fieldName] = value;
          }
        } else if (key.startsWith('bank.')) {
          // Already properly formatted
          const parts = key.split('.');
          if (parts.length >= 3) {
            if (!formattedData.bank) formattedData.bank = {};
            if (!formattedData.bank[parts[1]]) formattedData.bank[parts[1]] = {};

            if (parts[2] === 'billing_address' && parts.length === 4) {
              if (!formattedData.bank[parts[1]].billing_address) {
                formattedData.bank[parts[1]].billing_address = {};
              }
              formattedData.bank[parts[1]].billing_address[parts[3]] = value;
            } else {
              formattedData.bank[parts[1]][parts[2]] = value;
            }
          }
        } else if (key.startsWith('card.')) {
          // Already properly formatted
          const parts = key.split('.');
          if (parts.length >= 3) {
            if (!formattedData.card) formattedData.card = {};
            if (!formattedData.card[parts[1]]) formattedData.card[parts[1]] = {};

            if (parts[2] === 'billing_address' && parts.length === 4) {
              if (!formattedData.card[parts[1]].billing_address) {
                formattedData.card[parts[1]].billing_address = {};
              }
              formattedData.card[parts[1]].billing_address[parts[3]] = value;
            } else {
              formattedData.card[parts[1]][parts[2]] = value;
            }
          }
        } else {
          // Other fields
          otherFields[key] = value;
        }
      }

      // Add bank fields if present
      if (Object.keys(bankFields).length > 0) {
        if (!formattedData.bank) formattedData.bank = {};
        formattedData.bank.primary = { ...bankFields };
      }

      // Add card fields if present
      if (Object.keys(cardFields).length > 0) {
        if (!formattedData.card) formattedData.card = {};
        formattedData.card.primary = { ...cardFields };

        // Add billing address if present
        if (Object.keys(cardBillingAddress).length > 0) {
          formattedData.card.primary.billing_address = cardBillingAddress;
        }
      }

      // Add other fields
      Object.assign(formattedData, otherFields);

      console.log(
        'Sending formatted vault data to Footprint:',
        JSON.stringify(formattedData, null, 2),
      );

      // Store the data in the vault
      await client.patch(`/businesses/${businessId}/vault`, formattedData);

      return true;
    } catch (error) {
      console.error(`Error storing vault data for business: ${businessId}`, error);
      if (error instanceof FootprintServiceError) {
        throw error;
      }

      throw new FootprintServiceError(
        'STORE_BUSINESS_VAULT_DATA_FAILED',
        `Failed to store vault data for business: ${businessId}`,
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  },
};
