// components/onboarding/OnboardingChecklist.tsx
import { useRouter } from 'next/router';
import { Check } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { ROUTES } from '@/constants/routes';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { toast } from 'sonner';

interface OnboardingTaskProps {
  title: string;
  description: string;
  completed: boolean;
  onClick: () => void;
  taskNumber: number;
}

const OnboardingTask = ({
  title,
  description,
  completed,
  onClick,
  taskNumber,
}: OnboardingTaskProps) => (
  <div
    className={`flex cursor-pointer items-start space-x-4 rounded-sm border p-4 transition-colors ${
      completed ? 'bg-gray-50 opacity-75' : 'bg-white hover:bg-gray-50'
    }`}
    onClick={completed ? undefined : onClick}
  >
    <div
      className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${
        completed ? 'bg-blue-500' : 'border border-gray-300'
      }`}
    >
      {completed && <Check className="h-4 w-4 text-white" />}
      {!completed && <span className="text-xs font-semibold text-gray-500">{taskNumber}</span>}
    </div>
    <div>
      <h3 className={`pb-[2px] font-medium ${completed ? 'text-gray-500' : 'text-gray-900'}`}>
        {title}
      </h3>
      <p className="text-xs text-gray-500">{description}</p>
    </div>
  </div>
);

export default function OnboardingChecklist() {
  const router = useRouter();
  const {
    businessVerified,
    paymentMethodsLinked,
    firstPaymentSent,
    paymentLinkShared,
    isOnboardingComplete,
  } = useOnboardingStore();

  // If all tasks are complete, don't show the checklist
  if (isOnboardingComplete()) {
    return null;
  }

  // Handlers for each task
  const handleBusinessVerification = () => {
    router.push(`${ROUTES.SETTINGS}?tab=organization`);
  };

  const handleLinkPaymentMethods = () => {
    router.push(`${ROUTES.SETTINGS}?tab=linked-accounts`);
  };

  const handleSendFirstPayment = () => {
    // This would open the send payment modal
    // For now, just navigate to dashboard
    // router.push(ROUTES.DASHBOARD);
    // In a real implementation, you would call some function to open the modal
    // openSendPaymentModal();

    toast.error(`Please complete business verification`, {
      duration: 3000,
      position: 'top-center',
      icon: '🔒',
    });
  };

  const handleSharePaymentLink = () => {
    // This would open the payment request modal
    // For now, just navigate to dashboard
    // router.push(ROUTES.DASHBOARD);
    // In a real implementation, you would call some function to open the modal
    // openPaymentRequestModal();
    toast.error(`Please complete business verification`, {
      duration: 3000,
      position: 'top-center',
      icon: '🔒',
    });
  };

  return (
    <Card className="mb-6 p-0 bg-transparent shadow-none border-transparent">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Get Started</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4 text-sm">
        <OnboardingTask
          title="Business Registration"
          description="Complete to unlock instant ramping, banking, cards, & external payments"
          completed={businessVerified}
          onClick={handleBusinessVerification}
          taskNumber={1}
        />
        <OnboardingTask
          title="Link Payment Methods"
          description="Connect external bank accounts or cards to fund your account"
          completed={paymentMethodsLinked}
          onClick={handleLinkPaymentMethods}
          taskNumber={2}
        />
        <OnboardingTask
          title="Send Your First Payment"
          description="Make a secure payment to a vendor"
          completed={firstPaymentSent}
          onClick={handleSendFirstPayment}
          taskNumber={3}
        />
        <OnboardingTask
          title="Share a Payment Link"
          description="Create a payment request for clients"
          completed={paymentLinkShared}
          onClick={handleSharePaymentLink}
          taskNumber={4}
        />
      </div>
    </Card>
  );
}
