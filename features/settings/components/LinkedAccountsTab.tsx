// components/settings/LinkedAccountsTab.tsx
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useOnboardingStore } from '@/stores/onboardingStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Form schema for bank account
const bankAccountSchema = z.object({
  accountName: z.string().min(1, 'Account name is required'),
  accountNumber: z.string().min(1, 'Account number is required'),
  routingNumber: z.string().min(1, 'Routing number is required'),
  bankName: z.string().min(1, 'Bank name is required'),
});

// Form schema for credit card
const creditCardSchema = z.object({
  cardholderName: z.string().min(1, 'Cardholder name is required'),
  cardNumber: z.string().min(12, 'Invalid card number'),
  expiryDate: z.string().min(1, 'Expiry date is required'),
  cvv: z.string().min(3, 'Invalid CVV'),
});

type BankAccountFormData = z.infer<typeof bankAccountSchema>;
type CreditCardFormData = z.infer<typeof creditCardSchema>;

export default function LinkedAccountsTab() {
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [paymentMethodTab, setPaymentMethodTab] = useState('bank');
  const { paymentMethodsLinked, setPaymentMethodsLinked } = useOnboardingStore();

  const bankForm = useForm<BankAccountFormData>({
    resolver: zodResolver(bankAccountSchema),
    defaultValues: {
      accountName: '',
      accountNumber: '',
      routingNumber: '',
      bankName: '',
    },
  });

  const creditCardForm = useForm<CreditCardFormData>({
    resolver: zodResolver(creditCardSchema),
    defaultValues: {
      cardholderName: '',
      cardNumber: '',
      expiryDate: '',
      cvv: '',
    },
  });

  const onBankSubmit = async (data: BankAccountFormData) => {
    try {
      // In a real implementation, you would save this data to your backend
      console.log('Saving bank account:', data);

      // For demonstration, set the payment methods linked flag
      setPaymentMethodsLinked(true);

      setIsAddAccountModalOpen(false);
    } catch (error) {
      console.error('Error saving bank account:', error);
    }
  };

  const onCardSubmit = async (data: CreditCardFormData) => {
    try {
      // In a real implementation, you would save this data to your backend
      console.log('Saving credit card:', data);

      // For demonstration, set the payment methods linked flag
      setPaymentMethodsLinked(true);

      setIsAddAccountModalOpen(false);
    } catch (error) {
      console.error('Error saving credit card:', error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Linked Accounts</h2>
        <Button onClick={() => setIsAddAccountModalOpen(true)}>Add Payment Method</Button>
      </div>

      {/* Bank Accounts Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-md font-medium">Bank Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          {paymentMethodsLinked ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center space-x-4">
                  <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-semibold">WF</span>
                  </div>
                  <div>
                    <h3 className="font-medium">Business Checking</h3>
                    <p className="text-sm text-gray-500">Wells Fargo • ••••9876</p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm">
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                    Remove
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500 mb-4">No bank accounts linked yet.</p>
              <Button
                variant="outline"
                onClick={() => {
                  setPaymentMethodTab('bank');
                  setIsAddAccountModalOpen(true);
                }}
              >
                Add Bank Account
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Credit Cards Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-md font-medium">Credit Cards</CardTitle>
        </CardHeader>
        <CardContent>
          {paymentMethodsLinked ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center space-x-4">
                  <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-semibold">MC</span>
                  </div>
                  <div>
                    <h3 className="font-medium">Business Mastercard</h3>
                    <p className="text-sm text-gray-500">Chase • ••••5432</p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm">
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                    Remove
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500 mb-4">No credit cards linked yet.</p>
              <Button
                variant="outline"
                onClick={() => {
                  setPaymentMethodTab('card');
                  setIsAddAccountModalOpen(true);
                }}
              >
                Add Credit Card
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Payment Method Modal */}
      <Dialog open={isAddAccountModalOpen} onOpenChange={setIsAddAccountModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Payment Method</DialogTitle>
            <DialogDescription>
              Link a payment method to your account for sending and receiving payments.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={paymentMethodTab} onValueChange={setPaymentMethodTab}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="bank">Bank Account</TabsTrigger>
              <TabsTrigger value="card">Credit Card</TabsTrigger>
            </TabsList>

            <TabsContent value="bank">
              <form onSubmit={bankForm.handleSubmit(onBankSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="accountName">Account Name</Label>
                  <Input id="accountName" {...bankForm.register('accountName')} />
                  {bankForm.formState.errors.accountName && (
                    <p className="text-sm text-red-500">
                      {bankForm.formState.errors.accountName.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accountNumber">Account Number</Label>
                  <Input id="accountNumber" {...bankForm.register('accountNumber')} />
                  {bankForm.formState.errors.accountNumber && (
                    <p className="text-sm text-red-500">
                      {bankForm.formState.errors.accountNumber.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="routingNumber">Routing Number</Label>
                  <Input id="routingNumber" {...bankForm.register('routingNumber')} />
                  {bankForm.formState.errors.routingNumber && (
                    <p className="text-sm text-red-500">
                      {bankForm.formState.errors.routingNumber.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bankName">Bank Name</Label>
                  <Input id="bankName" {...bankForm.register('bankName')} />
                  {bankForm.formState.errors.bankName && (
                    <p className="text-sm text-red-500">
                      {bankForm.formState.errors.bankName.message}
                    </p>
                  )}
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => setIsAddAccountModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={bankForm.formState.isSubmitting}>
                    {bankForm.formState.isSubmitting ? 'Adding...' : 'Add Bank Account'}
                  </Button>
                </DialogFooter>
              </form>
            </TabsContent>

            <TabsContent value="card">
              <form onSubmit={creditCardForm.handleSubmit(onCardSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cardholderName">Cardholder Name</Label>
                  <Input id="cardholderName" {...creditCardForm.register('cardholderName')} />
                  {creditCardForm.formState.errors.cardholderName && (
                    <p className="text-sm text-red-500">
                      {creditCardForm.formState.errors.cardholderName.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cardNumber">Card Number</Label>
                  <Input id="cardNumber" {...creditCardForm.register('cardNumber')} />
                  {creditCardForm.formState.errors.cardNumber && (
                    <p className="text-sm text-red-500">
                      {creditCardForm.formState.errors.cardNumber.message}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="expiryDate">Expiry Date</Label>
                    <Input
                      id="expiryDate"
                      placeholder="MM/YY"
                      {...creditCardForm.register('expiryDate')}
                    />
                    {creditCardForm.formState.errors.expiryDate && (
                      <p className="text-sm text-red-500">
                        {creditCardForm.formState.errors.expiryDate.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cvv">CVV</Label>
                    <Input id="cvv" {...creditCardForm.register('cvv')} />
                    {creditCardForm.formState.errors.cvv && (
                      <p className="text-sm text-red-500">
                        {creditCardForm.formState.errors.cvv.message}
                      </p>
                    )}
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => setIsAddAccountModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={creditCardForm.formState.isSubmitting}>
                    {creditCardForm.formState.isSubmitting ? 'Adding...' : 'Add Credit Card'}
                  </Button>
                </DialogFooter>
              </form>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
