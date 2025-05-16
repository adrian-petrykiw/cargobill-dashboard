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
};
