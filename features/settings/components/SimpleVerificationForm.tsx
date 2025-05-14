// components/settings/SimpleVerificationForm.tsx
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import '@onefootprint/footprint-js/dist/footprint-js.css';
import footprint from '@onefootprint/footprint-js';
import SignatureCanvas from 'react-signature-canvas';

import { kybApi } from '@/services/api/kybApi';
import { useQueryClient } from '@tanstack/react-query';
import { useBusinessVerification } from '@/hooks/useBusinessVerification';
import { toast } from 'react-hot-toast';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';

// Document types for Footprint
export enum DocumentType {
  BUSINESS_FORMATION = 'business_formation',
  BUSINESS_OWNERSHIP = 'business_ownership',
  PROOF_OF_ADDRESS = 'proof_of_address',
  TAX_ID = 'tax_id',
  BENEFICIAL_OWNER_ID = 'beneficial_owner_id',
}

interface SimpleVerificationFormProps {
  organizationId: string;
  organizationName: string;
  organizationEmail?: string;
  organizationCountry?: string; // ISO 3-letter country code: USA, IND, CAN
}

// Base verification schema that applies to all countries
const baseVerificationSchema = z.object({
  businessType: z.string().min(1, 'Business type is required'),
  businessDescription: z.string().min(10, 'Business description is required'),
  // isIntermediary is now hidden and defaulted to 'no'
  isIntermediary: z.literal('no'),
  website: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
  phoneNumber: z.string().min(1, 'Phone number is required'),
  email: z.string().email('Please enter a valid email').optional(),

  // Payments Information
  countriesOfOperation: z.string().min(1, 'Countries of operation are required'),
  countriesOfPayment: z.string().min(1, 'Countries of payment are required'),
  currencies: z.string().min(1, 'Currencies are required'),
  sourceOfFunds: z.string().min(1, 'Source of funds declaration is required'),
  // Changed to enum for dropdown
  estimatedTransactionSize: z.enum([
    'Below $5,000',
    '$5,000-$10,000',
    '$10,000-$100,000',
    '$100,000+',
  ]),
  estimatedAnnualRevenue: z.enum([
    '$0-$99,999',
    '$100,000-$999,999',
    '$1,000,000-$9,999,999',
    '$10,000,000-$49,999,999',
    '$50,000,000-$249,999,999',
    '$250,000,000+',
  ]),

  // Signatory Information
  signatoryName: z.string().min(1, 'Signatory name is required'),
  signatoryTitle: z.string().min(1, 'Signatory title is required'),
  signatoryEmail: z.string().email('Please enter a valid email'),
  signatoryPhone: z.string().min(1, 'Signatory phone is required'),
  signatorySignature: z.string().min(1, 'Signature is required'),

  // Terms Acceptance
  termsAccepted: z.boolean().refine((val) => val === true, {
    message: 'You must accept the terms to continue',
  }),
});

// Country-specific schema extensions
const usaExtensionSchema = z.object({
  registeredAgentAddress: z.string().optional(),
  mailingAddress: z.string().optional(),
});

const indiaExtensionSchema = z.object({
  gstRegistrationNumber: z.string().min(1, 'GST Registration Number is required'),
  panCardNumber: z.string().min(1, 'PAN Card Number is required'),
});

const canadaExtensionSchema = z.object({
  registeredAddress: z.string().optional(),
  regulatoryFines: z.enum(['yes', 'no']),
  civilLitigation: z.enum(['yes', 'no']),
  bankruptcy: z.enum(['yes', 'no']),
});

// Get the appropriate schema based on country
const getVerificationSchema = (country: string) => {
  switch (country) {
    case 'USA':
      return baseVerificationSchema.merge(usaExtensionSchema);
    case 'IND':
      return baseVerificationSchema.merge(indiaExtensionSchema);
    case 'CAN':
      return baseVerificationSchema.merge(canadaExtensionSchema);
    default:
      return baseVerificationSchema;
  }
};

type VerificationFormData = z.infer<typeof baseVerificationSchema> &
  Partial<z.infer<typeof usaExtensionSchema>> &
  Partial<z.infer<typeof indiaExtensionSchema>> &
  Partial<z.infer<typeof canadaExtensionSchema>>;

export default function SimpleVerificationForm({
  organizationId,
  organizationName,
  organizationEmail = '',
  organizationCountry = 'USA', // Default to USA if not provided
}: SimpleVerificationFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [formData, setFormData] = useState<VerificationFormData | null>(null);

  // Signature pad reference
  const signaturePadRef = useRef<SignatureCanvas>(null);
  const [signatureData, setSignatureData] = useState<string>('');
  const [signatureError, setSignatureError] = useState<boolean>(false);

  // Use the simplified business verification hook
  const {
    documentStatus,
    getDocumentToken,
    isGettingDocumentToken,
    getBeneficialOwnerToken,
    isGettingBeneficialOwnerToken,
    initiateVerification,
    isInitiatingVerification,
    updateDocumentStatus,
  } = useBusinessVerification({ organizationId });

  // Get schema based on organization country
  const verificationSchema = getVerificationSchema(organizationCountry);

  // Add country-specific document statuses
  useEffect(() => {
    // All document statuses are already initialized in the hook
  }, [organizationCountry]);

  const form = useForm<VerificationFormData>({
    // Cast the resolver to avoid TypeScript issues
    resolver: zodResolver(verificationSchema as any),
    defaultValues: {
      businessType: '',
      businessDescription: '',
      isIntermediary: 'no', // Default and hidden
      website: '',
      phoneNumber: '',
      email: organizationEmail,
      countriesOfOperation: organizationCountry,
      countriesOfPayment: '',
      currencies: 'USD',
      sourceOfFunds: '',
      estimatedTransactionSize: 'Below $5,000',
      estimatedAnnualRevenue: '$0-$99,999',
      signatoryName: '',
      signatoryTitle: '',
      signatoryEmail: organizationEmail,
      signatoryPhone: '',
      signatorySignature: '',
      termsAccepted: false,
      // Country-specific defaults
      ...(organizationCountry === 'CAN'
        ? {
            regulatoryFines: 'no',
            civilLitigation: 'no',
            bankruptcy: 'no',
          }
        : {}),
    },
  });

  // Function to handle signature pad clear
  const clearSignature = () => {
    if (signaturePadRef.current) {
      signaturePadRef.current.clear();
      setSignatureData('');
      form.setValue('signatorySignature', '');
      setSignatureError(false);
    }
  };

  // Function to capture signature data
  const captureSignature = () => {
    if (signaturePadRef.current && !signaturePadRef.current.isEmpty()) {
      const signatureDataURL = signaturePadRef.current.toDataURL('image/png');
      setSignatureData(signatureDataURL);
      form.setValue('signatorySignature', signatureDataURL);
      setSignatureError(false);
      return signatureDataURL;
    } else {
      setSignatureError(true);
      return '';
    }
  };

  // Check signature on form submission
  const validateSignature = () => {
    if (!signatureData) {
      const newData = captureSignature();
      if (!newData) {
        return false;
      }
    }
    return true;
  };

  const onSubmit = async (data: VerificationFormData) => {
    try {
      setError('');

      // Validate signature
      if (!validateSignature()) {
        setError('Please sign the form before submitting');
        return;
      }

      // Validate required documents based on country
      const requiredDocs = getRequiredDocuments(organizationCountry);
      const missingDocs = requiredDocs.filter((doc) => !documentStatus[doc]);

      if (missingDocs.length > 0) {
        const docNames = missingDocs.map(getDocumentDisplayName).join(', ');
        setError(`Please upload all required documents: ${docNames}`);
        return;
      }

      // Show confirmation dialog with form data
      setFormData(data);
      setShowConfirmation(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
    }
  };

  const handleFinalSubmit = async () => {
    if (!formData) return;

    setIsSubmitting(true);
    setError('');

    try {
      // Upload signature as a document first
      // Convert form data to Footprint-compatible format first
      const footprintData = convertToFootprintFormat(formData, organizationCountry);

      // Handle signature data
      if (signatureData) {
        try {
          // Store signature metadata in the form data
          footprintData['business.signature_provided'] = true;

          // Store the actual signature temporarily in localStorage
          try {
            localStorage.setItem(`${organizationId}_signature`, signatureData);
            console.log('Signature stored locally');
          } catch (e) {
            console.error('Failed to store signature locally:', e);
          }

          // Let the user know the signature is captured
          toast.success('Signature captured successfully');

          // You can optionally create a custom API endpoint to store the signature in Footprint
          // This would be a separate backend endpoint that takes the signature and stores it
          // in the user's vault using Footprint's API
        } catch (err) {
          console.error('Error processing signature:', err);
          // Continue with form submission even if signature storage fails
        }
      }

      console.log('Submitting verification:', {
        organizationId,
        formData: footprintData,
        documentStatus,
      });

      // Submit verification to backend
      const result = await initiateVerification({
        termsAccepted: formData.termsAccepted,
        formData: footprintData,
      });
      // Use sonner
      toast.success(
        'Verification submitted! Your business verification has been submitted for review.',
      );

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['verificationStatus', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['userOrganizations'] });

      // Redirect to dashboard
      router.push(`/dashboard`);
    } catch (err) {
      console.error('Verification submission error:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(`Failed to submit verification: ${errorMessage}`);
      toast.error(`Failed to submit verification: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
      setShowConfirmation(false);
    }
  };

  // Helper function to convert data URL to File object for upload
  const dataURLtoFile = (dataURL: string, filename: string): File => {
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  const uploadDocument = async (documentType: string, documentName: string) => {
    try {
      setError('');
      console.log(`Uploading document: ${documentType}`);

      // Get fields for document type based on country
      const fields = getDocumentFields(documentType, organizationCountry);

      // Get token from backend
      const token = await getDocumentToken({
        documentType,
        fields,
      });

      // Initialize Footprint form
      const component = footprint.init({
        kind: 'form',
        variant: 'modal',
        authToken: token,
        title: `Upload ${documentName}`,
        onComplete: () => {
          updateDocumentStatus(documentType, true);
          toast.success(`${documentName} uploaded successfully`);
        },
        onError: (err: string) => {
          setError(`Failed to upload ${documentName}: ${err}`);
          toast.error(`Failed to upload ${documentName}: ${err}`);
        },
      });

      component.render();
    } catch (err) {
      console.error('Document upload error:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(`Failed to initiate document upload: ${errorMessage}`);
      toast.error(`Failed to initiate document upload: ${errorMessage}`);
    }
  };

  // Helper function to get document display names
  const getDocumentDisplayName = (docType: string): string => {
    const displayNames: Record<string, string> = {
      [DocumentType.BUSINESS_FORMATION]: 'Business Formation Document',
      [DocumentType.BUSINESS_OWNERSHIP]: 'Business Ownership Document',
      [DocumentType.PROOF_OF_ADDRESS]: 'Proof of Business Address',
      [DocumentType.TAX_ID]: 'Tax ID Document',
      ownerIdFront: 'Owner ID (Front)',
      ownerIdBack: 'Owner ID (Back)',
      ownerProofOfAddress: 'Owner Proof of Address',
      companyPanCard: 'Company PAN Card',
      gstCertificate: 'GST Registration Certificate',
      memorandumOfAssociation: 'Memorandum of Association',
      itrDocument: 'Income Tax Return Document',
      shareholderRegistry: 'Shareholder Registry',
      signatory_signature: 'Signatory Signature',
    };

    return displayNames[docType] || docType;
  };

  // Helper function to get required documents based on country
  const getRequiredDocuments = (country: string): string[] => {
    const commonDocs = [
      DocumentType.BUSINESS_FORMATION,
      DocumentType.BUSINESS_OWNERSHIP,
      DocumentType.PROOF_OF_ADDRESS,
      DocumentType.TAX_ID,
      'ownerIdFront',
      'ownerProofOfAddress',
    ];

    switch (country) {
      case 'IND':
        return [
          ...commonDocs,
          'companyPanCard',
          'gstCertificate',
          'memorandumOfAssociation',
          'itrDocument',
        ];
      case 'CAN':
        return [...commonDocs, 'shareholderRegistry'];
      default: // USA
        return commonDocs;
    }
  };

  // Helper function to get document fields based on type and country
  const getDocumentFields = (documentType: string, country: string): string[] => {
    const commonFields: Record<string, string[]> = {
      [DocumentType.BUSINESS_FORMATION]: [
        'business.name',
        'business.formation_date',
        'business.formation_state',
        'business.corporation_type',
        'document.business_formation.front.image',
      ],
      [DocumentType.BUSINESS_OWNERSHIP]: [
        'document.business_ownership.front.image',
        'custom.ownership_structure',
      ],
      [DocumentType.PROOF_OF_ADDRESS]: [
        'business.address_line1',
        'business.address_line2',
        'business.city',
        'business.state',
        'business.zip',
        'business.country',
        'document.proof_of_address.front.image',
      ],
      [DocumentType.TAX_ID]: ['business.tin', 'document.tax_id.front.image'],
      ownerIdFront: [
        'id.first_name',
        'id.last_name',
        'document.drivers_license.front.image',
        'document.passport.front.image',
      ],
      ownerIdBack: ['document.drivers_license.back.image'],
      ownerProofOfAddress: [
        'id.address_line1',
        'id.address_line2',
        'id.city',
        'id.state',
        'id.zip',
        'id.country',
        'document.proof_of_address.front.image',
      ],
      signatory_signature: ['document.signature.front.image'],
    };

    // Country-specific fields
    const countrySpecificFields: Record<string, Record<string, string[]>> = {
      IND: {
        companyPanCard: ['document.pan_card.front.image', 'business.pan'],
        gstCertificate: ['document.gst_certificate.front.image', 'business.gst'],
        memorandumOfAssociation: ['document.memorandum_of_association.front.image'],
        itrDocument: ['document.itr.front.image'],
      },
      CAN: {
        shareholderRegistry: ['document.shareholder_registry.front.image'],
      },
    };

    // If country-specific document, return those fields
    if (country in countrySpecificFields && documentType in countrySpecificFields[country]) {
      return countrySpecificFields[country][documentType];
    }

    // Otherwise return common fields
    return commonFields[documentType] || [];
  };

  // Helper function to convert form data to Footprint format
  const convertToFootprintFormat = (
    data: VerificationFormData,
    country: string,
  ): Record<string, any> => {
    // Base fields that apply to all countries
    const baseFields = {
      'business.name': organizationName,
      'business.type': data.businessType,
      'business.description': data.businessDescription,
      'business.is_intermediary': false, // Always false as per requirements
      'business.website': data.website,
      'business.phone': data.phoneNumber,
      'business.email': data.email || organizationEmail,
      'business.countries_of_operation': data.countriesOfOperation.split(',').map((c) => c.trim()),
      'business.countries_of_payment': data.countriesOfPayment.split(',').map((c) => c.trim()),
      'business.currencies': data.currencies.split(',').map((c) => c.trim()),
      'business.source_of_funds': data.sourceOfFunds,
      'business.estimated_transaction_size': data.estimatedTransactionSize,
      'business.estimated_annual_revenue': data.estimatedAnnualRevenue,
      'business.signatory_name': data.signatoryName,
      'business.signatory_title': data.signatoryTitle,
      'business.signatory_email': data.signatoryEmail,
      'business.signatory_phone': data.signatoryPhone,
      'business.terms_accepted': data.termsAccepted,
    };

    // Country-specific fields
    let countryFields = {};

    if (country === 'USA' && 'registeredAgentAddress' in data) {
      countryFields = {
        'business.registered_agent_address': data.registeredAgentAddress,
        'business.mailing_address': data.mailingAddress,
      };
    } else if (country === 'IND' && 'gstRegistrationNumber' in data) {
      countryFields = {
        'business.gst_registration_number': data.gstRegistrationNumber,
        'business.pan_card_number': data.panCardNumber,
      };
    } else if (country === 'CAN') {
      countryFields = {
        'business.registered_address': data.registeredAddress,
        'business.regulatory_fines': data.regulatoryFines === 'yes',
        'business.civil_litigation': data.civilLitigation === 'yes',
        'business.bankruptcy': data.bankruptcy === 'yes',
      };
    }

    return {
      ...baseFields,
      ...countryFields,
    };
  };

  const renderCountrySpecificFields = () => {
    switch (organizationCountry) {
      case 'USA':
        return (
          <>
            <FormField
              control={form.control}
              name="registeredAgentAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Registered Agent Address (if applicable)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Enter registered agent address" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="mailingAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mailing Address (if different from primary address)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter mailing address or N/A if same as primary"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        );

      case 'IND':
        return (
          <>
            <FormField
              control={form.control}
              name="gstRegistrationNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>GST Registration Number</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter GST registration number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="panCardNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>PAN Card Number</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter PAN card number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        );

      case 'CAN':
        return (
          <>
            <FormField
              control={form.control}
              name="registeredAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Registered Address (if different from primary)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Enter registered address if different" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="regulatoryFines"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Have you, your organization, or any of its officers, directors, key employees,
                    or majority shareholders ever been issued regulatory fines or sanctions?
                  </FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select yes or no" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="civilLitigation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Have you, your organization or any of its officers, directors, key employees or
                    majority shareholders ever been convicted or currently part of any civil
                    litigation?
                  </FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select yes or no" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bankruptcy"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Have you, your organization or any of its officers, directors, key employees,
                    affiliates or majority shareholders ever declared bankruptcy?
                  </FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select yes or no" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        );

      default:
        return null;
    }
  };

  const renderCountrySpecificDocuments = () => {
    switch (organizationCountry) {
      case 'IND':
        return (
          <>
            <Card className="p-4 border border-gray-200">
              <h3 className="font-medium text-lg mb-2">Company PAN Card</h3>
              <p className="text-sm text-gray-600 mb-4">PAN Card for your business entity</p>
              <Button
                variant={documentStatus['companyPanCard'] ? 'outline' : 'default'}
                onClick={() => uploadDocument('companyPanCard', 'Company PAN Card')}
                className="w-full"
              >
                {documentStatus['companyPanCard'] ? '✓ Uploaded' : 'Upload Document'}
              </Button>
            </Card>

            <Card className="p-4 border border-gray-200">
              <h3 className="font-medium text-lg mb-2">GST Registration Certificate</h3>
              <p className="text-sm text-gray-600 mb-4">
                GST Registration Certificate for your business
              </p>
              <Button
                variant={documentStatus['gstCertificate'] ? 'outline' : 'default'}
                onClick={() => uploadDocument('gstCertificate', 'GST Registration Certificate')}
                className="w-full"
              >
                {documentStatus['gstCertificate'] ? '✓ Uploaded' : 'Upload Document'}
              </Button>
            </Card>

            <Card className="p-4 border border-gray-200">
              <h3 className="font-medium text-lg mb-2">Memorandum of Association</h3>
              <p className="text-sm text-gray-600 mb-4">
                Company Memorandum of Association & Articles of Association
              </p>
              <Button
                variant={documentStatus['memorandumOfAssociation'] ? 'outline' : 'default'}
                onClick={() =>
                  uploadDocument('memorandumOfAssociation', 'Memorandum of Association')
                }
                className="w-full"
              >
                {documentStatus['memorandumOfAssociation'] ? '✓ Uploaded' : 'Upload Document'}
              </Button>
            </Card>

            <Card className="p-4 border border-gray-200">
              <h3 className="font-medium text-lg mb-2">Income Tax Return (ITR) Document</h3>
              <p className="text-sm text-gray-600 mb-4">Most recent Income Tax Return document</p>
              <Button
                variant={documentStatus['itrDocument'] ? 'outline' : 'default'}
                onClick={() => uploadDocument('itrDocument', 'ITR Document')}
                className="w-full"
              >
                {documentStatus['itrDocument'] ? '✓ Uploaded' : 'Upload Document'}
              </Button>
            </Card>
          </>
        );

      case 'CAN':
        return (
          <Card className="p-4 border border-gray-200">
            <h3 className="font-medium text-lg mb-2">Shareholder Registry</h3>
            <p className="text-sm text-gray-600 mb-4">
              Self-certified shareholders registry (issued within last 6 months)
            </p>
            <Button
              variant={documentStatus['shareholderRegistry'] ? 'outline' : 'default'}
              onClick={() => uploadDocument('shareholderRegistry', 'Shareholder Registry')}
              className="w-full"
            >
              {documentStatus['shareholderRegistry'] ? '✓ Uploaded' : 'Upload Document'}
            </Button>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Business Verification</h1>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* Business Information Section */}
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-xl font-semibold mb-4">Business Information</h2>
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-medium text-gray-500">Legal Name:</h3>
                  <p className="font-medium">{organizationName}</p>
                </div>

                <FormField
                  control={form.control}
                  name="businessType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select business type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="freight_forwarder">Freight Forwarder</SelectItem>
                          <SelectItem value="manufacturer">Manufacturer</SelectItem>
                          <SelectItem value="seller">
                            Seller (Physical Consumer or Enterprise Goods)
                          </SelectItem>
                          <SelectItem value="fulfillment">Fulfillment Provider</SelectItem>
                          <SelectItem value="customs">Customs Office</SelectItem>
                          <SelectItem value="warehouse">Warehouse</SelectItem>
                          <SelectItem value="shipping_line">Shipping Line</SelectItem>
                          <SelectItem value="ocean_carrier">Ocean Carrier</SelectItem>
                          <SelectItem value="rail">Rail Transport</SelectItem>
                          <SelectItem value="truck">Truck Transport</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="businessDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Detailed description of your business activities"
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Website</FormLabel>
                      <FormControl>
                        <Input placeholder="https://example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Phone Number</FormLabel>
                      <FormControl>
                        <Input placeholder="+12345678900" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Email</FormLabel>
                      <FormControl>
                        <Input
                          value={organizationEmail}
                          disabled
                          className="bg-gray-50 cursor-not-allowed"
                          onChange={() => {}}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Country-specific fields */}
                {renderCountrySpecificFields()}
              </div>
            </CardContent>
          </Card>

          {/* Document Upload Section */}
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-xl font-semibold mb-4">Business Documents</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="p-4 border border-gray-200">
                    <h3 className="font-medium text-lg mb-2">Business Formation Document</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Certificate of Incorporation or Articles of Organization
                    </p>
                    <Button
                      variant={
                        documentStatus[DocumentType.BUSINESS_FORMATION] ? 'outline' : 'default'
                      }
                      onClick={() =>
                        uploadDocument(
                          DocumentType.BUSINESS_FORMATION,
                          'Business Formation Document',
                        )
                      }
                      className="w-full"
                    >
                      {documentStatus[DocumentType.BUSINESS_FORMATION]
                        ? '✓ Uploaded'
                        : 'Upload Document'}
                    </Button>
                  </Card>

                  <Card className="p-4 border border-gray-200">
                    <h3 className="font-medium text-lg mb-2">Business Ownership Document</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Documentation showing your business ownership structure
                    </p>
                    <Button
                      variant={
                        documentStatus[DocumentType.BUSINESS_OWNERSHIP] ? 'outline' : 'default'
                      }
                      onClick={() =>
                        uploadDocument(
                          DocumentType.BUSINESS_OWNERSHIP,
                          'Business Ownership Document',
                        )
                      }
                      className="w-full"
                    >
                      {documentStatus[DocumentType.BUSINESS_OWNERSHIP]
                        ? '✓ Uploaded'
                        : 'Upload Document'}
                    </Button>
                  </Card>

                  <Card className="p-4 border border-gray-200">
                    <h3 className="font-medium text-lg mb-2">Proof of Business Address</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Utility bill, lease agreement, or similar document
                    </p>
                    <Button
                      variant={
                        documentStatus[DocumentType.PROOF_OF_ADDRESS] ? 'outline' : 'default'
                      }
                      onClick={() =>
                        uploadDocument(DocumentType.PROOF_OF_ADDRESS, 'Proof of Address')
                      }
                      className="w-full"
                    >
                      {documentStatus[DocumentType.PROOF_OF_ADDRESS]
                        ? '✓ Uploaded'
                        : 'Upload Document'}
                    </Button>
                  </Card>

                  <Card className="p-4 border border-gray-200">
                    <h3 className="font-medium text-lg mb-2">Tax ID Document</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      {organizationCountry === 'USA'
                        ? 'EIN letter from the IRS'
                        : organizationCountry === 'IND'
                          ? 'PAN Card'
                          : 'Tax documentation'}
                    </p>
                    <Button
                      variant={documentStatus[DocumentType.TAX_ID] ? 'outline' : 'default'}
                      onClick={() => uploadDocument(DocumentType.TAX_ID, 'Tax ID Document')}
                      className="w-full"
                    >
                      {documentStatus[DocumentType.TAX_ID] ? '✓ Uploaded' : 'Upload Document'}
                    </Button>
                  </Card>

                  {/* Country-specific documents */}
                  {renderCountrySpecificDocuments()}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Owner Documents Section */}
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-xl font-semibold mb-4">Beneficial Owner Information</h2>
              <p className="text-sm text-gray-500 mb-4">
                Please provide documentation for at least one beneficial owner with 25% or more
                ownership.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 border border-gray-200">
                  <h3 className="font-medium text-lg mb-2">Owner ID (Front)</h3>
                  <p className="text-sm text-gray-600 mb-4">Driver's license or passport</p>
                  <Button
                    variant={documentStatus['ownerIdFront'] ? 'outline' : 'default'}
                    onClick={() => uploadDocument('ownerIdFront', 'Owner ID (Front)')}
                    className="w-full"
                  >
                    {documentStatus['ownerIdFront'] ? '✓ Uploaded' : 'Upload Document'}
                  </Button>
                </Card>

                <Card className="p-4 border border-gray-200">
                  <h3 className="font-medium text-lg mb-2">Owner ID (Back)</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Driver's license back (if applicable)
                  </p>
                  <Button
                    variant={documentStatus['ownerIdBack'] ? 'outline' : 'default'}
                    onClick={() => uploadDocument('ownerIdBack', 'Owner ID (Back)')}
                    className="w-full"
                  >
                    {documentStatus['ownerIdBack'] ? '✓ Uploaded' : 'Upload Document'}
                  </Button>
                </Card>

                <Card className="p-4 border border-gray-200">
                  <h3 className="font-medium text-lg mb-2">Owner Proof of Address</h3>
                  <p className="text-sm text-gray-600 mb-4">Utility bill or bank statement</p>
                  <Button
                    variant={documentStatus['ownerProofOfAddress'] ? 'outline' : 'default'}
                    onClick={() => uploadDocument('ownerProofOfAddress', 'Owner Proof of Address')}
                    className="w-full"
                  >
                    {documentStatus['ownerProofOfAddress'] ? '✓ Uploaded' : 'Upload Document'}
                  </Button>
                </Card>
              </div>
            </CardContent>
          </Card>

          {/* Payments Information Section */}
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-xl font-semibold mb-4">Payments Information</h2>
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="countriesOfOperation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Countries of Operation</FormLabel>
                      <FormControl>
                        <Input placeholder="US, Canada, Mexico" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="countriesOfPayment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Countries Where You'll Make Payments</FormLabel>
                      <FormControl>
                        <Input placeholder="US, China, India" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="currencies"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currencies You Conduct Business In</FormLabel>
                      <FormControl>
                        <Input placeholder="USD, EUR, CNY" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sourceOfFunds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source of Funds Declaration</FormLabel>
                      <FormControl>
                        <Input placeholder="Business operations, investments, etc." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="estimatedTransactionSize"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Average Transaction Size (USD)</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select transaction size range" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Below $5,000">Below $5,000</SelectItem>
                          <SelectItem value="$5,000-$10,000">$5,000-$10,000</SelectItem>
                          <SelectItem value="$10,000-$100,000">$10,000-$100,000</SelectItem>
                          <SelectItem value="$100,000+">$100,000+</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="estimatedAnnualRevenue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estimated Annual Revenue</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select revenue range" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="$0-$99,999">$0-$99,999</SelectItem>
                          <SelectItem value="$100,000-$999,999">$100,000-$999,999</SelectItem>
                          <SelectItem value="$1,000,000-$9,999,999">
                            $1,000,000-$9,999,999
                          </SelectItem>
                          <SelectItem value="$10,000,000-$49,999,999">
                            $10,000,000-$49,999,999
                          </SelectItem>
                          <SelectItem value="$50,000,000-$249,999,999">
                            $50,000,000-$249,999,999
                          </SelectItem>
                          <SelectItem value="$250,000,000+">$250,000,000+</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Signatory Information Section */}
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-xl font-semibold mb-4">Authorized Signatory Information</h2>
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="signatoryName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Signatory Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter your full legal name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="signatoryTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Signatory Title/Position</FormLabel>
                      <FormControl>
                        <Input placeholder="CEO, CFO, etc." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="signatoryEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Signatory Email</FormLabel>
                      <FormControl>
                        <Input
                          value={organizationEmail}
                          disabled
                          className="bg-gray-50 cursor-not-allowed"
                          onChange={() => {}} // No-op onChange to avoid React warnings
                        />
                      </FormControl>
                      <p className="text-xs text-gray-500 mt-1">
                        This field is automatically filled with your account email and cannot be
                        changed.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="signatoryPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Signatory Phone Number</FormLabel>
                      <FormControl>
                        <Input placeholder="+1 (XXX) XXX XXXX" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="signatorySignature"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Signature</FormLabel>
                      <div className="mt-2">
                        <div
                          className={`border rounded-md p-2 ${
                            signatureError ? 'border-red-500' : 'border-gray-200'
                          }`}
                        >
                          <div className="bg-gray-50 rounded-md mb-2">
                            <SignatureCanvas
                              ref={signaturePadRef}
                              canvasProps={{
                                width: '100%',
                                height: 200,
                                className: 'signature-canvas',
                              }}
                              backgroundColor="rgba(247, 248, 249, 1)"
                              onEnd={() => captureSignature()}
                            />
                          </div>
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={clearSignature}
                              size="sm"
                            >
                              Clear
                            </Button>
                          </div>
                        </div>
                        {signatureError && (
                          <p className="text-sm font-medium text-red-500 mt-1">
                            Please sign before submitting
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          Draw your signature above. This will be saved as an official document.
                        </p>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Terms and Submission Section - Simplified */}
          <div className="pt-6 pb-6 border-t border-gray-200">
            <FormField
              control={form.control}
              name="termsAccepted"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 rounded-md bg-gray-50">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="text-sm">
                      I acknowledge and confirm that I am the authorized signatory for{' '}
                      {organizationName} and that, to the best of my knowledge, all information and
                      documents provided in this application are true, accurate, and complete. I
                      accept the{' '}
                      <a
                        href="/terms"
                        target="_blank"
                        className="text-blue-600 hover:underline font-medium"
                      >
                        Terms of Service
                      </a>{' '}
                      and{' '}
                      <a
                        href="/privacy"
                        target="_blank"
                        className="text-blue-600 hover:underline font-medium"
                      >
                        Privacy Policy
                      </a>
                      .
                    </FormLabel>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />

            <div className="pt-6">
              <Button type="submit" className="w-full">
                Submit Verification
              </Button>
            </div>
          </div>
        </form>
      </Form>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Verification Submission</DialogTitle>
            <DialogDescription>
              Please review your information before final submission
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto py-4">
            <h3 className="font-semibold mb-2">Business Information</h3>
            <ul className="space-y-1 mb-4 text-sm">
              <li>
                <span className="font-medium">Legal Name:</span> {organizationName}
              </li>
              <li>
                <span className="font-medium">Business Type:</span> {formData?.businessType}
              </li>
              <li>
                <span className="font-medium">Description:</span> {formData?.businessDescription}
              </li>
              <li>
                <span className="font-medium">Website:</span> {formData?.website}
              </li>
              <li>
                <span className="font-medium">Phone:</span> {formData?.phoneNumber}
              </li>

              {/* Country-specific fields in confirmation */}
              {organizationCountry === 'USA' && formData?.registeredAgentAddress && (
                <li>
                  <span className="font-medium">Registered Agent Address:</span>{' '}
                  {formData.registeredAgentAddress}
                </li>
              )}
              {organizationCountry === 'IND' && formData?.gstRegistrationNumber && (
                <li>
                  <span className="font-medium">GST Registration Number:</span>{' '}
                  {formData.gstRegistrationNumber}
                </li>
              )}
              {organizationCountry === 'CAN' && formData?.regulatoryFines && (
                <li>
                  <span className="font-medium">Regulatory Fines:</span> {formData.regulatoryFines}
                </li>
              )}
            </ul>

            <h3 className="font-semibold mb-2">Payments Information</h3>
            <ul className="space-y-1 mb-4 text-sm">
              <li>
                <span className="font-medium">Operating Countries:</span>{' '}
                {formData?.countriesOfOperation}
              </li>
              <li>
                <span className="font-medium">Payment Countries:</span>{' '}
                {formData?.countriesOfPayment}
              </li>
              <li>
                <span className="font-medium">Currencies:</span> {formData?.currencies}
              </li>
              <li>
                <span className="font-medium">Avg. Transaction Size:</span>{' '}
                {formData?.estimatedTransactionSize}
              </li>
              <li>
                <span className="font-medium">Annual Revenue:</span>{' '}
                {formData?.estimatedAnnualRevenue}
              </li>
            </ul>

            <h3 className="font-semibold mb-2">Signatory Information</h3>
            <ul className="space-y-1 mb-4 text-sm">
              <li>
                <span className="font-medium">Name:</span> {formData?.signatoryName}
              </li>
              <li>
                <span className="font-medium">Title:</span> {formData?.signatoryTitle}
              </li>
              <li>
                <span className="font-medium">Email:</span> {formData?.signatoryEmail}
              </li>
              <li>
                <span className="font-medium">Phone:</span> {formData?.signatoryPhone}
              </li>
            </ul>

            <h3 className="font-semibold mb-2">Uploaded Documents</h3>
            <ul className="space-y-1 text-sm">
              {getRequiredDocuments(organizationCountry).map((docType) => (
                <li key={docType}>
                  <span className="font-medium">{getDocumentDisplayName(docType)}:</span>
                  {documentStatus[docType] ? '✓ Uploaded' : '❌ Missing'}
                </li>
              ))}
            </ul>

            {signatureData && (
              <div className="mt-4">
                <h3 className="font-semibold mb-2">Your Signature</h3>
                <div className="border border-gray-200 p-2 rounded-md">
                  <img src={signatureData} alt="Signature" className="max-w-full h-auto" />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmation(false)}>
              Go Back
            </Button>
            <Button onClick={handleFinalSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit Verification'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add styles for the signature canvas */}
      <style jsx global>{`
        .signature-canvas {
          width: 100%;
          height: 200px;
          border-radius: 0.25rem;
        }
      `}</style>
    </div>
  );
}
