"use client";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { useLocale } from "./locale-provider";

type Toast = { id: number; message: string; type: "success" | "error" | "info" };
type ToastContextValue = { toast: (message: string, type?: Toast["type"]) => void };
const Context = createContext<ToastContextValue | null>(null);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const { t } = useLocale();
  const toast = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setItems((old) => [...old, { id, message, type }].slice(-4));
    window.setTimeout(() => setItems((old) => old.filter((item) => item.id !== id)), 4200);
  }, []);
  return <Context.Provider value={{ toast }}>
    {children}
    <div className="toast-stack" aria-live="polite" aria-atomic="false">
      <AnimatePresence>{items.map((item) => <motion.div key={item.id} className={`toast toast-${item.type}`} initial={{ opacity: 0, y: 12, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, x: 16 }}>
        {item.type === "success" ? <CheckCircle2 size={17}/> : <AlertCircle size={17}/>}<span>{item.message}</span><button aria-label={t("dismissNotification")} onClick={() => setItems((old) => old.filter((x) => x.id !== item.id))}><X size={15}/></button>
      </motion.div>)}</AnimatePresence>
    </div>
  </Context.Provider>;
}
export function useToast() {
  const context = useContext(Context);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context.toast;
}
