// features/transactions/components/SendTransactionModal.tsx
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSolanaWallets } from '@privy-io/react-auth/solana';
import { PublicKey } from '@solana/web3.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useQueryClient } from '@tanstack/react-query';
import { useOrganizations } from '@/hooks/useOrganizations';
import { VendorSelectionForm } from './VendorSelectionForm';
import { TransactionConfirmation } from './TransactionConfirmation';
import { EnrichedVendorFormValues, PaymentDetailsFormValues } from '@/schemas/vendor.schema';
import { PaymentDetailsForm } from './ PaymentDetailsForm';
import { useVendorSelection } from '@/hooks/useVendorSelection';

interface SendTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SendTransactionModal({ isOpen, onClose }: SendTransactionModalProps) {
  const [step, setStep] = useState(0);
  const [vendorFormData, setVendorFormData] = useState<EnrichedVendorFormValues | null>(null);
  const [paymentFormData, setPaymentFormData] = useState<PaymentDetailsFormValues | null>(null);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { organization } = useOrganizations();

  // Get wallet from Privy
  const { wallets } = useSolanaWallets();
  const embeddedWallet = wallets.find((wallet) => wallet.walletClientType === 'privy');
  const walletAddress = embeddedWallet?.address || '';

  // Use the correct hook for vendors list
  const {
    data: vendors = [],
    isLoading: isVendorsLoading,
    error: vendorsError,
    refetch: refetchVendors,
  } = useVendorSelection();

  useEffect(() => {
    // Refetch vendors when modal opens
    if (isOpen) {
      refetchVendors();
    }
  }, [isOpen, refetchVendors]);

  const handleClose = () => {
    onClose();
    setStep(0);
    setVendorFormData(null);
    setPaymentFormData(null);
  };

  const handleTransactionComplete = async () => {
    // Invalidate and refetch balance queries
    await queryClient.invalidateQueries({
      queryKey: ['tokenBalances'],
    });
    await queryClient.invalidateQueries({
      queryKey: ['transactions'],
    });

    // Reset modal state and close
    handleClose();
  };

  const handleVendorSubmit = (data: EnrichedVendorFormValues) => {
    console.log('Vendor Data:', data);
    setVendorFormData(data);
    setStep(1);
  };

  const handlePaymentSubmit = (data: PaymentDetailsFormValues) => {
    console.log('Payment Data:', data);
    setPaymentFormData(data);
    setStep(2);
  };

  const handleBack = () => {
    setStep((prev) => prev - 1);
  };

  const steps = [
    {
      title: '1. Vendor & Invoice Details',
      component: (
        <VendorSelectionForm
          walletAddress={walletAddress}
          onNext={handleVendorSubmit}
          availableVendors={vendors}
          isVendorsLoading={isVendorsLoading}
          vendorsError={vendorsError instanceof Error ? vendorsError : null}
          refetchVendors={refetchVendors}
        />
      ),
    },
    {
      title: '2. Payment Details',
      component: vendorFormData ? (
        <PaymentDetailsForm
          onNext={handlePaymentSubmit}
          onBack={handleBack}
          vendorFormData={vendorFormData}
          walletAddress={walletAddress}
          organization={organization}
        />
      ) : null,
    },
    {
      title: '3. Confirmation',
      component:
        vendorFormData && paymentFormData ? (
          <TransactionConfirmation
            onClose={handleTransactionComplete}
            onBack={handleBack}
            vendorData={vendorFormData}
            paymentData={paymentFormData}
            wallet={embeddedWallet}
            organization={organization}
          />
        ) : null,
    },
  ];

  const progressPercentage =
    step < steps.length - 1
      ? ((step + 1) / steps.length) * 100 - 5
      : ((step + 1) / steps.length) * 100;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          handleClose();
        }
      }}
    >
      <DialogContent
        className="w-full max-w-[90%] h-[90vh] p-0 flex flex-col "
        onPointerDownOutside={(e) => {
          e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
        }}
      >
        <div className="p-6 pb-0">
          <DialogHeader>
            <DialogTitle className="text-xl">Send Payment</DialogTitle>
          </DialogHeader>

          <div className="flex space-x-4 justify-between w-full mt-4 ">
            {steps.map((stepItem, index) => (
              <div
                key={index}
                className={`step-indicator ${
                  index === step ? 'text-quaternary' : 'text-gray-300'
                } text-sm font-medium text-start w-full`}
              >
                {stepItem.title}
              </div>
            ))}
          </div>
          <Progress value={progressPercentage} className="w-full mt-2 bg-gray-300" />
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6">{steps[step].component}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
