import { useState } from "react";

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
  duration?: number;
}

let toastCounter = 0;

export function useToast() {
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

  return {
    toast,
    dismiss,
    toasts,
  };
}

// For simplicity, we'll use a basic implementation
// In a real app, you'd want a global toast provider
export const toast = (_props: Omit<Toast, "id">) => {
  // TODO: Implement global toast provider
};