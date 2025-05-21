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
import { Badge } from '@/components/ui/badge';
import { FiChevronDown, FiPlus, FiTrash2, FiCheck } from 'react-icons/fi';
import { CheckCircle, CalendarIcon } from 'lucide-react';
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
import { InvoiceFileUpload } from '@/components/common/InvoiceFileUpload';

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formSchema, setFormSchema] = useState(() => createVendorFormSchema());

  // Filter vendors based on search query
  const filteredVendors = availableVendors.filter((vendor) =>
    vendor.name.toLowerCase().includes(query.toLowerCase()),
  );

  // Check if vendor details is verified (only works with VendorDetails type)
  const isVendorVerified = (vendorDetails: VendorDetails) => {
    return vendorDetails.verification_status === 'verified';
  };

  // Extract custom fields from vendor preferences
  const getCustomFieldsFromPreferences = (vendorDetails: VendorDetails | null) => {
    if (!vendorDetails?.preferences) return [];

    try {
      // Parse preferences if it's a string, otherwise use as object
      const preferences =
        typeof vendorDetails.preferences === 'string'
          ? JSON.parse(vendorDetails.preferences)
          : vendorDetails.preferences;

      return preferences?.customFields || [];
    } catch (error) {
      console.error('Error parsing vendor preferences:', error);
      return [];
    }
  };

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

        // Update the form schema with custom fields from preferences
        const customFields = getCustomFieldsFromPreferences(result.data);
        if (customFields.length > 0) {
          setFormSchema(createVendorFormSchema(customFields));
        } else {
          setFormSchema(createVendorFormSchema());
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
    invoices: [{ number: '', amount: 0, files: [] }],
    tokenType: 'USDC',
    paymentDate: new Date(),
    additionalInfo: '',
  };

  // Initialize form with schema
  const form = useForm<VendorFormValues>({
    resolver: zodResolver(formSchema) as any,
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

      // Handle custom fields from preferences if they exist
      const customFields = getCustomFieldsFromPreferences(vendorDetails);
      customFields.forEach(
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

      // Reset form with new values
      form.reset(newValues);
    }
  }, [vendorDetails, form, selectedVendor]);

  // Handle form submission
  const handleSubmit: SubmitHandler<VendorFormValues> = (data) => {
    setIsSubmitting(true);

    try {
      // Enrich the data with additional context
      const enrichedData: EnrichedVendorFormValues = {
        ...data,
        totalAmount,
        sender: walletAddress,
        receiverDetails: vendorDetails,
      };

      onNext(enrichedData);
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
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
            className="space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control as any}
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
                      <div className="flex items-center justify-between w-full">
                        <h4 className="font-semibold text-sm">{vendorDetails.name || 'NA'}</h4>
                        {isVendorVerified(vendorDetails) && (
                          <Badge
                            variant="secondary"
                            className="bg-green-100 text-green-800 border-green-200 text-xs px-2 py-0.5 flex items-center gap-1"
                          >
                            <CheckCircle className="h-3 w-3" />
                            Verified
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Address: {vendorDetails.primary_address || 'NA'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Phone #: {vendorDetails.business_details?.phone || 'NA'}
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
                  <div className="flex mb-[-12px] gap-4">
                    <div className="w-[30%]">
                      <FormLabel className="text-sm w-full flex">Invoices</FormLabel>
                    </div>
                    <div className="w-[30%]">
                      <FormLabel className="text-sm w-full flex">
                        Amount ({form.watch('tokenType')})
                      </FormLabel>
                    </div>
                    <div className="w-[30%]">
                      <FormLabel className="text-sm">Files</FormLabel>
                    </div>
                    {fields.length > 1 && <div className="w-10" />}
                  </div>

                  {fields.map((field, index) => (
                    <div key={field.id} className="space-y-2">
                      <div className="flex gap-4 w-full items-center">
                        <FormField
                          control={form.control as any}
                          name={`invoices.${index}.number`}
                          render={({ field }) => (
                            <FormItem className="w-[30%]">
                              <FormControl>
                                <Input placeholder="Enter invoice number" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control as any}
                          name={`invoices.${index}.amount`}
                          render={({ field }) => (
                            <FormItem className="w-[30%]">
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

                        <FormField
                          control={form.control as any}
                          name={`invoices.${index}.files`}
                          render={({ field }) => (
                            <FormItem className="w-[30%]">
                              <InvoiceFileUpload
                                files={field.value || []}
                                onFilesChange={(files) =>
                                  form.setValue(`invoices.${index}.files`, files)
                                }
                                disabled={isSubmitting}
                                index={index}
                              />
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
                          onClick={() => append({ number: '', amount: 0, files: [] })}
                          className="w-full text-center pt-2 text-sm text-muted-foreground hover:text-black transition-colors flex items-center justify-center gap-2"
                        >
                          <FiPlus className="h-4 w-4" />
                          Add Another Invoice
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Dynamic custom fields from vendor preferences */}
                {getCustomFieldsFromPreferences(vendorDetails).map(
                  (field: {
                    key: string;
                    name: string;
                    type: string;
                    required: boolean;
                    defaultValue?: any;
                  }) => {
                    const fieldName = field.key as any;

                    return (
                      <FormField
                        key={field.key}
                        control={form.control as any}
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
                  control={form.control as any}
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

                {/* Payment Date and Total Amount Section - styled like old POC */}
                <div className="grid grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="paymentDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-end  flex justify-start  ">
                          Payment Date
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type="date"
                              value={field.value.toISOString().split('T')[0]}
                              disabled
                              className="border-slate-400 text-slate-700 bg-slate-300 cursor-not-allowed"
                            />
                            <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-2">
                    <FormLabel className="text-end flex justify-end">
                      Total Amount ({form.watch('tokenType')})
                    </FormLabel>
                    <Input
                      type="number"
                      value={totalAmount.toFixed(2)}
                      disabled
                      className="border-slate-400 text-slate-700 bg-slate-300 cursor-not-allowed text-end  px-0"
                    />
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
            disabled={isVendorLoading || !selectedVendor || isSubmitting}
          >
            {isSubmitting ? 'Processing...' : 'Next'}
          </Button>
        </div>
      </div>
    </Form>
  );
}
