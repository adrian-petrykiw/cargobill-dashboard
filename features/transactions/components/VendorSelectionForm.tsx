// features/transactions/components/VendorSelectionForm.tsx
import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray, SubmitHandler, DefaultValues } from 'react-hook-form';
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
import { FiChevronDown, FiPlus, FiTrash2, FiCheck } from 'react-icons/fi';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { STABLECOINS, TOKENS } from '@/constants/solana';
import { TokenType } from '@/types/token';
import {
  createVendorFormSchema,
  VendorFormValues,
  EnrichedVendorFormValues,
} from '@/schemas/vendor.schema';
import { VendorDetails, VendorListItem } from '@/schemas/organization.schema';

interface VendorSelectionFormProps {
  walletAddress: string;
  onNext: (data: EnrichedVendorFormValues) => void;
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
  const [vendorDetails, setVendorDetails] = useState<VendorDetails | null>(null);
  const [isVendorLoading, setIsVendorLoading] = useState(false);
  const [formSchema, setFormSchema] = useState(() => createVendorFormSchema());

  // Filter vendors based on search query
  const filteredVendors = availableVendors.filter((vendor) =>
    vendor.name.toLowerCase().includes(query.toLowerCase()),
  );

  // Fetch vendor details when selected
  useEffect(() => {
    async function fetchVendorDetails() {
      if (!selectedVendor) return;

      setIsVendorLoading(true);
      try {
        const response = await fetch(`/api/vendors/${selectedVendor}`);
        if (!response.ok) throw new Error('Failed to fetch vendor details');

        const result = await response.json();

        // Extract the data property from the response
        if (!result.success || !result.data) {
          throw new Error(result.error?.message || 'Failed to fetch vendor details');
        }

        // Set only the data property as vendorDetails
        setVendorDetails(result.data);

        // Update the form schema with custom fields
        if (result.data.business_details?.customFields) {
          setFormSchema(createVendorFormSchema(result.data.business_details.customFields));
        }
      } catch (error) {
        console.error('Error fetching vendor details:', error);
      } finally {
        setIsVendorLoading(false);
      }
    }

    fetchVendorDetails();
  }, [selectedVendor]);

  // Create default values matching the schema
  const defaultValues: DefaultValues<VendorFormValues> = {
    vendor: '',
    invoices: [{ number: '', amount: 0 }],
    tokenType: 'USDC',
    additionalInfo: '',
    relatedBolAwb: '',
  };

  // Initialize form with schema
  const form = useForm<VendorFormValues>({
    resolver: zodResolver(formSchema) as any, // Type assertion to fix resolver type issue
    defaultValues,
  });

  // Setup field array for invoices
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'invoices',
  });

  // Calculate total amount from all invoices
  const totalAmount = form
    .watch('invoices')
    .reduce((sum: number, invoice: any) => sum + (invoice.amount || 0), 0);

  // Reset form when vendor changes
  useEffect(() => {
    if (vendorDetails) {
      // Get current values
      const currentValues = form.getValues();
      const newValues = { ...currentValues, vendor: selectedVendor || '' };

      // Handle custom fields if they exist
      if (vendorDetails.business_details?.customFields) {
        vendorDetails.business_details.customFields.forEach(
          (field: {
            key: string;
            name: string;
            type: string;
            required: boolean;
            defaultValue?: any;
          }) => {
            // Use type assertion to tell TypeScript this is a valid key
            (newValues as any)[field.key] = field.defaultValue || '';
          },
        );
      }

      // Reset form with new values
      form.reset(newValues);
    }
  }, [vendorDetails, form, selectedVendor]);

  // Handle form submission
  const handleSubmit: SubmitHandler<VendorFormValues> = (data) => {
    // Enrich the data with additional context
    const enrichedData: EnrichedVendorFormValues = {
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
          <form
            id="vendor-form"
            onSubmit={form.handleSubmit(handleSubmit as any)}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control as any} // Type assertion to fix control type issue
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
                            className={`w-full justify-between bg-white hover:bg-white/60 ${
                              !field.value && 'text-muted-foreground'
                            }`}
                          >
                            {field.value
                              ? availableVendors.find((vendor) => vendor.id === field.value)?.name
                              : 'Select vendor'}
                            <FiChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
                              {filteredVendors.map((vendor) => (
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
                                  <FiCheck
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

              <Card className="bg-white">
                <CardContent className="px-4 my-0 py-0">
                  {!selectedVendor ? (
                    <div className="text-sm text-muted-foreground justify-center p-4 items-center text-center">
                      Please select a vendor to view details
                    </div>
                  ) : isVendorLoading ? (
                    <div className="space-y-1 p-0 m-0">
                      <Skeleton className="h-[16px] w-[250px] bg-gray-400" />
                      <Skeleton className="h-[14px] w-[200px] bg-gray-400" />
                      <Skeleton className="h-[14px] w-[150px] bg-gray-400" />
                    </div>
                  ) : vendorDetails ? (
                    <div className="p-0 m-0 gap-[2px]">
                      <h4 className="font-semibold text-sm">{vendorDetails.name || 'NA'}</h4>
                      <p className="text-xs text-muted-foreground">
                        Address: {vendorDetails.primary_address || 'NA'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Phone #:{vendorDetails.business_details.phone || 'NA'}
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
                      <FormLabel>Payment Currency</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className={'bg-white hover:bg-white/60'}>
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(STABLECOINS).map(([key]) => (
                            <SelectItem key={key} value={key}>
                              {key}
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
                          control={form.control as any} // Type assertion to fix control type issue
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
                          control={form.control as any} // Type assertion to fix control type issue
                          name={`invoices.${index}.amount`}
                          render={({ field }) => (
                            <FormItem className="w-[50%]">
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="0.00"
                                  value={field.value || ''}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
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
                          <FiTrash2
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
                          <FiPlus className="h-4 w-4" />
                          Add Another Invoice
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Custom fields from vendor */}
                {vendorDetails.business_details?.customFields?.map(
                  (field: {
                    key: string;
                    name: string;
                    type: string;
                    required: boolean;
                    defaultValue?: any;
                  }) => {
                    // We need to cast this to 'any' since the field keys are dynamic
                    const fieldName = field.key as any;

                    return (
                      <FormField
                        key={field.key}
                        control={form.control as any} // Type assertion to fix control type issue
                        name={fieldName}
                        render={({ field: formField }) => (
                          <FormItem>
                            <FormLabel>{field.name}</FormLabel>
                            <FormControl>
                              <Input
                                type={field.type === 'number' ? 'number' : 'text'}
                                placeholder={`Enter ${field.name.toLowerCase()}`}
                                required={field.required}
                                value={formField.value || ''}
                                onChange={
                                  field.type === 'number'
                                    ? (e) => formField.onChange(parseFloat(e.target.value) || 0)
                                    : formField.onChange
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    );
                  },
                )}

                <FormField
                  control={form.control as any} // Type assertion to fix control type issue
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
                  control={form.control as any} // Type assertion to fix control type issue
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
