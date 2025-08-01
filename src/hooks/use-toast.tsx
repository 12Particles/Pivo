import { useState, createContext, useContext, ReactNode } from "react";

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
  duration?: number;
}

let toastCounter = 0;

interface ToastContextType {
  toast: (props: Omit<Toast, "id">) => { id: string; dismiss: () => void };
  dismiss: (toastId?: string) => void;
  toasts: Toast[];
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = (props: Omit<Toast, "id">) => {
    const id = `toast-${toastCounter++}`;
    const newToast: Toast = {
      id,
      duration: 5000,
      variant: "default",
      ...props,
    };

    setToasts((prev) => [...prev, newToast]);

    // Auto dismiss
    setTimeout(() => {
      dismiss(id);
    }, newToast.duration);

    return {
      id,
      dismiss: () => dismiss(id),
    };
  };

  const dismiss = (toastId?: string) => {
    setToasts((prev) => {
      if (toastId) {
        return prev.filter((t) => t.id !== toastId);
      }
      return [];
    });
  };

  return (
    <ToastContext.Provider value={{ toast, dismiss, toasts }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

// Global singleton for convenience
let globalToast: ((props: Omit<Toast, "id">) => void) | undefined;

export function setGlobalToast(toastFn: (props: Omit<Toast, "id">) => void) {
  globalToast = toastFn;
}

export const toast = (props: Omit<Toast, "id">) => {
  if (globalToast) {
    globalToast(props);
  } else {
    console.warn("Toast called before provider is ready");
  }
};