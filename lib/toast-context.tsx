"use client";

// Lightweight toast system. Wrap the app in <ToastProvider> (done in the root
// layout) and call useToast() to show messages:
//   const toast = useToast();
//   toast.success("Signed in");
//   toast.error("Something went wrong");
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, X, AlertCircle, Info } from "lucide-react";

type ToastVariant = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi>({
  success: () => {},
  error: () => {},
  info: () => {},
});

const VARIANT_STYLES: Record<
  ToastVariant,
  { bg: string; text: string; Icon: typeof CheckCircle2 }
> = {
  success: { bg: "bg-success-bg", text: "text-success", Icon: CheckCircle2 },
  error: { bg: "bg-danger-bg", text: "text-danger", Icon: AlertCircle },
  info: { bg: "bg-info-bg", text: "text-info", Icon: Info },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message: string, variant: ToastVariant) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, message, variant }]);
      setTimeout(() => remove(id), 4000);
    },
    [remove],
  );

  const api: ToastApi = {
    success: (m) => push(m, "success"),
    error: (m) => push(m, "error"),
    info: (m) => push(m, "info"),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="no-print fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm">
        {toasts.map(({ id, message, variant }) => {
          const { bg, text, Icon } = VARIANT_STYLES[variant];
          return (
            <div
              key={id}
              role="status"
              className={`${bg} ${text} flex items-start gap-2.5 rounded-xl border border-border/50 shadow-md px-4 py-3 animate-in`}
            >
              <Icon size={18} className="shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-ink flex-1">{message}</p>
              <button
                onClick={() => remove(id)}
                aria-label="Dismiss"
                className="shrink-0 text-ink-soft hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
