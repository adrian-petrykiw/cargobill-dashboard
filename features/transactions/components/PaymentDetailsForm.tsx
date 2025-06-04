// features/transactions/components/PaymentDetailsForm.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PublicKey } from '@solana/web3.js';
import { useTokenBalance } from '@/hooks/useTokenBalances';
import { Organization } from '@/schemas/organization.schema';
import { useEffect, useState } from 'react';
import {
  paymentDetailsSchema,
  PaymentDetailsFormValues,
  EnrichedVendorFormValues,
} from '@/schemas/vendor.schema';

interface PaymentDetailsFormProps {
  onNext: (data: PaymentDetailsFormValues & { onrampFee: number }) => void;
  onBack: () => void;
  vendorFormData: EnrichedVendorFormValues;
  walletAddress: string;
  organization: Organization | null;
}

export function PaymentDetailsForm({
  onNext,
  onBack,
  vendorFormData,
  walletAddress,
  organization,
}: PaymentDetailsFormProps) {
  const totalAmount = vendorFormData?.totalAmount || 0;
  const tokenType = vendorFormData?.tokenType || 'USDC';

  // Extract multisig address from organization data
  const [multisigPda, setMultisigPda] = useState<PublicKey | null>(null);

  useEffect(() => {
    if (organization?.operational_wallet?.address) {
      try {
        const multisigAddress = new PublicKey(organization.operational_wallet.address);
        console.log('Using operational wallet multisig:', multisigAddress.toBase58());
        setMultisigPda(multisigAddress);
      } catch (error) {
        console.error('Invalid multisig address:', error);
      }
    }
  }, [organization]);

  // Fetch token balance
  const { data: tokenBalance, isLoading: isLoadingBalance } = useTokenBalance(
    multisigPda,
    tokenType,
  );

  const form = useForm<PaymentDetailsFormValues>({
    resolver: zodResolver(paymentDetailsSchema),
    defaultValues: {
      paymentMethod: 'account_credit',
      tokenType, // Initialize with the token type from previous step
    },
  });

  const selectedMethod = form.watch('paymentMethod');

  // Calculate onramp fee based on payment method
  const calculateOnrampFee = (paymentMethod: string, amount: number): number => {
    // Business wallet (account_credit) doesn't require onramp, so no fee
    if (paymentMethod === 'account_credit') {
      return 0;
    }

    // For now, using placeholder onramp fees for different payment methods
    // In the future, this will use the Zynk API to get real quotes
    const onrampFeeRates = {
      ach: 0.005, // 0.5% for ACH
      wire: 0.003, // 0.3% for wire
      credit_card: 0.029, // 2.9% for credit card
      debit_card: 0.025, // 2.5% for debit card
    };

    const rate = onrampFeeRates[paymentMethod as keyof typeof onrampFeeRates] || 0.02; // Default 2%
    const calculatedFee = amount * rate;

    // Minimum fee of $1, maximum of $100 for placeholder logic
    return Math.max(1, Math.min(100, calculatedFee));
  };

  const currentOnrampFee = calculateOnrampFee(selectedMethod, totalAmount);
  const requiresOnramp = selectedMethod !== 'account_credit';

  const onSubmit = (data: PaymentDetailsFormValues) => {
    // Include the onramp fee in the data
    const dataWithOnrampFee = {
      ...data,
      onrampFee: currentOnrampFee,
    };

    console.log('Payment data with onramp fee:', dataWithOnrampFee);
    onNext(dataWithOnrampFee);
  };

  const formatBalance = (balance: number | null | undefined) => {
    if (balance === null || balance === undefined) return '0.00';
    return balance.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <Form {...form}>
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto pb-24">
          <form id="payment-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
            <Card className="bg-white rounded-sm mb-4 py-0 border-t">
              <CardContent className="p-4 flex w-full h-full items-center justify-between">
                <h2 className="font-medium text-md">Total Payment Amount</h2>
                <p className="text-md font-semibold">
                  {totalAmount.toFixed(2)} {tokenType}
                </p>
              </CardContent>
            </Card>

            <h2 className="text-lg font-semibold">Payment Method</h2>

            <div className="space-y-4">
              <FormField
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="account_credit">Business Wallet</SelectItem>
                        <SelectItem value="ach">ACH Transfer</SelectItem>
                        <SelectItem value="wire">Wire Transfer</SelectItem>
                        <SelectItem value="credit_card">Credit Card</SelectItem>
                        <SelectItem value="debit_card">Debit Card</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {selectedMethod === 'account_credit' && (
              <div className="pt-0 flex justify-end">
                <div className="text-sm text-muted-foreground">
                  Available {tokenType} balance:{' '}
                  {isLoadingBalance ? (
                    <Skeleton className="h-4 w-16 inline-block" />
                  ) : (
                    `${formatBalance(tokenBalance?.balance)} ${tokenType}`
                  )}
                </div>
                {(tokenBalance?.balance ?? 0) < totalAmount && !isLoadingBalance && (
                  <p className="text-sm text-destructive mt-1 text-red-500 font-medium">
                    Insufficient {tokenType} balance for this transaction. Please choose another
                    payment method or deposit more funds!
                  </p>
                )}
              </div>
            )}

            {/* Show onramp fee info for non-business wallet methods */}
            {/* {requiresOnramp && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-blue-900">Instant Onramp Fee:</span>
                  <span className="text-sm font-bold text-blue-900">
                    {currentOnrampFee.toFixed(2)} {tokenType}
                  </span>
                </div>
                <p className="text-xs text-blue-700">
                  This fee covers the cost of instantly converting your{' '}
                  {selectedMethod.replace('_', ' ')} payment to {tokenType} in your business wallet.
                </p>
              </div>
            )} */}

            {selectedMethod === 'ach' && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="accountName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter account name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="routingNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Routing Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter routing number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="accountNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter account number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="accountType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select account type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="checking">Checking</SelectItem>
                          <SelectItem value="savings">Savings</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {selectedMethod === 'wire' && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="bankName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bank Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter bank name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="routingNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Routing Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter routing number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="accountNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter account number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="swiftCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SWIFT Code (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter SWIFT code" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {(selectedMethod === 'credit_card' || selectedMethod === 'debit_card') && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="cardNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Card Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter card number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="expiryDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expiry Date</FormLabel>
                        <FormControl>
                          <Input placeholder="MM/YY" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="cvv"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CVV</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter CVV" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="billingName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Billing Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter billing name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="billingAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Billing Address</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter billing address" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="billingCity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input placeholder="City" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="billingState"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <FormControl>
                          <Input placeholder="State" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="billingZip"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ZIP Code</FormLabel>
                        <FormControl>
                          <Input placeholder="ZIP" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}
          </form>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-6 bg-background mt-auto">
          <div className="flex gap-4">
            <Button
              type="button"
              onClick={onBack}
              className="flex-1 bg-slate-300 hover:bg-slate-300 text-gray-700"
              variant="secondary"
            >
              Back
            </Button>
            <Button
              type="submit"
              form="payment-form"
              className="flex-1"
              disabled={
                selectedMethod === 'account_credit' && (tokenBalance?.balance ?? 0) < totalAmount
              }
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </Form>
  );
}
