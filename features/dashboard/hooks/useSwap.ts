// hooks/useSwap.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  swapApi,
  SwapSimulationParams,
  SwapPreparationParams,
  SwapExecutionParams,
  SwapFinalizationParams,
} from '@/services/api/swapApi';
import { toast } from 'react-hot-toast';

export function useSwapSimulation() {
  return useMutation({
    mutationFn: swapApi.simulateSwap,
    onError: (error: Error) => {
      console.error('Swap simulation failed:', error);
      toast.error(error.message);
    },
  });
}

export function useSwapPreparation() {
  return useMutation({
    mutationFn: swapApi.prepareSwap,
    onError: (error: Error) => {
      console.error('Swap preparation failed:', error);
      toast.error(error.message);
    },
  });
}

export function useSwapExecution() {
  return useMutation({
    mutationFn: swapApi.executeSwap,
    onError: (error: Error) => {
      console.error('Swap execution failed:', error);
      toast.error(error.message);
    },
  });
}

export function useSwapFinalization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: swapApi.finalizeSwap,
    onSuccess: (data) => {
      toast.success(
        `Swap completed successfully! ${data.amountIn} ${data.fromToken} → ${data.amountOut} ${data.toToken}`,
        { duration: 5000 },
      );

      // Invalidate token balances to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['tokenBalances'] });

      // Optionally invalidate organization data if needed
      queryClient.invalidateQueries({ queryKey: ['organization'] });
    },
    onError: (error: Error) => {
      console.error('Swap finalization failed:', error);
      toast.error(error.message);
    },
  });
}

// Combined hook for easier usage with sponsored transaction flow
export function useSwap() {
  const simulateSwap = useSwapSimulation();
  const prepareSwap = useSwapPreparation();
  const executeSwap = useSwapExecution();
  const finalizeSwap = useSwapFinalization();

  return {
    // Individual mutations
    simulateSwap,
    prepareSwap,
    executeSwap,
    finalizeSwap,

    // Status flags
    isSimulating: simulateSwap.isPending,
    isPreparing: prepareSwap.isPending,
    isExecuting: executeSwap.isPending,
    isFinalizing: finalizeSwap.isPending,

    // Data
    simulationData: simulateSwap.data,
    preparationData: prepareSwap.data,
    executionData: executeSwap.data,
    finalizationData: finalizeSwap.data,

    // Errors
    simulationError: simulateSwap.error,
    preparationError: prepareSwap.error,
    executionError: executeSwap.error,
    finalizationError: finalizeSwap.error,

    // Reset functions
    resetSimulation: simulateSwap.reset,
    resetPreparation: prepareSwap.reset,
    resetExecution: executeSwap.reset,
    resetFinalization: finalizeSwap.reset,

    // Combined status for UI
    isProcessing:
      simulateSwap.isPending ||
      prepareSwap.isPending ||
      executeSwap.isPending ||
      finalizeSwap.isPending,
  };
}
