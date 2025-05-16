// components/settings/OrganizationDetails.tsx
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Spinner from '@/components/common/Spinner';
import axios from 'axios';
import { formatDocumentName, formatBusinessType } from '@/lib/formatters/business';

interface OrganizationDetailsProps {
  organizationId: string;
}

export default function OrganizationDetails({ organizationId }: OrganizationDetailsProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organizationData, setOrganizationData] = useState<any>(null);

  useEffect(() => {
    const fetchOrganizationData = async () => {
      try {
        setIsLoading(true);
        const { data } = await axios.get(`/api/organizations/${organizationId}/data`);

        if (!data.success) {
          throw new Error(data.error?.message || 'Failed to fetch organization data');
        }

        setOrganizationData(data.data);
      } catch (err) {
        console.error('Error fetching organization data:', err);
        if (axios.isAxiosError(err) && err.response?.data?.error?.message) {
          setError(err.response.data.error.message);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('An unknown error occurred');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrganizationData();
  }, [organizationId]);

  const downloadDocument = async (documentType: string) => {
    try {
      const response = await axios.get(
        `/api/organizations/${organizationId}/document?type=${documentType}`,
        {
          responseType: 'blob',
        },
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
      if (axios.isAxiosError(err) && err.response?.data?.error?.message) {
        setError(err.response.data.error.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred');
      }
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Spinner className="h-8 w-8 text-gray-400" />
          <p className="ml-3 text-gray-500">Loading organization data...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!organizationData) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center">
            <p className="text-gray-500 mb-4">No organization data found</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isPending = organizationData.verification_status !== 'verified';
  const isBusinessVerified = organizationData.verification_status === 'verified';
  const businessData = organizationData.business_data || {};

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">Business Information</h3>
          {isPending ? (
            <div className="text-center py-4">
              <p className="text-amber-500 mb-2">Verification Pending</p>
              <p className="text-gray-500">
                Your business information will be displayed here once verification is complete.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-gray-500 text-sm">Legal Name</p>
                <p className="font-medium">{businessData.name || organizationData.name}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">EIN/Tax ID</p>
                <p className="font-medium">
                  {businessData.tin ? '••••••' + businessData.tin.slice(-4) : 'Not provided'}
                </p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">Business Type</p>
                <p className="font-medium">
                  {businessData.corporation_type
                    ? formatBusinessType(businessData.corporation_type)
                    : 'Not provided'}
                </p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">Address</p>
                <p className="font-medium">
                  {businessData.address_line1 || 'Not provided'}
                  {businessData.address_line2 && `, ${businessData.address_line2}`}
                </p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">City</p>
                <p className="font-medium">{businessData.city || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">State/Province</p>
                <p className="font-medium">{businessData.state || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">ZIP/Postal Code</p>
                <p className="font-medium">{businessData.zip || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">Country</p>
                <p className="font-medium">
                  {businessData.country || organizationData.country || 'Not provided'}
                </p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">Phone Number</p>
                <p className="font-medium">{businessData.phone_number || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">Website</p>
                <p className="font-medium">{businessData.website || 'Not provided'}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Document Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-md font-medium">Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {isBusinessVerified ? (
            isLoading ? (
              <div className="text-center py-8">
                <Spinner className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Loading documents...</p>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <p className="text-sm text-red-500">{error}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {organizationData?.available_documents?.length > 0 ? (
                  organizationData.available_documents.map((docType: string) => (
                    <div key={docType} className="flex items-center justify-between border-b pb-2">
                      <div>
                        <h3 className="font-medium">{formatDocumentName(docType)}</h3>
                        <p className="text-sm text-gray-500">{docType}.pdf</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadDocument(docType)}
                        className="flex items-center gap-2"
                      >
                        Download
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                          <polyline points="7 10 12 15 17 10"></polyline>
                          <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4">
                    <p className="text-gray-500">
                      No documents available. Documents uploaded during verification will appear
                      here.
                    </p>
                  </div>
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
    </div>
  );
}
