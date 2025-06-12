import { useState } from 'react';

interface Toast {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = ({ title, description, variant = 'default' }: Toast) => {
    // For now, just use console.log for feedback
    // In a production app, you'd implement a proper toast system
    const message = `${title}${description ? `: ${description}` : ''}`;

    if (variant === 'destructive') {
      console.error(`❌ ${message}`);
      // Could also use alert for critical errors if needed
    } else {
      console.log(`✅ ${message}`);
    }

    // Add to toasts array for potential future UI display
    const newToast = { title, description, variant };
    setToasts((prev) => [...prev, newToast]);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t !== newToast));
    }, 3000);
  };

  return { toast, toasts };
}
