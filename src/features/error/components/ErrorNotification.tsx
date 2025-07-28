/**
 * Error notification component that listens to error events
 */

import { useToast } from '@/hooks/use-toast';
import { useEvent } from '@/hooks/infrastructure/useEventBus';
import { useError } from '@/contexts/ErrorContext';

export function ErrorNotification() {
  const { toast } = useToast();
  const { addError } = useError();
  
  useEvent('error-occurred', async ({ error, context, retryable }) => {
    // Add to error store
    const retry = typeof retryable === 'function' ? retryable : undefined;
    addError(error, context, retry);
    
    // Show toast notification
    toast({
      title: 'Error',
      description: error.message || 'An unexpected error occurred',
      variant: 'destructive',
    });
  });
  
  return null;
}