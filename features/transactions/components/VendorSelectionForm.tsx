// features/transactions/components/VendorSelectionForm.tsx (continued)
import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import {
  Command,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandEmpty,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Check, CaretSortIcon, PlusIcon, TrashIcon } from 'lucide-react';
import { VendorListItem } from '@/types/vendor';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TOKENS } from '@/constants/solana';
import { TokenType } from '@/types/token';

// Create schema for the vendor form
const createVendorFormSchema = (customFields: any[] = []) => {
  let baseSchema = z.object({
    vendor: z.string().min(1, 'Vendor is required'),
    invoices: z
      .array(
        z.object({
          number: z.string().min(1, 'Invoice number is required'),
          amount: z.number().positive('Amount must be positive'),
        }),
      )
      .min(1, 'At least one invoice is required'),
    tokenType: z.enum(['USDC', 'USDT', 'SOL']).default('USDC'),
    additionalInfo: z.string().optional(),
    relatedBolAwb: z.string().optional(),
  });

  // Add custom fields to schema if provided
  if (customFields && customFields.length > 0) {
    const customFieldsSchema: Record<string, z.ZodTypeAny> = {};

    customFields.forEach((field) => {
      if (field.type === 'number') {
        customFieldsSchema[field.key] = field.required
          ? z.number({ required_error: `${field.name} is required` })
          : z.number().optional();
      } else {
        customFieldsSchema[field.key] = field.required
          ? z.string().min(1, `${field.name} is required`)
          : z.string().optional();
      }
    });

    baseSchema = baseSchema.extend(customFieldsSchema);
  }

  return baseSchema;
};

export type VendorFormValues = z.infer<ReturnType<typeof createVendorFormSchema>>;

interface VendorSelectionFormProps {
  walletAddress: string;
  onNext: (data: VendorFormValues) => void;
  availableVendors: VendorListItem[];
  isVendorsLoading: boolean;
  vendorsError: Error | null;
  refetchVendors: () => void;
}

export function VendorSelectionForm({
  walletAddress,
  onNext,
  availableVendors,
  isVendorsLoading,
  vendorsError,
  refetchVendors,
}: VendorSelectionFormProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);
  const [vendorDetails, setVendorDetails] = useState<any | null>(null);
  const [isVendorLoading, setIsVendorLoading] = useState(false);

  const filteredVendors = availableVendors.filter((vendor) =>
    vendor.name.toLowerCase().includes(query.toLowerCase()),
  );

  // Fetch vendor details when selected
  useEffect(() => {
    async function fetchVendorDetails() {
      if (!selectedVendor) return;

      setIsVendorLoading(true);
      try {
        // You can replace this with your actual vendor details API call
        const response = await fetch(`/api/vendors/${selectedVendor}`);
        if (!response.ok) throw new Error('Failed to fetch vendor details');

        const data = await response.json();
        setVendorDetails(data);
      } catch (error) {
        console.error('Error fetching vendor details:', error);
      } finally {
        setIsVendorLoading(false);
      }
    }

    fetchVendorDetails();
  }, [selectedVendor]);

  // Initialize form with schema
  const form = useForm<VendorFormValues>({
    resolver: zodResolver(createVendorFormSchema(vendorDetails?.business_details?.customFields)),
    defaultValues: {
      vendor: '',
      invoices: [{ number: '', amount: 0 }],
      tokenType: 'USDC',
      additionalInfo: '',
      relatedBolAwb: '',
    },
  });

  // Setup field array for invoices
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'invoices',
  });

  // Calculate total amount from all invoices
  const totalAmount = form
    .watch('invoices')
    .reduce((sum, invoice) => sum + (invoice.amount || 0), 0);

  // Reset form when vendor changes
  useEffect(() => {
    if (vendorDetails) {
      // Reset custom fields if needed
      const formValues = { ...form.getValues() };

      if (vendorDetails.business_details?.customFields) {
        vendorDetails.business_details.customFields.forEach((field: any) => {
          formValues[field.key] = field.defaultValue || '';
        });
      }

      form.reset({
        ...formValues,
        vendor: selectedVendor || '',
      });
    }
  }, [vendorDetails, form, selectedVendor]);

  const onSubmit = (data: VendorFormValues) => {
    const enrichedData = {
      ...data,
      totalAmount,
      sender: walletAddress,
      receiverDetails: vendorDetails,
    };
    onNext(enrichedData);
  };

  if (isVendorsLoading) {
    return (
      <div className="flex flex-col space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  if (!isVendorsLoading && vendorsError) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center">
        <p className="text-red-500 mb-4">{vendorsError.message || 'Failed to load vendors'}</p>
        <Button onClick={() => refetchVendors()} variant="outline">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto pb-24">
          <form id="vendor-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="vendor"
                render={({ field }) => (
                  <FormItem className="md:flex md:flex-col md:justify-end">
                    <FormLabel>Vendor/Biller</FormLabel>
                    <Popover open={open} onOpenChange={setOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={`w-full justify-between ${
                              !field.value && 'text-muted-foreground'
                            }`}
                          >
                            {field.value
                              ? availableVendors.find(
                                  (vendor: VendorListItem) => vendor.id === field.value,
                                )?.name
                              : 'Select vendor'}
                            <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-[var(--radix-popover-trigger-width)] p-0"
                        align="start"
                      >
                        <Command>
                          <CommandInput
                            placeholder="Search vendors..."
                            className="h-9"
                            value={query}
                            onValueChange={setQuery}
                          />
                          <CommandList>
                            <CommandEmpty>No vendors found.</CommandEmpty>
                            <CommandGroup>
                              {filteredVendors.map((vendor: VendorListItem) => (
                                <CommandItem
                                  key={vendor.id}
                                  value={vendor.id}
                                  onSelect={() => {
                                    form.setValue('vendor', vendor.id);
                                    setSelectedVendor(vendor.id);
                                    setOpen(false);
                                    setQuery('');
                                  }}
                                >
                                  {vendor.name}
                                  <Check
                                    className={`ml-auto h-4 w-4 ${
                                      vendor.id === field.value ? 'opacity-100' : 'opacity-0'
                                    }`}
                                  />
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Card className="bg-muted/50">
                <CardContent className="p-4">
                  {!selectedVendor ? (
                    <div className="text-sm text-muted-foreground justify-center p-4 items-center text-center">
                      Please select a vendor to view details
                    </div>
                  ) : isVendorLoading ? (
                    <div className="space-y-1 p-0 m-0">
                      <Skeleton className="h-[14px] w-[250px]" />
                      <Skeleton className="h-[12px] w-[200px]" />
                      <Skeleton className="h-[12px] w-[150px]" />
                    </div>
                  ) : vendorDetails ? (
                    <div className="p-0 m-0">
                      <h4 className="font-semibold text-sm">
                        {vendorDetails.business_details?.companyName}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {vendorDetails.business_details?.companyAddress}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {vendorDetails.business_details?.companyPhone}
                      </p>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>

            {selectedVendor && vendorDetails && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="tokenType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(TOKENS).map(([key, token]) => (
                            <SelectItem key={key} value={key}>
                              {token.name} ({key})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4">
                  <div className="flex mb-[-12px] gap-6">
                    <div className="w-[50%]">
                      <FormLabel>Invoices</FormLabel>
                    </div>
                    <div className={`w-[50%] ${fields.length > 1 ? `mr-[3px]` : `mr-16`}`}>
                      <FormLabel className="text-sm text-muted-foreground w-full flex">
                        Amount ({form.watch('tokenType')})
                      </FormLabel>
                    </div>
                    {fields.length > 1 && <div className="w-10" />}
                  </div>

                  {fields.map((field, index) => (
                    <div key={field.id} className="space-y-2">
                      <div className="flex gap-6 w-full">
                        <FormField
                          control={form.control}
                          name={`invoices.${index}.number`}
                          render={({ field }) => (
                            <FormItem className="w-[50%]">
                              <FormControl>
                                <Input placeholder="Enter invoice number" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`invoices.${index}.amount`}
                          render={({ field }) => (
                            <FormItem className="w-[50%]">
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="0.00"
                                  {...field}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => remove(index)}
                          className="w-10 flex-shrink-0 hover:opacity-70 transition-opacity"
                        >
                          <TrashIcon
                            className={`h-5 w-5 ${index === 0 ? 'text-gray-300' : 'text-black'}`}
                          />
                        </button>
                      </div>
                      {index === fields.length - 1 && (
                        <button
                          type="button"
                          onClick={() => append({ number: '', amount: 0 })}
                          className="w-full text-center pt-2 text-sm text-muted-foreground hover:text-black transition-colors flex items-center justify-center gap-2"
                        >
                          <PlusIcon className="h-4 w-4" />
                          Add Another Invoice
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Custom fields from vendor */}
                {vendorDetails.business_details?.customFields?.map((field: any) => (
                  <FormField
                    key={field.key}
                    control={form.control}
                    name={field.key as any}
                    render={({ field: formField }) => (
                      <FormItem>
                        <FormLabel>{field.name}</FormLabel>
                        <FormControl>
                          <Input
                            type={field.type === 'number' ? 'number' : 'text'}
                            placeholder={`Enter ${field.name.toLowerCase()}`}
                            required={field.required}
                            {...formField}
                            onChange={
                              field.type === 'number'
                                ? (e) => formField.onChange(parseFloat(e.target.value))
                                : formField.onChange
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}

                <FormField
                  control={form.control}
                  name="relatedBolAwb"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bill of Lading / AWB Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter BOL/AWB number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="additionalInfo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Additional Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter additional notes"
                          className="min-h-[60px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="rounded-lg bg-muted/50 p-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-medium">Total Amount</h3>
                    <p className="text-lg font-bold">
                      {totalAmount.toFixed(2)} {form.watch('tokenType')}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-6 bg-background mt-auto">
          <Button
            type="submit"
            form="vendor-form"
            className="w-full"
            disabled={isVendorLoading || !selectedVendor}
          >
            Next
          </Button>
        </div>
      </div>
    </Form>
  );
}
