// components/settings/OrganizationTab.tsx
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useOrganizations } from '@/hooks/useOrganizations';
import SimpleVerificationForm from './SimpleVerificationForm';
import FootprintVerificationForm from './FootprintVerificationForm';
import OrganizationDetails from './OrganizationDetails';
import '@onefootprint/footprint-js/dist/footprint-js.css';
import toast from 'react-hot-toast';
import axios from 'axios';
import footprint from '@onefootprint/footprint-js';
import Spinner from '@/components/common/Spinner';
import { getCountryNameFromAlpha3 } from '@/lib/helpers/countryCodeUtils';
import { useSyncOnboardingState } from '@/hooks/useSyncOnboardingState';
import { formatDocumentName, formatBusinessType } from '@/lib/formatters/business';

export default function OrganizationTab() {
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [organizationData, setOrganizationData] = useState<any>(null);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const { organization, isLoading, refetch } = useOrganizations();

  // Use the sync hook instead of manual synchronization
  useSyncOnboardingState();

  // Determine business verification status from organization data with proper null check
  const isBusinessVerified = !!(
    organization &&
    organization.last_verified_at !== null &&
    organization.verification_status === 'verified'
  );

  // Determine if the company is US-based (only if country exists)
  const isUSBased = organization?.country
    ? ['USA', 'US', 'United States', 'United States of America'].includes(organization.country)
    : null;

  // Safely extract business email
  const getBusinessEmail = () => {
    if (
      organization?.business_details &&
      typeof organization.business_details === 'object' &&
      'email' in organization.business_details
    ) {
      return (organization.business_details.email as string) || '';
    }
    return '';
  };

  // Fetch detailed organization data when verified
  useEffect(() => {
    const fetchOrganizationData = async () => {
      if (!organization?.id || !isBusinessVerified) return;

      try {
        setIsLoadingData(true);
        const { data } = await axios.get(`/api/organizations/${organization.id}/data`);

        if (!data.success) {
          throw new Error(data.error?.message || 'Failed to fetch organization data');
        }

        setOrganizationData(data.data);
      } catch (err) {
        console.error('Error fetching organization data:', err);
        if (axios.isAxiosError(err) && err.response?.data?.error?.message) {
          setDataError(err.response.data.error.message);
        } else if (err instanceof Error) {
          setDataError(err.message);
        } else {
          setDataError('An unknown error occurred');
        }
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchOrganizationData();
  }, [organization?.id, isBusinessVerified]);

  // Launch Footprint verification flow directly
  const launchFootprintVerification = async () => {
    if (!organization?.id || !organization?.country) {
      toast.error('Organization information is incomplete');
      return;
    }

    setIsVerifying(true);

    try {
      // Get Footprint token
      const { data } = await axios.post('/api/footprint/create-session', {
        organizationId: organization.id,
        organizationCountry: organization.country,
      });

      if (!data.success) {
        throw new Error(data.error || 'Failed to create Footprint session');
      }

      const footprintToken = data.data.token;

      // Prepare bootstrap data
      const bootstrapData: Record<string, string> = {
        'business.name': organization.name,
      };

      const businessEmail = getBusinessEmail();
      if (businessEmail) {
        bootstrapData['id.email'] = businessEmail;
      }

      console.log('bootstrapData is: ', JSON.stringify(bootstrapData));

      // Initialize Footprint verification
      const component = footprint.init({
        kind: 'verify',
        authToken: footprintToken,
        bootstrapData,
        onComplete: (validationToken) => {
          console.log('Footprint verification completed:', validationToken);
          handleVerificationComplete(validationToken);
        },
        onError: (error) => {
          console.error('Footprint verification error:', error);
          toast.error(`Verification error: ${error}`);
          setIsVerifying(false);
        },
        onCancel: () => {
          console.log('Footprint verification cancelled');
          setIsVerifying(false);
        },
        appearance: {
          variables: {
            borderRadius: '0.5rem',
            buttonPrimaryBg: '#315E4C',
            buttonPrimaryHoverBg: '#46866c',
            buttonPrimaryColor: '#FFF',
            colorAccent: '#315E4C',
          },
        },
      });

      component.render();
    } catch (err) {
      console.error('Error launching Footprint verification:', err);

      // Improved error handling with more specific messages
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 404) {
          toast.error('Verification service endpoint not found. Please contact support.');
        } else if (err.response?.data?.error) {
          toast.error(`Verification error: ${err.response.data.error}`);
        } else {
          toast.error('Unable to initialize verification. Please try again later.');
        }
      } else {
        toast.error('Unable to initialize verification. Please try again later.');
      }

      setIsVerifying(false);
    }
  };

  // In the OrganizationTab component, modify the handleVerificationClick function:

  const handleVerificationClick = () => {
    // Check if country is missing
    if (!organization?.country) {
      toast.error(
        'Country information is missing. Please update your organization profile with a valid country before proceeding with verification.',
        { duration: 5000 },
      );
      return;
    }

    // Different flow for US vs non-US companies
    if (isUSBased) {
      // For US companies, first create the Zynk entity
      createZynkEntity()
        .then(() => {
          // Then launch Footprint
          launchFootprintVerification();
        })
        .catch((error) => {
          console.error('Error creating Zynk entity:', error);
          // Still launch Footprint even if Zynk entity creation fails
          // We'll try again later during verification
          launchFootprintVerification();
        });
    } else {
      // For non-US companies, open our custom dialog
      toast.error(
        `Please email support@cargobill.co to verify your business in ${getCountryNameFromAlpha3(organization?.country)}`,
      );
      // setIsVerificationModalOpen(true);
    }
  };

  // Add a new function to create Zynk entity
  const createZynkEntity = async () => {
    if (!organization?.id) {
      throw new Error('Organization ID is missing');
    }

    try {
      const response = await axios.post('/api/footprint/create-entity', {
        organizationId: organization.id,
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to create Zynk entity');
      }

      return response.data.data;
    } catch (error) {
      console.error('Error creating Zynk entity:', error);
      // Don't fail verification flow if Zynk entity creation fails
      // We'll try again during the verification process
    }
  };

  // And update the handleVerificationComplete function:
  const handleVerificationComplete = async (validationToken: string) => {
    setIsVerifying(true);

    try {
      // First try to ensure we have a Zynk entity
      await createZynkEntity().catch((error) => {
        console.error('Error creating Zynk entity during verification completion:', error);
        // Continue with validation even if entity creation fails
      });

      // Send the validation token to your backend to validate and update verification status
      const response = await fetch('/api/footprint/validate-kyb', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          validationToken,
          organizationId: organization?.id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to validate KYB');
      }

      // Close modal and refresh organization data
      setIsVerificationModalOpen(false);
      setIsVerifying(false);

      // Refresh organization data
      refetch();

      toast.success('Verification process completed successfully');
    } catch (error) {
      console.error('Error validating KYB:', error);
      toast.error('Verification validation failed. Please try again later.');
      setIsVerifying(false);
    }
  };

  // Function to download a document
  const downloadDocument = async (documentType: string) => {
    if (!organization?.id) return;

    try {
      const response = await axios.get(
        `/api/organizations/${organization.id}/document?type=${documentType}`,
        { responseType: 'blob' },
      );

      // Create a blob URL and trigger download
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${documentType}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading document:', err);
      toast.error('Failed to download document. Please try again later.');
    }
  };

  // Show loading state while organization data is loading
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-md font-medium">Business Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <p className="text-sm text-gray-500">Loading your business information...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-md font-medium">Business Information</CardTitle>
        </CardHeader>
        <CardContent>
          {isBusinessVerified ? (
            isLoadingData ? (
              <div className="text-center py-8">
                <Spinner className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Loading business details...</p>
              </div>
            ) : dataError ? (
              <div className="text-center py-8">
                <p className="text-sm text-red-500 mb-2">{dataError}</p>
                <Button variant="outline" onClick={() => window.location.reload()}>
                  Try Again
                </Button>
              </div>
            ) : (
              // Display business information from Footprint
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Legal Name</h3>
                  <p>{organizationData?.business_data?.name || organization?.name || 'N/A'}</p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500">EIN/Tax ID</h3>
                  <p>
                    {organizationData?.business_data?.tin
                      ? '••••••' + organizationData.business_data.tin.slice(-4)
                      : '••••••1234'}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500">Business Type</h3>
                  <p>
                    {organizationData?.business_data?.corporation_type
                      ? formatBusinessType(organizationData.business_data.corporation_type)
                      : 'Limited Liability Company'}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500">Address</h3>
                  <p>{organizationData?.business_data?.address_line1 || '123 W Main St.'}</p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500">City</h3>
                  <p>{organizationData?.business_data?.city || 'Chicago'}</p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500">State/Province</h3>
                  <p>{organizationData?.business_data?.state || 'IL'}</p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500">ZIP/Postal Code</h3>
                  <p>{organizationData?.business_data?.zip || '60623'}</p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500">Country</h3>
                  <p>
                    {organizationData?.business_data?.country ||
                      organization?.country ||
                      'Not specified'}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500">Phone Number</h3>
                  <p>{organizationData?.business_data?.phone_number || '+1 312 675 8769'}</p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500">Website</h3>
                  <p>{organizationData?.business_data?.website || 'www.illinilogistics.com'}</p>
                </div>
              </div>
            )
          ) : (
            <div className="text-center py-8">
              <h3 className="font-medium text-gray-700 mb-2">Business Verification Required</h3>
              <p className="text-sm text-gray-500 mb-4">
                Verify your business to unlock full functionality
              </p>

              {isVerifying ? (
                <div className="flex flex-col items-center justify-center gap-2">
                  <Spinner className="h-8 w-8 text-gray-400" />
                  <p className="text-sm text-gray-500">Initializing verification...</p>
                </div>
              ) : (
                <Button onClick={handleVerificationClick}>Verify Your Business</Button>
              )}

              {!organization?.country && (
                <p className="mt-3 text-sm text-amber-600">
                  Note: You will need to set your organization's country before verification.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Document Upload Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-md font-medium">Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {isBusinessVerified ? (
            isLoadingData ? (
              <div className="text-center py-8">
                <Spinner className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Loading documents...</p>
              </div>
            ) : dataError ? (
              <div className="text-center py-8">
                <p className="text-sm text-red-500">{dataError}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {organizationData?.available_documents?.length > 0 ? (
                  organizationData.available_documents.map((docType: string) => (
                    <div key={docType} className="flex items-center justify-between border-b pb-2">
                      <div>
                        <h3 className="font-medium">{formatDocumentName(docType)}</h3>
                        <p className="text-sm text-gray-500">{`illini_logistics_${docType}.pdf`}</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => downloadDocument(docType)}>
                        Download
                      </Button>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="flex items-center justify-between border-b pb-2">
                      <div>
                        <p className="text-sm text-gray-500">Document data error</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500">No documents available</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog for non-US verification - Only shown for non-US companies */}
      {organization && organization.country && !isUSBased && (
        <Dialog open={isVerificationModalOpen} onOpenChange={setIsVerificationModalOpen}>
          <DialogContent className="max-w-[90vw] w-[90vw] h-[90vh] overflow-y-auto">
            <DialogTitle className="sr-only">Business Verification</DialogTitle>

            <SimpleVerificationForm
              organizationId={organization.id}
              organizationName={organization.name}
              organizationEmail={getBusinessEmail()}
              organizationCountry={organization.country}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
