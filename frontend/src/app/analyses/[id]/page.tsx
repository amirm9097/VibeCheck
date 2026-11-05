"use client";
import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, ArrowLeft, ArrowUpRight, CheckCircle2, CircleAlert, Download, FileJson, ExternalLink, Eye, Heart, LoaderCircle, RefreshCw, Share2, ShieldCheck, Smartphone, Sparkles } from "lucide-react";
import { apiDownload, apiFetch, ApiError } from "@/lib/api";
import type { Analysis, Finding } from "@/lib/types";
import { categoryLabel, formatDate, formatNumber, scoreColor } from "@/lib/format";
import { ScoreRing } from "@/components/score-ring";
import { useLocale } from "@/components/locale-provider";
import { useToast } from "@/components/toast-provider";

const scoreOrder = ["visual_design", "user_experience", "responsiveness", "performance", "accessibility", "content_structure"];
function StatusPill({ status }: { status: Analysis["status"] }) { const { t } = useLocale(); return <span className={`status status-${status}`}>{t(status)}</span>; }
function FindingItem({ finding }: { finding: Finding }) {
  const { t, locale } = useLocale();
  return <article className="finding">
    <div className="finding-head"><div><h3>{finding.title}</h3><div className="finding-meta"><span className="tag">{categoryLabel(finding.category, locale)}</span><span className={`severity severity-${finding.severity}`}>{finding.severity}</span><span className="tag">{finding.source === "ai_judgment" ? t("aiJudgment") : t("measured")}</span></div></div><CircleAlert size={17} color={finding.severity === "high" || finding.severity === "critical" ? "var(--bad)" : "var(--warn)"}/></div>
    <p>{finding.description}</p><div className="finding-evidence"><strong>{t("evidence")}: </strong>{finding.evidence}</div><p><strong>{t("action")}:</strong> {finding.recommendation}</p>
  </article>;
}

export default function AnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, locale } = useLocale(); const toast = useToast(); const router = useRouter();
  const [analysis, setAnalysis] = useState<Analysis | null>(null); const [loading, setLoading] = useState(true); const [actionBusy, setActionBusy] = useState(false); const [fatalError, setFatalError] = useState("");
  const load = useCallback(async () => {
    try { const result = await apiFetch<Analysis>(`analyses/${id}/`); setAnalysis(result); setFatalError(""); }
    catch (error) {
      if (error instanceof ApiError && error.status === 401) router.replace(`/login?next=${encodeURIComponent(`/analyses/${id}`)}`);
      else if (error instanceof ApiError && error.status === 404) setFatalError(t("reportNotFound"));
      else setFatalError(error instanceof Error ? error.message : "Could not load this report.");
    } finally { setLoading(false); }
  }, [id, router, t]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!analysis || (analysis.status !== "queued" && analysis.status !== "running")) return;
    const interval = window.setInterval(() => { void load(); }, 3500);
    return () => window.clearInterval(interval);
  }, [analysis?.status, load]);

  async function retry() {
    setActionBusy(true);
    try { await apiFetch<Analysis>(`analyses/${id}/retry/`, { method: "POST" }); toast(t("queued"), "success"); await load(); }
    catch (e) { toast(e instanceof Error ? e.message : "Could not retry the analysis.", "error"); }
    finally { setActionBusy(false); }
  }
  async function toggleFavorite() {
    if (!analysis) return; setActionBusy(true);
    try { const updated = await apiFetch<Analysis>(`analyses/${id}/`, { method: "PATCH", body: JSON.stringify({ is_favorite: !analysis.is_favorite }) }); setAnalysis(updated); toast(analysis.is_favorite ? t("favoriteRemoved") : t("favoriteAdded"), "success"); }
    catch (e) { toast(e instanceof Error ? e.message : "Could not update favorite.", "error"); }
    finally { setActionBusy(false); }
  }
  async function share() {
    setActionBusy(true);
    try {
      const result = await apiFetch<{ token: string; url: string }>(`analyses/${id}/share/`, { method: "POST" });
      await navigator.clipboard.writeText(`${window.location.origin}${result.url}`);
      toast(t("copied"), "success");
    } catch (e) { toast(e instanceof Error ? e.message : "Could not create a share link.", "error"); }
    finally { setActionBusy(false); }
  }
  async function download(format: "pdf" | "json" = "pdf") {
    if (!analysis) return;
    try { await apiDownload(`/api/backend/analyses/${id}/export.${format}/`, `vibecheck-${analysis.domain}.${format}`); }
    catch (e) { toast(e instanceof Error ? e.message : "Could not download the report.", "error"); }
  }

  if (loading) return <main className="shell page-wrap"><div className="empty-state"><LoaderCircle className="animate-spin" size={27}/><h3>{t("reportLoading")}</h3><p>{t("reportLoadingText")}</p></div></main>;
  if (!analysis) return <main className="shell page-wrap"><div className="empty-state"><div className="empty-icon"><CircleAlert size={20}/></div><h3>{t("errorTitle")}</h3><p>{fatalError || t("reportUnavailable")}</p><Link href="/dashboard" className="btn btn-primary">{t("backDashboard")}</Link></div></main>;
  if (analysis.status === "queued" || analysis.status === "running") return <main className="shell page-wrap">
    <Link href="/dashboard" className="btn btn-ghost btn-small"><ArrowLeft size={14}/>{t("backDashboard")}</Link>
    <div className="panel panel-pad" style={{ maxWidth:700, margin:"48px auto", textAlign:"center", padding:"44px 28px" }}>
      <div className="empty-icon"><Activity size={21}/></div><StatusPill status={analysis.status}/><h1 style={{ fontSize:27, letterSpacing:"-.04em", margin:"17px 0 8px" }}>{t("reportLoading")}</h1><p className="muted" style={{ fontSize:13, maxWidth:460, margin:"0 auto 20px" }}>{t("reportLoadingText")}</p><div style={{ display:"flex", justifyContent:"center", alignItems:"center", gap:9, color:"#84917f", fontSize:11 }}><LoaderCircle size={15} className="animate-spin"/> {t("analysisProgress")}</div><div style={{ marginTop:24, color:"var(--ink-soft)", fontWeight:650 }}>{analysis.domain}</div>
    </div>
  </main>;
  if (analysis.status === "failed") return <main className="shell page-wrap"><Link href="/dashboard" className="btn btn-ghost btn-small"><ArrowLeft size={14}/>{t("backDashboard")}</Link><div className="panel panel-pad" style={{ maxWidth:680, margin:"35px auto" }}><div className="empty-icon" style={{ color:"var(--bad)", background:"#f9ece9" }}><CircleAlert size={20}/></div><h1 style={{ fontSize:25, margin:"8px 0" }}>{t("analysisFailed")}</h1><p className="muted">{analysis.error_message || t("inspectionFailed")}</p><p className="muted" style={{ fontSize:11 }}>{t("reference")}: {analysis.error_code || "analysis_failed"}</p><button className="btn btn-primary" onClick={() => void retry()} disabled={actionBusy}>{actionBusy ? <LoaderCircle size={15} className="animate-spin"/> : <RefreshCw size={15}/>} {t("retry")}</button></div></main>;

  const findings = analysis.findings || [];
  const measuredFindings = findings.filter((f) => f.source === "measurement");
  const aiFindings = findings.filter((f) => f.source === "ai_judgment");
  const metrics = analysis.lighthouse?.metrics || {};
  return <main className="shell page-wrap">
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:14, flexWrap:"wrap", marginBottom:18 }}>
      <Link href="/dashboard" className="btn btn-ghost btn-small"><ArrowLeft size={14}/>{t("backDashboard")}</Link>
      <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
        <button className="btn btn-outline btn-small" onClick={() => void toggleFavorite()} disabled={actionBusy}><Heart size={14} fill={analysis.is_favorite ? "#536e43" : "none"}/>{analysis.is_favorite ? t("unfavorite") : t("favorite")}</button>
        <button className="btn btn-outline btn-small" onClick={() => void share()} disabled={actionBusy}><Share2 size={14}/>{t("share")}</button>
        <button className="btn btn-outline btn-small" onClick={() => void download("json")}><FileJson size={14}/>JSON</button><button className="btn btn-primary btn-small" onClick={() => void download("pdf")}><Download size={14}/>{t("exportPdf")}</button>
      </div>
    </div>
    <div className="page-head"><div><div className="eyebrow">{t("report")} · {formatDate(analysis.created_at, locale)}</div><h1>{analysis.title || analysis.domain}</h1><p><a href={analysis.normalized_url} target="_blank" rel="noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:5 }}>{analysis.normalized_url}<ExternalLink size={12}/></a></p></div><StatusPill status={analysis.status}/></div>

    <section className="panel report-hero">
      <div className="report-score-side"><ScoreRing score={analysis.overall_score} label={t("score")}/><p>{t("score")}</p><span className="tag" style={{ alignSelf:"center" }}>{t("averageAvailable")}</span></div>
      <div className="report-intro"><div className="eyebrow">{t("overview")}</div><h2>{analysis.domain}</h2><p>{analysis.summary}</p>
        <div className="score-grid">{scoreOrder.map((key) => {
          const item = analysis.scores?.[key]; const value = item?.score ?? null;
          return <div className="score-cell" key={key}><div className="score-cell-head"><span>{categoryLabel(key, locale)}</span><strong style={{ color:scoreColor(value) }}>{value === null ? "—" : formatNumber(value, locale)}</strong></div><div className="meter"><span style={{ width:`${value ?? 0}%`, background:scoreColor(value) }}/></div><div className="muted" style={{ fontSize:9, marginTop:7 }}>{item?.source === "lighthouse" ? t("sourceLighthouse") : t("measuredRules")}</div></div>;
        })}</div>
      </div>
    </section>

    <section className="report-section"><div className="report-section-head"><div><h2>{t("desktop")} &amp; {t("mobile")}</h2><p>{t("capturedRealBrowser")}</p></div><span className="tag">{t("playwright")}</span></div>
      {analysis.screenshot_available ? <div className="snapshot-grid"><div className="panel snapshot"><div className="snapshot-bar"><span><Eye size={12} style={{ display:"inline", verticalAlign:"middle" }}/> {t("desktop")}</span><span>1440 × 1000</span></div><img src={`/api/backend/analyses/${id}/screenshot/desktop/`} alt={`Desktop screenshot of ${analysis.domain}`} loading="lazy"/></div><div className="panel snapshot"><div className="snapshot-bar"><span><Smartphone size={12} style={{ display:"inline", verticalAlign:"middle" }}/> {t("mobile")}</span><span>390 × 844</span></div><img src={`/api/backend/analyses/${id}/screenshot/mobile/`} alt={`Mobile screenshot of ${analysis.domain}`} loading="lazy"/></div></div> : <div className="panel empty-state"><p>{t("screenshotsUnavailable")}</p></div>}
    </section>

    <section className="report-section"><div className="report-section-head"><h2>{t("performance")} · Lighthouse</h2><span className="tag">{t("googleLighthouse")}</span></div>
      <div className="panel panel-pad"><div className="metric-grid">
        {[{ key:"performance", label:t("performance"), value:analysis.lighthouse?.performance, suffix:"/100" }, { key:"accessibility", label:t("lighthouseAccess"), value:analysis.lighthouse?.accessibility, suffix:"/100" }, { key:"best_practices", label:t("bestPractices"), value:analysis.lighthouse?.best_practices, suffix:"/100" }, { key:"lcp", label:t("largestContent"), value:metrics.lcp?.display, suffix:"" }, { key:"cls", label:t("cumulativeShift"), value:metrics.cls?.display, suffix:"" }, { key:"tbt", label:t("blockingTime"), value:metrics.tbt?.display, suffix:"" }].map((item) => <div className="metric-tile" key={item.key}><span>{item.label}</span><strong>{item.value === undefined || item.value === null ? "—" : `${item.value}${typeof item.value === "number" ? item.suffix : ""}`}</strong></div>)}
      </div>{analysis.lighthouse?.available === false && <p className="field-help" role="note">{analysis.lighthouse.error || t("lighthouseNotAvailable")}</p>}</div>
    </section>

    <section className="report-section"><div className="report-section-head"><div><h2>{t("findings")}</h2><p>{formatNumber(measuredFindings.length, locale)} {t("measuredSignals")} · {formatNumber(aiFindings.length, locale)} {t("aiJudgments")}</p></div><span className="tag">{formatNumber(findings.length, locale)} {t("total").toUpperCase()}</span></div>
      {findings.length ? <div className="finding-list">{findings.map((finding, index) => <FindingItem key={`${finding.code}-${index}`} finding={finding}/>)}</div> : <div className="panel empty-state"><CheckCircle2 size={22} color="var(--good)"/><p>{t("noFindings")}</p></div>}
    </section>

    <section className="report-section two-column">
      <div className="panel panel-pad"><div className="report-section-head"><h2>{t("positives")}</h2><CheckCircle2 size={17} color="var(--good)"/></div>{analysis.positives?.length ? analysis.positives.map((item, i) => <div className="observation" key={`${item}-${i}`}><CheckCircle2 size={15}/><span>{item}</span></div>) : <p className="muted">{t("noPositive")}</p>}</div>
      <div className="panel panel-pad"><div className="report-section-head"><h2>{t("recommendations")}</h2><Sparkles size={17} color="#7c9054"/></div>{analysis.recommendations?.length ? analysis.recommendations.map((item, i) => <div className="observation" key={`${item.title}-${i}`}><ArrowUpRight size={15}/><span><strong>{item.title}</strong><br/>{item.action || item.rationale}</span></div>) : <p className="muted">{t("noRecommendations")}</p>}</div>
    </section>

    <section className="report-section panel panel-pad"><div className="report-section-head"><h2>{t("method")}</h2><ShieldCheck size={17} color="#71875b"/></div><p className="muted" style={{ fontSize:12, lineHeight:1.7, margin:"0 0 10px" }}>{t("scoreNote")}</p><p className="muted" style={{ fontSize:11, lineHeight:1.7, margin:0 }}>{t("wcagHeuristicNote")} {t("reportCreated")} {formatDate(analysis.created_at, locale)}.</p></section>
  </main>;
}
