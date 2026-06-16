"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, X, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timeoutIds = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismissToast = useCallback((id: number) => {
    const timeoutId = timeoutIds.current.get(id);
    if (timeoutId) clearTimeout(timeoutId);
    timeoutIds.current.delete(id);
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++nextId;
    setToasts(prev => [...prev, { id, message, type }]);
    timeoutIds.current.set(id, setTimeout(() => dismissToast(id), 4000));
  }, [dismissToast]);

  useEffect(() => {
    const timers = timeoutIds.current;
    return () => {
      timers.forEach(timeoutId => clearTimeout(timeoutId));
      timers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map(t => (
          <ToastItem key={t.id} item={t} onDismiss={() => dismissToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const icons: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />,
    error:   <XCircle className="w-5 h-5 text-red-500 shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />,
    info:    <Info className="w-5 h-5 text-blue-500 shrink-0" />,
  };

  const bg: Record<ToastType, string> = {
    success: 'bg-green-50 border-green-200',
    error:   'bg-red-50 border-red-200',
    warning: 'bg-amber-50 border-amber-200',
    info:    'bg-blue-50 border-blue-200',
  };

  return (
    <div className={`pointer-events-auto flex items-start gap-3 rounded-lg border p-3 shadow-md ${bg[item.type]}`} role={item.type === 'error' ? 'alert' : 'status'}>
      {icons[item.type]}
      <p className="text-sm text-slate-800 flex-1">{item.message}</p>
      <button onClick={onDismiss} className="text-slate-400 hover:text-slate-600" aria-label="Dismiss notification">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
