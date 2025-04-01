export const formatCurrency = (amount: number, currency = 'USD', locale = 'en-US'): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const formatCryptoAmount = (amount: number, token = 'USDC', decimals = 6): string => {
  return `${amount.toFixed(decimals)} ${token}`;
};
