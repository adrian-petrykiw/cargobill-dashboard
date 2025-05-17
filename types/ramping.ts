export interface PaymentMethod {
  id: string;
  bank_name: string;
  masked_account_number?: string;
  account_holder_name?: string;
  bank_country?: string;
  account_type?: string;
}
