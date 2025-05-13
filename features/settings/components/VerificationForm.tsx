// // components/organization/VerificationForm.tsx
// import { useState } from 'react';
// import { useRouter } from 'next/router';
// import { useForm } from 'react-hook-form';
// import { zodResolver } from '@hookform/resolvers/zod';
// import '@onefootprint/footprint-js/dist/footprint-js.css';
// import footprint from '@onefootprint/footprint-js';

// import {
//   businessBasicInfoSchema,
//   BusinessBasicInfoFormData,
//   DocumentType,
// } from '@/schemas/kyb.schema';
// import { useBusinessVerification } from '@/hooks/useBusinessVerification';

// import { Button } from '@/components/ui/button';
// import { Input } from '@/components/ui/input';
// import { Card } from '@/components/ui/card';
// import { Alert, AlertDescription } from '@/components/ui/alert';
// import {
//   Form,
//   FormControl,
//   FormField,
//   FormItem,
//   FormLabel,
//   FormMessage,
// } from '@/components/ui/form';
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from '@/components/ui/select';
// import { Steps, Step } from '@/components/Steps';

// interface VerificationFormProps {
//   organizationId: string;
// }

// export default function VerificationForm({ organizationId }: VerificationFormProps) {
//   const router = useRouter();
//   const [error, setError] = useState<string>('');
//   const [termsAccepted, setTermsAccepted] = useState<boolean>(false);

//   const {
//     // State
//     currentStep,
//     documentStatus,
//     ownersCount,
//     ownersStatus,

//     // Mutations
//     saveBasicInfo,
//     isSavingBasicInfo,

//     getDocumentToken,
//     isGettingDocumentToken,

//     getBeneficialOwnerToken,
//     isGettingBeneficialOwnerToken,

//     initiateVerification,
//     isInitiatingVerification,

//     // Helper methods
//     setCurrentStep,
//     updateDocumentStatus,
//     updateOwnerStatus,
//     updateOwnersCount,
//     isDocumentsStepComplete,
//     isOwnersStepComplete,
//   } = useBusinessVerification({ organizationId });

//   const form = useForm<BusinessBasicInfoFormData>({
//     resolver: zodResolver(businessBasicInfoSchema),
//     defaultValues: {
//       name: '',
//       businessType: '',
//       businessDescription: '',
//       isIntermediary: 'no',
//       website: '',
//       phoneNumber: '',
//       email: '',
//       countriesOfOperation: [],
//     },
//   });

//   const steps = [
//     { title: 'Basic Information', description: 'Organization details' },
//     { title: 'Business Documents', description: 'Formation, ownership and address' },
//     { title: 'Beneficial Owners', description: 'Owners with 25% or more' },
//     { title: 'Review & Submit', description: 'Complete KYB process' },
//   ];

//   const handleBasicInfoSubmit = async (values: BusinessBasicInfoFormData) => {
//     try {
//       setError('');
//       await saveBasicInfo(values);
//     } catch (err) {
//       const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
//       setError(errorMessage);
//     }
//   };

//   const uploadDocument = async (documentType: DocumentType, documentName: string) => {
//     try {
//       setError('');

//       // Get fields for document type
//       const fields = getFieldsForDocumentType(documentType);

//       // Get token from backend
//       const token = await getDocumentToken({
//         documentType,
//         fields,
//       });

//       // Initialize Footprint form
//       const component = footprint.init({
//         kind: 'form',
//         variant: 'modal',
//         authToken: token,
//         onComplete: () => {
//           updateDocumentStatus(documentType, true);
//         },
//         onError: (err: string) => {
//           setError(`Failed to upload ${documentName}: ${err}`);
//         },
//         title: `Upload ${documentName}`,
//       });

//       component.render();
//     } catch (err) {
//       const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
//       setError(errorMessage);
//     }
//   };

//   const uploadBeneficialOwnerDocuments = async (ownerIndex: number) => {
//     try {
//       setError('');

//       // Get token for beneficial owner
//       const token = await getBeneficialOwnerToken({
//         ownerIndex,
//         fields: [
//           'id.first_name',
//           'id.last_name',
//           'id.dob',
//           'id.email',
//           'id.phone_number',
//           'id.ssn9', // For US owners
//           'id.address_line1',
//           'id.address_line2',
//           'id.city',
//           'id.state',
//           'id.zip',
//           'id.country',
//           'document.drivers_license.front.image',
//           'document.drivers_license.back.image',
//           'document.passport.front.image',
//           'custom.ownership_percentage',
//           'custom.employment_status',
//           'custom.occupation',
//         ],
//       });

//       // Initialize Footprint form
//       const component = footprint.init({
//         kind: 'form',
//         variant: 'modal',
//         authToken: token,
//         onComplete: () => {
//           updateOwnerStatus(ownerIndex, true);
//         },
//         onError: (err: string) => {
//           setError(`Failed to upload beneficial owner information: ${err}`);
//         },
//         title: `Beneficial Owner ${ownerIndex + 1} Information`,
//       });

//       component.render();
//     } catch (err) {
//       const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
//       setError(errorMessage);
//     }
//   };

//   const handleInitiateVerification = async () => {
//     try {
//       setError('');

//       if (!termsAccepted) {
//         setError('You must accept the terms and conditions to proceed');
//         return;
//       }

//       // Call API to start KYB verification
//       //   await initiateVerification(termsAccepted);

//       // Redirect to status page
//       router.push(`/organizations/${organizationId}/verification-status`);
//     } catch (err) {
//       const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
//       setError(errorMessage);
//     }
//   };

//   // Helper function to determine fields based on document type
//   const getFieldsForDocumentType = (documentType: DocumentType): string[] => {
//     switch (documentType) {
//       case DocumentType.BUSINESS_FORMATION:
//         return [
//           'business.name',
//           'business.formation_date',
//           'business.formation_state',
//           'business.corporation_type',
//           'document.business_formation.front.image',
//         ];
//       case DocumentType.BUSINESS_OWNERSHIP:
//         return ['document.business_ownership.front.image', 'custom.ownership_structure'];
//       case DocumentType.PROOF_OF_ADDRESS:
//         return [
//           'business.address_line1',
//           'business.address_line2',
//           'business.city',
//           'business.state',
//           'business.zip',
//           'business.country',
//           'document.proof_of_address.front.image',
//         ];
//       case DocumentType.TAX_ID:
//         return ['business.tin', 'document.tax_id.front.image'];
//       default:
//         return [];
//     }
//   };

//   const renderCurrentStep = () => {
//     switch (currentStep) {
//       case 0:
//         return (
//           <Form {...form}>
//             <form onSubmit={form.handleSubmit(handleBasicInfoSubmit)} className="space-y-4">
//               <FormField
//                 control={form.control}
//                 name="name"
//                 render={({ field }) => (
//                   <FormItem>
//                     <FormLabel>Business Legal Name</FormLabel>
//                     <FormControl>
//                       <Input
//                         placeholder="Legal name as it appears on formation documents"
//                         {...field}
//                       />
//                     </FormControl>
//                     <FormMessage />
//                   </FormItem>
//                 )}
//               />

//               <FormField
//                 control={form.control}
//                 name="businessType"
//                 render={({ field }) => (
//                   <FormItem>
//                     <FormLabel>Business Type</FormLabel>
//                     <Select onValueChange={field.onChange} defaultValue={field.value}>
//                       <FormControl>
//                         <SelectTrigger>
//                           <SelectValue placeholder="Select business type" />
//                         </SelectTrigger>
//                       </FormControl>
//                       <SelectContent>
//                         <SelectItem value="freight_forwarder">Freight Forwarder</SelectItem>
//                         <SelectItem value="manufacturer">Manufacturer</SelectItem>
//                         <SelectItem value="seller">
//                           Seller (Physical Consumer or Enterprise Goods)
//                         </SelectItem>
//                         <SelectItem value="fulfillment">Fulfillment Provider</SelectItem>
//                         <SelectItem value="customs">Customs Office</SelectItem>
//                         <SelectItem value="warehouse">Warehouse</SelectItem>
//                         <SelectItem value="shipping_line">Shipping Line</SelectItem>
//                         <SelectItem value="ocean_carrier">Ocean Carrier</SelectItem>
//                         <SelectItem value="rail">Rail Transport</SelectItem>
//                         <SelectItem value="truck">Truck Transport</SelectItem>
//                         <SelectItem value="other">Other</SelectItem>
//                       </SelectContent>
//                     </Select>
//                     <FormMessage />
//                   </FormItem>
//                 )}
//               />

//               <FormField
//                 control={form.control}
//                 name="businessDescription"
//                 render={({ field }) => (
//                   <FormItem>
//                     <FormLabel>Business Description</FormLabel>
//                     <FormControl>
//                       <Input
//                         placeholder="Detailed description of your business activities"
//                         {...field}
//                       />
//                     </FormControl>
//                     <FormMessage />
//                   </FormItem>
//                 )}
//               />

//               <FormField
//                 control={form.control}
//                 name="isIntermediary"
//                 render={({ field }) => (
//                   <FormItem>
//                     <FormLabel>Is your business acting as an intermediary?</FormLabel>
//                     <Select onValueChange={field.onChange} defaultValue={field.value}>
//                       <FormControl>
//                         <SelectTrigger>
//                           <SelectValue placeholder="Select yes or no" />
//                         </SelectTrigger>
//                       </FormControl>
//                       <SelectContent>
//                         <SelectItem value="yes">Yes</SelectItem>
//                         <SelectItem value="no">No</SelectItem>
//                       </SelectContent>
//                     </Select>
//                     <FormMessage />
//                   </FormItem>
//                 )}
//               />

//               <FormField
//                 control={form.control}
//                 name="website"
//                 render={({ field }) => (
//                   <FormItem>
//                     <FormLabel>Business Website</FormLabel>
//                     <FormControl>
//                       <Input placeholder="https://example.com" {...field} />
//                     </FormControl>
//                     <FormMessage />
//                   </FormItem>
//                 )}
//               />

//               <FormField
//                 control={form.control}
//                 name="phoneNumber"
//                 render={({ field }) => (
//                   <FormItem>
//                     <FormLabel>Business Phone Number</FormLabel>
//                     <FormControl>
//                       <Input placeholder="+12345678900" {...field} />
//                     </FormControl>
//                     <FormMessage />
//                   </FormItem>
//                 )}
//               />

//               <FormField
//                 control={form.control}
//                 name="email"
//                 render={({ field }) => (
//                   <FormItem>
//                     <FormLabel>Business Email Address</FormLabel>
//                     <FormControl>
//                       <Input placeholder="business@example.com" {...field} />
//                     </FormControl>
//                     <FormMessage />
//                   </FormItem>
//                 )}
//               />

//               <FormField
//                 control={form.control}
//                 name="countriesOfOperation"
//                 render={({ field }) => (
//                   <FormItem>
//                     <FormLabel>Countries of Operation</FormLabel>
//                     <Select
//                       onValueChange={(value) => {
//                         field.onChange([...field.value, value]);
//                       }}
//                     >
//                       <FormControl>
//                         <SelectTrigger>
//                           <SelectValue placeholder="Select countries" />
//                         </SelectTrigger>
//                       </FormControl>
//                       <SelectContent>
//                         <SelectItem value="US">United States</SelectItem>
//                         <SelectItem value="CA">Canada</SelectItem>
//                         <SelectItem value="MX">Mexico</SelectItem>
//                         <SelectItem value="UK">United Kingdom</SelectItem>
//                         <SelectItem value="CN">China</SelectItem>
//                         <SelectItem value="JP">Japan</SelectItem>
//                         {/* Add more countries as needed */}
//                       </SelectContent>
//                     </Select>
//                     <div className="flex flex-wrap gap-2 mt-2">
//                       {field.value.map((country, index) => (
//                         <div
//                           key={index}
//                           className="bg-blue-100 text-blue-800 px-2 py-1 rounded-md flex items-center text-sm"
//                         >
//                           {country}
//                           <button
//                             type="button"
//                             className="ml-1 text-blue-800 hover:text-blue-900"
//                             onClick={() => {
//                               const newValues = [...field.value];
//                               newValues.splice(index, 1);
//                               field.onChange(newValues);
//                             }}
//                           >
//                             ×
//                           </button>
//                         </div>
//                       ))}
//                     </div>
//                     <FormMessage />
//                   </FormItem>
//                 )}
//               />

//               <Button type="submit" disabled={isSavingBasicInfo}>
//                 {isSavingBasicInfo ? 'Saving...' : 'Continue'}
//               </Button>
//             </form>
//           </Form>
//         );

//       case 1:
//         return (
//           <div className="space-y-6">
//             <Alert>
//               <AlertDescription>
//                 These documents will be securely stored and never shared without your consent.
//               </AlertDescription>
//             </Alert>

//             <Card className="p-6">
//               <h3 className="font-medium text-lg mb-2">Business Formation Document</h3>
//               <p className="text-sm text-gray-600 mb-4">
//                 Please provide your Certificate of Incorporation or Articles of Organization.
//               </p>
//               <Button
//                 variant={documentStatus[DocumentType.BUSINESS_FORMATION] ? 'outline' : 'default'}
//                 onClick={() =>
//                   uploadDocument(DocumentType.BUSINESS_FORMATION, 'Business Formation Document')
//                 }
//                 disabled={isGettingDocumentToken || documentStatus[DocumentType.BUSINESS_FORMATION]}
//               >
//                 {documentStatus[DocumentType.BUSINESS_FORMATION] ? '✓ Uploaded' : 'Upload Document'}
//               </Button>
//             </Card>

//             <Card className="p-6">
//               <h3 className="font-medium text-lg mb-2">Business Ownership Document</h3>
//               <p className="text-sm text-gray-600 mb-4">
//                 Please provide documentation showing your business ownership structure.
//               </p>
//               <Button
//                 variant={documentStatus[DocumentType.BUSINESS_OWNERSHIP] ? 'outline' : 'default'}
//                 onClick={() =>
//                   uploadDocument(DocumentType.BUSINESS_OWNERSHIP, 'Business Ownership Document')
//                 }
//                 disabled={isGettingDocumentToken || documentStatus[DocumentType.BUSINESS_OWNERSHIP]}
//               >
//                 {documentStatus[DocumentType.BUSINESS_OWNERSHIP] ? '✓ Uploaded' : 'Upload Document'}
//               </Button>
//             </Card>

//             <Card className="p-6">
//               <h3 className="font-medium text-lg mb-2">Proof of Business Address</h3>
//               <p className="text-sm text-gray-600 mb-4">
//                 Please provide a utility bill, lease agreement, or other document proving your
//                 business address.
//               </p>
//               <Button
//                 variant={documentStatus[DocumentType.PROOF_OF_ADDRESS] ? 'outline' : 'default'}
//                 onClick={() => uploadDocument(DocumentType.PROOF_OF_ADDRESS, 'Proof of Address')}
//                 disabled={isGettingDocumentToken || documentStatus[DocumentType.PROOF_OF_ADDRESS]}
//               >
//                 {documentStatus[DocumentType.PROOF_OF_ADDRESS] ? '✓ Uploaded' : 'Upload Document'}
//               </Button>
//             </Card>

//             <Card className="p-6">
//               <h3 className="font-medium text-lg mb-2">Tax ID Document</h3>
//               <p className="text-sm text-gray-600 mb-4">
//                 Please provide your EIN letter from the IRS or other tax ID document.
//               </p>
//               <Button
//                 variant={documentStatus[DocumentType.TAX_ID] ? 'outline' : 'default'}
//                 onClick={() => uploadDocument(DocumentType.TAX_ID, 'Tax ID Document')}
//                 disabled={isGettingDocumentToken || documentStatus[DocumentType.TAX_ID]}
//               >
//                 {documentStatus[DocumentType.TAX_ID] ? '✓ Uploaded' : 'Upload Document'}
//               </Button>
//             </Card>

//             <div className="flex justify-between">
//               <Button variant="outline" onClick={() => setCurrentStep(0)}>
//                 Back
//               </Button>
//               <Button onClick={() => setCurrentStep(2)} disabled={!isDocumentsStepComplete()}>
//                 Continue
//               </Button>
//             </div>
//           </div>
//         );

//       case 2:
//         return (
//           <div className="space-y-6">
//             <Alert>
//               <AlertDescription>
//                 Please provide information for all individuals who own 25% or more of the business.
//               </AlertDescription>
//             </Alert>

//             <div className="mb-4">
//               <FormLabel>Number of Beneficial Owners (25% or more):</FormLabel>
//               <Select
//                 value={ownersCount.toString()}
//                 onValueChange={(value) => updateOwnersCount(parseInt(value))}
//               >
//                 <SelectTrigger className="w-full">
//                   <SelectValue placeholder="Select number of owners" />
//                 </SelectTrigger>
//                 <SelectContent>
//                   <SelectItem value="1">1 Owner</SelectItem>
//                   <SelectItem value="2">2 Owners</SelectItem>
//                   <SelectItem value="3">3 Owners</SelectItem>
//                   <SelectItem value="4">4 Owners</SelectItem>
//                   <SelectItem value="5">5+ Owners</SelectItem>
//                 </SelectContent>
//               </Select>
//             </div>

//             {Array.from({ length: ownersCount }).map((_, index) => (
//               <Card key={index} className="p-6">
//                 <h3 className="font-medium text-lg mb-2">Beneficial Owner {index + 1}</h3>
//                 <p className="text-sm text-gray-600 mb-4">
//                   Please provide information and identification for this beneficial owner.
//                 </p>
//                 <Button
//                   variant={ownersStatus[index] ? 'outline' : 'default'}
//                   onClick={() => uploadBeneficialOwnerDocuments(index)}
//                   disabled={isGettingBeneficialOwnerToken || ownersStatus[index]}
//                 >
//                   {ownersStatus[index] ? '✓ Information Provided' : 'Provide Information'}
//                 </Button>
//               </Card>
//             ))}

//             <div className="flex justify-between">
//               <Button variant="outline" onClick={() => setCurrentStep(1)}>
//                 Back
//               </Button>
//               <Button onClick={() => setCurrentStep(3)} disabled={!isOwnersStepComplete()}>
//                 Continue
//               </Button>
//             </div>
//           </div>
//         );

//       case 3:
//         return (
//           <div className="space-y-6">
//             <Alert>
//               <AlertDescription>
//                 Please review all information before submitting for verification.
//               </AlertDescription>
//             </Alert>

//             <Card className="p-6">
//               <h3 className="font-medium text-lg mb-2">Verification Checklist</h3>
//               <ul className="space-y-2">
//                 <li className="flex items-center">
//                   <span className="mr-2">
//                     {documentStatus[DocumentType.BUSINESS_FORMATION] ? '✓' : '○'}
//                   </span>
//                   Business Formation Document
//                 </li>
//                 <li className="flex items-center">
//                   <span className="mr-2">
//                     {documentStatus[DocumentType.BUSINESS_OWNERSHIP] ? '✓' : '○'}
//                   </span>
//                   Business Ownership Document
//                 </li>
//                 <li className="flex items-center">
//                   <span className="mr-2">
//                     {documentStatus[DocumentType.PROOF_OF_ADDRESS] ? '✓' : '○'}
//                   </span>
//                   Proof of Business Address
//                 </li>
//                 <li className="flex items-center">
//                   <span className="mr-2">{documentStatus[DocumentType.TAX_ID] ? '✓' : '○'}</span>
//                   Tax ID Document
//                 </li>
//                 {Array.from({ length: ownersCount }).map((_, index) => (
//                   <li key={index} className="flex items-center">
//                     <span className="mr-2">{ownersStatus[index] ? '✓' : '○'}</span>
//                     Beneficial Owner {index + 1} Information
//                   </li>
//                 ))}
//               </ul>
//             </Card>

//             <div className="flex items-center space-x-2 mb-4">
//               <input
//                 type="checkbox"
//                 id="termsAcceptance"
//                 checked={termsAccepted}
//                 onChange={(e) => setTermsAccepted(e.target.checked)}
//                 className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
//               />
//               <label htmlFor="termsAcceptance" className="text-sm text-gray-700">
//                 I certify that all information provided is accurate and complete. I accept the{' '}
//                 <a href="/terms" target="_blank" className="text-blue-600 hover:underline">
//                   Terms of Service
//                 </a>{' '}
//                 and{' '}
//                 <a href="/privacy" target="_blank" className="text-blue-600 hover:underline">
//                   Privacy Policy
//                 </a>
//                 .
//               </label>
//             </div>

//             <div className="flex justify-between">
//               <Button variant="outline" onClick={() => setCurrentStep(2)}>
//                 Back
//               </Button>
//               <Button
//                 onClick={handleInitiateVerification}
//                 disabled={isInitiatingVerification || !termsAccepted}
//               >
//                 {isInitiatingVerification ? 'Submitting...' : 'Submit for Verification'}
//               </Button>
//             </div>
//           </div>
//         );

//       default:
//         return null;
//     }
//   };

//   return (
//     <div className="max-w-3xl mx-auto">
//       <h1 className="text-2xl font-bold mb-6">Business Verification</h1>

//       <div className="mb-8">
//         <Steps current={currentStep}>
//           {steps.map((step, index) => (
//             <Step key={index} title={step.title} description={step.description} />
//           ))}
//         </Steps>
//       </div>

//       {error && (
//         <Alert variant="destructive" className="mb-4">
//           <AlertDescription>{error}</AlertDescription>
//         </Alert>
//       )}

//       {renderCurrentStep()}
//     </div>
//   );
// }
