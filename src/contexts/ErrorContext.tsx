import { createContext, useContext, ReactNode, useState } from 'react';

interface AppError {
  id: string;
  message: string;
  context?: string;
  timestamp: Date;
  retryable: boolean;
  retryFn?: () => Promise<void>;
}

interface ErrorContextValue {
  errors: AppError[];
  lastError: AppError | null;
  
  addError: (error: Error, context?: string, retryFn?: () => Promise<void>) => void;
  removeError: (id: string) => void;
  clearErrors: () => void;
  retryError: (id: string) => Promise<void>;
}

const ErrorContext = createContext<ErrorContextValue | null>(null);

export function ErrorProvider({ children }: { children: ReactNode }) {
  const [errors, setErrors] = useState<AppError[]>([]);
  const [lastError, setLastError] = useState<AppError | null>(null);

  const addError = (error: Error, context?: string, retryFn?: () => Promise<void>) => {
    const newError: AppError = {
      id: `error-${Date.now()}`,
      message: error.message,
      context,
      timestamp: new Date(),
      retryable: !!retryFn,
      retryFn,
    };
    
    setErrors(prev => [...prev, newError]);
    setLastError(newError);
  };

  const removeError = (id: string) => {
    setErrors(prev => prev.filter(e => e.id !== id));
  };

  const clearErrors = () => {
    setErrors([]);
    setLastError(null);
  };

  const retryError = async (id: string) => {
    const error = errors.find(e => e.id === id);
    if (error?.retryFn) {
      try {
        await error.retryFn();
        removeError(id);
      } catch (e) {
        // Retry failed, keep the error
      }
    }
  };

  return (
    <ErrorContext.Provider value={{
      errors,
      lastError,
      addError,
      removeError,
      clearErrors,
      retryError,
    }}>
      {children}
    </ErrorContext.Provider>
  );
}

export function useError() {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error('useError must be used within ErrorProvider');
  }
  return context;
}

// For backward compatibility
export const useErrorStore = useError;