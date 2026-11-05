"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowUpRight, LoaderCircle } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { useToast } from "@/components/toast-provider";

export function AuthForm({ mode, nextPath = "/dashboard" }: { mode: "login" | "register"; nextPath?: string }) {
  const { t } = useLocale(); const toast = useToast();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState(""); const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const isRegister = mode === "register";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (isRegister && password !== passwordConfirm) { setError(t("authMismatch")); return; }
    setBusy(true);
    try {
      const response = await fetch(`/api/session/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(isRegister ? { email, password, password_confirm: passwordConfirm, display_name: displayName } : { email, password }) });
      const data = await response.json();
      if (!response.ok) {
        const detail = data?.error?.detail ?? data?.detail ?? data;
        if (detail && typeof detail === "object") setError(Object.entries(detail).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`).join(" · "));
        else setError(String(detail || "Please check your details and try again."));
        return;
      }
      toast(isRegister ? t("accountReady") : t("signedIn"), "success");
      const safeNext = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/dashboard";
      window.location.assign(safeNext);
    } catch { setError(t("authUnavailable")); }
    finally { setBusy(false); }
  }
  return <div className="auth-wrap"><div className="auth-card">
    <div className="eyebrow">VIBECHECK ACCOUNT</div>
    <h1>{t(isRegister ? "registerTitle" : "loginTitle")}</h1><p>{t(isRegister ? "registerSubtitle" : "loginSubtitle")}</p>
    <form className="form-stack" onSubmit={submit}>
      {isRegister && <div><label className="field-label" htmlFor="display-name">{t("displayName")}</label><input id="display-name" className="input-field" value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="name" maxLength={120}/></div>}
      <div><label className="field-label" htmlFor="email">{t("email")}</label><input id="email" className="input-field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required/></div>
      <div><label className="field-label" htmlFor="password">{t("password")}</label><input id="password" className="input-field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={isRegister ? "new-password" : "current-password"} minLength={isRegister ? 12 : 1} required/>{isRegister && <div className="field-help">{t("forgot")}</div>}</div>
      {isRegister && <div><label className="field-label" htmlFor="password-confirm">{t("confirmPassword")}</label><input id="password-confirm" className="input-field" type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} autoComplete="new-password" minLength={12} required/></div>}
      {error && <div className="field-error" role="alert">{error}</div>}
      <button className="btn btn-primary" disabled={busy} type="submit">{busy ? <LoaderCircle size={15} className="animate-spin"/> : <>{t(isRegister ? "register" : "login")}<ArrowUpRight size={15}/></>}</button>
    </form>
    <div className="auth-foot">{isRegister ? t("haveAccount") : t("noAccount")} {" "}<Link href={isRegister ? "/login" : "/register"}>{t(isRegister ? "signIn" : "createAccount")}</Link><p className="muted" style={{ margin: "13px 0 0", lineHeight: 1.6 }}>{t("terms")}</p></div>
  </div></div>;
}
