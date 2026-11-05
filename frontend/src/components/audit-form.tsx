"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Globe2, LoaderCircle, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { apiFetch, ApiError } from "@/lib/api";
import { useLocale } from "./locale-provider";
import { useToast } from "./toast-provider";
import type { Analysis } from "@/lib/types";

export function AuditForm() {
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { t } = useLocale();
  const toast = useToast();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const value = url.trim();
    if (!value) { setError("Enter a website URL to begin."); return; }
    setSubmitting(true);
    try {
      const analysis = await apiFetch<Analysis>("analyses/", { method: "POST", body: JSON.stringify({ url: value }) });
      router.push(`/analyses/${analysis.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not start this analysis.";
      if (err instanceof ApiError && err.status === 401) {
        router.push(`/login?next=${encodeURIComponent("/dashboard")}`);
        toast(t("signInToAudit"), "info");
      } else setError(message);
    } finally { setSubmitting(false); }
  }
  return <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5, delay: .12 }}>
    <form className="url-form" onSubmit={submit}>
      <Globe2 className="url-icon" size={18}/>
      <label htmlFor="site-url" className="sr-only">{t("websiteLabel")}</label>
      <input id="site-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t("urlPlaceholder")} autoComplete="url" spellCheck={false} disabled={submitting}/>
      <button className="btn btn-primary" type="submit" disabled={submitting}>{submitting ? <><LoaderCircle size={15} className="animate-spin"/>{t("analyzing")}</> : <>{t("analyze")}<ArrowUpRight size={15}/></>}</button>
    </form>
    {error && <div className="field-error" role="alert">{error}</div>}
    <div className="under-form"><ShieldCheck size={14}/>{t("privateNote")}</div>
  </motion.div>;
}
