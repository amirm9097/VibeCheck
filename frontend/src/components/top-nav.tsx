"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, LogOut, Menu, X } from "lucide-react";
import { Brand } from "./brand";
import { useLocale } from "./locale-provider";
import type { User } from "@/lib/types";

export function TopNav() {
  const { locale, toggle, t } = useLocale();
  const [user, setUser] = useState<User | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    let active = true;
    fetch("/api/backend/auth/me/", { cache: "no-store" })
      .then(async (response) => response.ok ? await response.json() as User : null)
      .then((value) => { if (active) setUser(value); })
      .catch(() => { if (active) setUser(null); });
    return () => { active = false; };
  }, []);
  async function logout() {
    try { await fetch("/api/session/logout", { method: "POST" }); }
    finally { window.location.href = "/"; }
  }
  const closeMenu = () => setMobileOpen(false);
  return <header className="topbar">
    <div className="shell topbar-inner">
      <Brand/>
      <nav className="nav-links" aria-label={t("mainNavigation")}>
        <a href="/#product">{t("product")}</a>
        <a href="/#how-it-works">{t("howItWorks")}</a>
        {user && <Link href="/dashboard">{t("dashboard")}</Link>}
        {user && <Link href="/compare">{t("compare")}</Link>}
        {user?.role === "admin" && <Link href="/admin">{t("admin")}</Link>}
      </nav>
      <div className="nav-actions">
        <button className="locale-button" onClick={toggle} aria-label={t("switchLanguage")}>{locale === "en" ? "فا" : "EN"}</button>
        {user ? <>
          <Link href="/dashboard" className="btn btn-outline btn-small">{t("dashboard")} <ArrowUpRight size={13}/></Link>
          <button className="btn btn-ghost btn-small" onClick={() => void logout()} aria-label={t("signOut")}><LogOut size={15}/></button>
        </> : <>
          <Link href="/login" className="btn btn-ghost btn-small">{t("signIn")}</Link>
          <Link href="/register" className="btn btn-primary btn-small">{t("createAccount")}</Link>
        </>}
        <button className="mobile-nav-toggle" onClick={() => setMobileOpen((open) => !open)} aria-label={t(mobileOpen ? "closeMenu" : "openMenu")} aria-expanded={mobileOpen} aria-controls="mobile-navigation">
          {mobileOpen ? <X size={18}/> : <Menu size={18}/>}
        </button>
      </div>
    </div>
    <nav id="mobile-navigation" className={`mobile-nav-panel ${mobileOpen ? "is-open" : ""}`} aria-label={t("mainNavigation")} hidden={!mobileOpen}>
      <a href="/#product" onClick={closeMenu}>{t("product")}</a>
      <a href="/#how-it-works" onClick={closeMenu}>{t("howItWorks")}</a>
      {user && <Link href="/dashboard" onClick={closeMenu}>{t("dashboard")}</Link>}
      {user && <Link href="/compare" onClick={closeMenu}>{t("compare")}</Link>}
      {user?.role === "admin" && <Link href="/admin" onClick={closeMenu}>{t("admin")}</Link>}
    </nav>
  </header>;
}
