// stores/onboardingStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface OnboardingState {
  businessVerified: boolean;
  paymentMethodsLinked: boolean;
  firstPaymentSent: boolean;
  paymentLinkShared: boolean;
  setBusinessVerified: (value: boolean) => void;
  setPaymentMethodsLinked: (value: boolean) => void;
  setFirstPaymentSent: (value: boolean) => void;
  setPaymentLinkShared: (value: boolean) => void;
  isOnboardingComplete: () => boolean;
  clearOnboarding: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      businessVerified: false,
      paymentMethodsLinked: false,
      firstPaymentSent: false,
      paymentLinkShared: false,

      setBusinessVerified: (value) => set({ businessVerified: value }),
      setPaymentMethodsLinked: (value) => set({ paymentMethodsLinked: value }),
      setFirstPaymentSent: (value) => set({ firstPaymentSent: value }),
      setPaymentLinkShared: (value) => set({ paymentLinkShared: value }),

      isOnboardingComplete: () => {
        const { businessVerified, paymentMethodsLinked, firstPaymentSent, paymentLinkShared } =
          get();
        return businessVerified && paymentMethodsLinked && firstPaymentSent && paymentLinkShared;
      },

      clearOnboarding: () =>
        set({
          businessVerified: false,
          paymentMethodsLinked: false,
          firstPaymentSent: false,
          paymentLinkShared: false,
        }),
    }),
    {
      name: 'cargobill-onboarding',
    },
  ),
);
