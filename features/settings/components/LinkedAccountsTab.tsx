// components/settings/LinkedAccountsTab.tsx
import { useState, useEffect } from 'react';
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
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import axios from 'axios';
import { useOrganizations } from '@/hooks/useOrganizations';
import Spinner from '@/components/common/Spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BankingCountryOption,
  CreditCardFormData,
  PaymentMethod,
  creditCardSchema,
  mapToZynkAccountFormat,
} from '@/schemas/payment-method.schema';
import {
  BankingFieldConfig,
  getBankAccountSchema,
  getBankingFieldsForCountry,
  getCountryOptionsForBanking,
  transformBankDataForApi,
} from '@/schemas/banking-fields.schema';

export default function LinkedAccountsTab() {
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [paymentMethodTab, setPaymentMethodTab] = useState('bank');
  const { paymentMethodsLinked, setPaymentMethodsLinked } = useOnboardingStore();
  const { organization, isLoading: isOrgLoading } = useOrganizations();

  const [bankAccounts, setBankAccounts] = useState<PaymentMethod[]>([]);
  const [cards, setCards] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<{ [key: string]: boolean }>({});
  const [bankCountry, setBankCountry] = useState('US');
  const [bankFieldConfig, setBankFieldConfig] = useState<BankingFieldConfig>(
    getBankingFieldsForCountry('US'),
  );

  const countryOptions: BankingCountryOption[] = getCountryOptionsForBanking();

  // Bank account form
  const bankForm = useForm<Record<string, any>>({
    resolver: zodResolver(getBankAccountSchema(bankCountry)),
    defaultValues: {
      accountHolderName: '',
      bankName: '',
      bankCountry: 'US',
      ...(bankCountry === 'US' && {
        accountNumber: '',
        routingNumber: '',
        accountType: 'checking',
      }),
    },
  });

  // Credit card form
  const creditCardForm = useForm<CreditCardFormData>({
    resolver: zodResolver(creditCardSchema),
    defaultValues: {
      cardholderName: '',
      cardNumber: '',
      expiryDate: '',
      cvv: '',
      billingZip: '',
      billingCountry: '',
    },
  });

  // Function to reset bank form fields when country changes
  const resetBankFieldsForCountry = (countryCode: string) => {
    const config = getBankingFieldsForCountry(countryCode);
    setBankFieldConfig(config);

    // Reset form with appropriate default values
    const defaultValues: Record<string, string> = {
      bankCountry: countryCode,
      accountHolderName: '',
      bankName: '',
    };

    // Add default values for all fields in the config
    config.fields.forEach((field: string) => {
      if (field !== 'accountHolderName' && field !== 'bankName') {
        defaultValues[field] = '';
      }
    });

    // Special case for US account type
    if (countryCode === 'US') {
      defaultValues.accountType = 'checking';
    }

    // Reset the form with these new default values
    bankForm.reset(defaultValues);
  };

  // Function to fetch payment methods
  const fetchPaymentMethods = async () => {
    if (!organization?.id) return;

    setIsLoading(true);
    try {
      const response = await axios.get(`/api/organizations/${organization.id}/payment-methods`);

      if (response.data.success) {
        const { bankAccounts: fetchedBankAccounts, cards: fetchedCards } = response.data.data;
        setBankAccounts(fetchedBankAccounts || []);
        setCards(fetchedCards || []);
        setPaymentMethodsLinked(fetchedBankAccounts.length > 0 || fetchedCards.length > 0);
      }
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      toast.error('Failed to load payment methods');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch payment methods when the component mounts or organization changes
  useEffect(() => {
    if (organization?.id && organization.verification_status === 'verified') {
      fetchPaymentMethods();
    } else {
      setIsLoading(false);
    }
  }, [organization?.id, organization?.verification_status]);

  // Update bank form when country changes
  useEffect(() => {
    // We don't want to reset the form on the initial render
    if (bankCountry) {
      setBankFieldConfig(getBankingFieldsForCountry(bankCountry));
      bankForm.setValue('bankCountry', bankCountry);
    }
  }, [bankCountry]);

  // Determine if verification is required
  const isBusinessVerified = !!(
    organization &&
    organization.last_verified_at !== null &&
    organization.verification_status === 'verified'
  );

  const handleAddPaymentMethod = () => {
    if (!isBusinessVerified) {
      toast.error(`Please complete business verification`, {
        duration: 3000,
        position: 'top-center',
        icon: '🔒',
      });
      return;
    }

    // Reset forms before opening modal
    resetBankFieldsForCountry(bankCountry);
    creditCardForm.reset();
    setIsAddAccountModalOpen(true);
  };

  const handleCountryChange = (value: string) => {
    setBankCountry(value);
    resetBankFieldsForCountry(value);
  };

  // Handle bank account form submission
  const onBankSubmit: SubmitHandler<Record<string, any>> = async (data) => {
    if (!organization?.id) return;

    setIsSubmitting(true);
    try {
      // Transform data based on country format
      const transformedData = transformBankDataForApi(data, data.bankCountry);

      const response = await axios.post(`/api/organizations/${organization.id}/payment-methods`, {
        type: 'bank_account',
        ...transformedData,
      });

      if (response.data.success) {
        toast.success('Bank account added successfully');
        setIsAddAccountModalOpen(false);
        fetchPaymentMethods(); // Refresh the list
      }
    } catch (error) {
      console.error('Error adding bank account:', error);
      let errorMessage = 'Failed to add bank account';

      if (axios.isAxiosError(error) && error.response?.data?.error?.message) {
        errorMessage = error.response.data.error.message;
      }

      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle credit card form submission
  const onCardSubmit: SubmitHandler<CreditCardFormData> = async (data) => {
    if (!organization?.id) return;

    setIsSubmitting(true);
    try {
      const response = await axios.post(`/api/organizations/${organization.id}/payment-methods`, {
        type: 'card',
        cardholderName: data.cardholderName,
        cardNumber: data.cardNumber,
        expiryDate: data.expiryDate,
        cvv: data.cvv,
        billingZip: data.billingZip,
        billingCountry: data.billingCountry,
      });

      if (response.data.success) {
        toast.success('Card added successfully');
        setIsAddAccountModalOpen(false);
        fetchPaymentMethods();
      }
    } catch (error) {
      console.error('Error adding card:', error);
      let errorMessage = 'Failed to add card';

      if (axios.isAxiosError(error) && error.response?.data?.error?.message) {
        errorMessage = error.response.data.error.message;
      }

      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemovePaymentMethod = async (type: 'bank_account' | 'payment_card', id: string) => {
    if (!organization?.id) return;

    // Update the deleting state for this specific payment method
    setIsDeleting((prev) => ({ ...prev, [id]: true }));

    try {
      const response = await axios.delete(
        `/api/organizations/${organization.id}/payment-methods?methodType=${type}&methodId=${id}`,
      );

      if (response.data.success) {
        toast.success('Payment method removed successfully');
        fetchPaymentMethods(); // Refresh the list
      }
    } catch (error) {
      console.error('Error removing payment method:', error);
      let errorMessage = 'Failed to remove payment method';

      if (axios.isAxiosError(error) && error.response?.data?.error?.message) {
        errorMessage = error.response.data.error.message;
      }

      toast.error(errorMessage);
    } finally {
      setIsDeleting((prev) => ({ ...prev, [id]: false }));
    }
  };

  // Format expiry date when typing
  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, ''); // Remove non-digits

    if (value.length > 2) {
      value = value.slice(0, 2) + '/' + value.slice(2, 4);
    }

    creditCardForm.setValue('expiryDate', value);
  };

  // Helper function to get card logo/icon
  const getCardLogo = (cardType?: string) => {
    if (!cardType) return 'CC';

    const typeMap: { [key: string]: string } = {
      Visa: 'V',
      Mastercard: 'MC',
      'American Express': 'AMEX',
      Discover: 'DSC',
      JCB: 'JCB',
    };

    return typeMap[cardType] || cardType.substring(0, 2).toUpperCase();
  };

  // Helper function to get bank logo/icon
  const getBankLogo = (bankName?: string) => {
    if (!bankName) return 'BK';

    // Get first letters of each word in bank name
    return bankName
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase())
      .join('')
      .substring(0, 2);
  };

  // Render dynamic form fields based on country
  const renderBankFields = () => {
    return (
      <>
        {/* Country selector first */}
        <div className="space-y-2">
          <Label htmlFor="bankCountry">Bank Country</Label>
          <Select
            defaultValue={bankCountry}
            onValueChange={(value) => {
              bankForm.setValue('bankCountry', value);
              handleCountryChange(value);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select bank country" />
            </SelectTrigger>
            <SelectContent>
              {countryOptions.map((country: BankingCountryOption) => (
                <SelectItem key={country.value} value={country.value}>
                  {country.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Account Holder Name - common for all countries */}
        <div className="space-y-2">
          <Label htmlFor="accountHolderName">Account Holder Name</Label>
          <Input id="accountHolderName" {...bankForm.register('accountHolderName')} />
          {bankForm.formState.errors.accountHolderName && (
            <p className="text-sm text-red-500">
              {bankForm.formState.errors.accountHolderName.message as string}
            </p>
          )}
        </div>

        {/* Bank Name - common for all countries */}
        <div className="space-y-2">
          <Label htmlFor="bankName">Bank Name</Label>
          <Input id="bankName" {...bankForm.register('bankName')} />
          {bankForm.formState.errors.bankName && (
            <p className="text-sm text-red-500">
              {bankForm.formState.errors.bankName.message as string}
            </p>
          )}
        </div>

        {/* Dynamic fields based on country */}
        {bankFieldConfig.fields
          .filter(
            (field: string) =>
              field !== 'accountHolderName' && field !== 'bankName' && field !== 'bankCountry',
          )
          .map((field: string) => (
            <div key={field} className="space-y-2">
              <Label htmlFor={field}>
                {bankFieldConfig.uiLabels[field] || field.charAt(0).toUpperCase() + field.slice(1)}
              </Label>
              {field === 'accountType' && bankCountry === 'US' ? (
                <Select
                  defaultValue={bankForm.getValues().accountType || 'checking'}
                  onValueChange={(value) =>
                    bankForm.setValue('accountType', value as 'checking' | 'savings' | 'business')
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="checking">Checking</SelectItem>
                    <SelectItem value="savings">Savings</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id={field}
                  placeholder={bankFieldConfig.uiHints?.[field] || ''}
                  {...bankForm.register(field)}
                />
              )}
              {bankForm.formState.errors[field] && (
                <p className="text-sm text-red-500">
                  {bankForm.formState.errors[field]?.message as string}
                </p>
              )}
            </div>
          ))}
      </>
    );
  };

  // Show loading state for the entire component if organization is loading
  if (isOrgLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-8 flex justify-center items-center">
            <Spinner className="h-8 w-8 text-gray-400" />
            <p className="ml-3">Loading account information...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bank Accounts Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-md font-medium">Bank Accounts</CardTitle>
          {isBusinessVerified && (
            <Button
              onClick={() => {
                setPaymentMethodTab('bank');
                handleAddPaymentMethod();
              }}
              size="sm"
            >
              Add Bank Account
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <Spinner className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Loading bank accounts...</p>
            </div>
          ) : bankAccounts.length > 0 ? (
            <div className="space-y-4">
              {bankAccounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between border-b pb-4">
                  <div className="flex items-center space-x-4">
                    <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold">
                        {getBankLogo(account.bank_name)}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-medium">
                        {account.account_holder_name || 'Business Account'}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {account.bank_name} • {account.masked_account_number || '••••••••1234'}
                      </p>
                      {account.bank_country && (
                        <p className="text-xs text-gray-400">
                          {countryOptions.find((c) => c.value === account.bank_country)?.label ||
                            account.bank_country}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => handleRemovePaymentMethod('bank_account', account.id)}
                      disabled={isDeleting[account.id]}
                    >
                      {isDeleting[account.id] ? (
                        <>
                          <Spinner className="h-4 w-4 mr-2" />
                          Removing...
                        </>
                      ) : (
                        'Remove'
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500 mb-4">No bank accounts added</p>
              {isBusinessVerified && (
                <Button
                  onClick={() => {
                    setPaymentMethodTab('bank');
                    handleAddPaymentMethod();
                  }}
                >
                  Add New Bank Account +
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Credit Cards Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-md font-medium">Cards</CardTitle>
          {isBusinessVerified && (
            <Button
              onClick={() => {
                setPaymentMethodTab('card');
                handleAddPaymentMethod();
              }}
              size="sm"
            >
              Add Card
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <Spinner className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Loading cards...</p>
            </div>
          ) : cards.length > 0 ? (
            <div className="space-y-4">
              {cards.map((card) => (
                <div key={card.id} className="flex items-center justify-between border-b pb-4">
                  <div className="flex items-center space-x-4">
                    <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold">
                        {getCardLogo(card.card_type)}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-medium">{card.cardholder_name || 'Business Card'}</h3>
                      <p className="text-sm text-gray-500">
                        {card.card_type || 'Card'} • {card.masked_card_number || '••••1234'}
                      </p>
                      {card.expiry_date && (
                        <p className="text-xs text-gray-400">Expires: {card.expiry_date}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => handleRemovePaymentMethod('payment_card', card.id)}
                      disabled={isDeleting[card.id]}
                    >
                      {isDeleting[card.id] ? (
                        <>
                          <Spinner className="h-4 w-4 mr-2" />
                          Removing...
                        </>
                      ) : (
                        'Remove'
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500 mb-4">No cards added</p>
              {isBusinessVerified && (
                <Button
                  onClick={() => {
                    setPaymentMethodTab('card');
                    handleAddPaymentMethod();
                  }}
                >
                  Add New Card +
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Payment Method Modal */}
      <Dialog open={isAddAccountModalOpen} onOpenChange={setIsAddAccountModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Payment Method</DialogTitle>
            <DialogDescription>Link a payment method to your account</DialogDescription>
          </DialogHeader>

          <Tabs value={paymentMethodTab} onValueChange={setPaymentMethodTab}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="bank">Bank Account</TabsTrigger>
              <TabsTrigger value="card">Card</TabsTrigger>
            </TabsList>

            <TabsContent value="bank">
              <form onSubmit={bankForm.handleSubmit(onBankSubmit)} className="space-y-4">
                {renderBankFields()}

                <DialogFooter>
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => setIsAddAccountModalOpen(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Spinner className="h-4 w-4 mr-2" />
                        Linking...
                      </>
                    ) : (
                      'Link Account'
                    )}
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
                      onChange={handleExpiryChange}
                    />
                    {creditCardForm.formState.errors.expiryDate && (
                      <p className="text-sm text-red-500">
                        {creditCardForm.formState.errors.expiryDate.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cvv">CVV</Label>
                    <Input id="cvv" {...creditCardForm.register('cvv')} maxLength={4} />
                    {creditCardForm.formState.errors.cvv && (
                      <p className="text-sm text-red-500">
                        {creditCardForm.formState.errors.cvv.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="billingZip">Billing ZIP/Postal Code</Label>
                    <Input id="billingZip" {...creditCardForm.register('billingZip')} />
                    {creditCardForm.formState.errors.billingZip && (
                      <p className="text-sm text-red-500">
                        {creditCardForm.formState.errors.billingZip.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="billingCountry">Billing Country</Label>
                    <Select
                      onValueChange={(value) => creditCardForm.setValue('billingCountry', value)}
                      defaultValue={creditCardForm.getValues().billingCountry}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        {countryOptions.map((country) => (
                          <SelectItem key={country.value} value={country.value}>
                            {country.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => setIsAddAccountModalOpen(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Spinner className="h-4 w-4 mr-2" />
                        Linking...
                      </>
                    ) : (
                      'Link Card'
                    )}
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
