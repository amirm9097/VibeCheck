"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Activity, LoaderCircle, ShieldCheck } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { Analysis } from "@/lib/types";
import { ScoreRing } from "@/components/score-ring";
import { categoryLabel, formatNumber, scoreColor } from "@/lib/format";
import { useLocale } from "@/components/locale-provider";

const categories = ["visual_design", "user_experience", "responsiveness", "performance", "accessibility", "content_structure"];
export default function SharedReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params); const { t, locale } = useLocale(); const [report, setReport] = useState<Analysis | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  useEffect(() => { apiFetch<Analysis>(`shared/${token}/`).then(setReport).catch((e) => setError(e instanceof Error ? e.message : t("shareInvalid"))).finally(() => setLoading(false)); }, [token]);
  if (loading) return <main className="shell page-wrap"><div className="empty-state"><LoaderCircle className="animate-spin"/><p>{t("loading")}</p></div></main>;
  if (!report) return <main className="shell page-wrap"><div className="empty-state"><ShieldCheck size={22}/><h1>{t("reportUnavailable")}</h1><p>{error || t("shareInvalid")}</p><Link href="/" className="btn btn-primary">{t("backHome")}</Link></div></main>;
  return <main className="shell page-wrap">
    <div className="page-head"><div><div className="eyebrow">{t("publicReport")}</div><h1>{report.title || report.domain}</h1><p>{report.normalized_url}</p></div><span className="tag"><ShieldCheck size={12} style={{ display:"inline", verticalAlign:"middle" }}/> {t("readOnly")}</span></div>
    <div className="panel report-hero"><div className="report-score-side"><ScoreRing score={report.overall_score}/><p>{t("score")}</p></div><div className="report-intro"><div className="eyebrow">{t("overview")}</div><h2>{report.domain}</h2><p>{report.summary}</p><div className="score-grid">{categories.map((key) => { const score = report.scores?.[key]?.score ?? null; return <div className="score-cell" key={key}><div className="score-cell-head"><span>{categoryLabel(key, locale)}</span><strong style={{ color:scoreColor(score) }}>{score === null ? "—" : formatNumber(score, locale)}</strong></div><div className="meter"><span style={{ width:`${score ?? 0}%`, background:scoreColor(score) }}/></div></div>; })}</div></div></div>
    {report.screenshot_available && <section className="report-section"><div className="report-section-head"><h2>{t("desktop")} &amp; {t("mobile")}</h2></div><div className="snapshot-grid"><div className="panel snapshot"><div className="snapshot-bar">{t("desktop")}</div><img src={`/api/backend/shared/${token}/screenshot/desktop/`} alt={`Desktop screenshot of ${report.domain}`}/></div><div className="panel snapshot"><div className="snapshot-bar">{t("mobile")}</div><img src={`/api/backend/shared/${token}/screenshot/mobile/`} alt={`Mobile screenshot of ${report.domain}`}/></div></div></section>}
    <section className="report-section"><div className="report-section-head"><h2>{t("findings")}</h2><span className="tag">{formatNumber(report.findings.length, locale)}</span></div><div className="finding-list">{report.findings.map((f, i) => <article className="finding" key={`${f.code}-${i}`}><div className="finding-head"><div><h3>{f.title}</h3><div className="finding-meta"><span className="tag">{categoryLabel(f.category, locale)}</span><span className={`severity severity-${f.severity}`}>{f.severity}</span><span className="tag">{f.source === "ai_judgment" ? t("aiJudgment") : t("measured")}</span></div></div></div><p>{f.description}</p><div className="finding-evidence">{f.evidence}</div><p><strong>{t("action")}:</strong> {f.recommendation}</p></article>)}</div></section>
    <section className="report-section two-column"><div className="panel panel-pad"><h2 style={{ fontSize:16 }}>{t("positives")}</h2>{report.positives.map((p, i) => <div className="observation" key={`${i}-${p}`}><ShieldCheck size={14}/>{p}</div>)}</div><div className="panel panel-pad"><h2 style={{ fontSize:16 }}>{t("recommendations")}</h2>{report.recommendations.map((r, i) => <div className="observation" key={`${i}-${r.title}`}><Activity size={14}/><span><strong>{r.title}</strong><br/>{r.action}</span></div>)}</div></section>
    <p className="muted" style={{ textAlign:"center", fontSize:11, marginTop:35 }}>{t("shareNote")} · <Link href="/" style={{ textDecoration:"underline" }}>VibeCheck</Link></p>
  </main>;
}
