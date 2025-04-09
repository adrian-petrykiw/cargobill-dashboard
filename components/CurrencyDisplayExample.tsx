// components/CurrencyDisplayExample.tsx
import React from 'react'; // Add this import
import { useCurrency } from '@/hooks/useCurrency';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnyCurrencyCode } from '@/types/currency';

interface PriceDisplayProps {
  amountInUSD: number;
  label: string;
}

// Example component that displays prices in the user's selected currency
export function PriceDisplay({ amountInUSD, label }: PriceDisplayProps) {
  const { currency, convertFromUSD, formatCurrency } = useCurrency();

  // Convert the USD amount to the user's selected currency
  const convertedAmount = convertFromUSD(amountInUSD);

  return (
    <div className="flex justify-between items-center py-2">
      <span className="text-gray-600">{label}</span>
      <span className="font-medium">{formatCurrency(convertedAmount)}</span>
    </div>
  );
}

// Example component showing exchange rates between currencies
export function ExchangeRateDisplay({ from, to }: { from: AnyCurrencyCode; to: AnyCurrencyCode }) {
  const { convert, formatCurrency } = useCurrency();

  // Convert 1 unit of the source currency to the target currency
  const rate = convert(1, from, to);

  return (
    <div className="flex justify-between items-center py-2">
      <span className="text-gray-600">1 {from} =</span>
      <span className="font-medium">{formatCurrency(rate, to)}</span>
    </div>
  );
}

// Example dashboard card that uses the currency components
export default function CurrencyDisplayExample() {
  const { currency } = useCurrency();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pricing in {currency}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Transaction Fees</h3>
          <PriceDisplay amountInUSD={100} label="Standard Fee" />
          <PriceDisplay amountInUSD={250} label="Premium Fee" />
          <PriceDisplay amountInUSD={500} label="Enterprise Fee" />
        </div>

        <div className="pt-2 border-t">
          <h3 className="text-sm font-medium mb-2">Current Exchange Rates</h3>
          <ExchangeRateDisplay from="USD" to={currency as AnyCurrencyCode} />
          <ExchangeRateDisplay from="EUR" to={currency as AnyCurrencyCode} />
          <ExchangeRateDisplay from="USDC" to={currency as AnyCurrencyCode} />
        </div>
      </CardContent>
    </Card>
  );
}
