"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { Check, X, AlertTriangle, Info } from "lucide-react";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto dismiss after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border backdrop-blur-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] transform transition-all duration-300 ease-out animate-in slide-in-from-right-8 fade-in ${
              t.type === "error"
                ? "bg-[#2A0808]/80 border-red-500/20 text-red-200"
                : t.type === "success"
                ? "bg-[#082A18]/80 border-green-500/20 text-green-200"
                : t.type === "warning"
                ? "bg-[#2A1F08]/80 border-orange-500/20 text-orange-200"
                : "bg-[#0d0d10]/90 border-white/10 text-white"
            }`}
            style={{ maxWidth: "380px" }}
          >
            <div className="mt-0.5 shrink-0">
              {t.type === "error" && <AlertTriangle size={18} className="text-red-400" />}
              {t.type === "success" && <Check size={18} className="text-green-400" />}
              {t.type === "warning" && <AlertTriangle size={18} className="text-orange-400" />}
              {t.type === "info" && <Info size={18} className="text-[#3898FF]" />}
            </div>
            <div className="flex-1 text-sm font-medium leading-relaxed font-sans">{t.message}</div>
            <button
              onClick={() => removeToast(t.id)}
              className="shrink-0 p-1 rounded-md hover:bg-white/10 transition-colors opacity-50 hover:opacity-100"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
