"use client";
import { Brand } from "./brand";
import { useLocale } from "./locale-provider";
export function Footer() {
  const { t } = useLocale();
  return <footer className="footer"><div className="shell footer-inner"><Brand/><span>© {new Date().getFullYear()} VibeCheck · {t("footerClaim")}</span><span>{t("footerEvidence")}</span></div></footer>;
}
