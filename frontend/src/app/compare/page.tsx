"use client";
import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowUpRight, GitCompareArrows, LoaderCircle, X } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import type { Analysis, Paginated } from "@/lib/types";
import { categoryLabel, formatDate, formatNumber, scoreColor } from "@/lib/format";
import { useLocale } from "@/components/locale-provider";
import { useToast } from "@/components/toast-provider";

type Comparison = { id: string; name: string; created_at: string; analyses: Analysis[]; analysis_ids?: string[]; domains?: string[] };
const scoreKeys = ["visual_design", "user_experience", "responsiveness", "performance", "accessibility", "content_structure"];

export default function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string; comparison?: string }> }) {
  const params = use(searchParams); const { t, locale } = useLocale(); const toast = useToast(); const router = useRouter();
  const [reports, setReports] = useState<Analysis[]>([]); const [history, setHistory] = useState<Comparison[]>([]);
  const [selected, setSelected] = useState<string[]>(params.ids?.split(",").filter(Boolean).slice(0,4) || []);
  const [current, setCurrent] = useState<Comparison | null>(null); const [loading, setLoading] = useState(true); const [creating, setCreating] = useState(false); const [name, setName] = useState(""); const [filter, setFilter] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([apiFetch<Paginated<Analysis>>("analyses/?page_size=100&status=completed"), apiFetch<Comparison[]>("comparisons/")]).then(([a, c]) => {
      if (!alive) return; setReports(a.results); setHistory(c);
    }).catch((e) => { if (e instanceof ApiError && e.status === 401) router.replace("/login?next=%2Fcompare"); else toast(e instanceof Error ? e.message : "Could not load comparisons.", "error"); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [router, toast]);
  useEffect(() => {
    if (!params.comparison) { setCurrent(null); return; }
    let alive = true;
    apiFetch<Comparison>(`comparisons/${params.comparison}/`).then((value) => { if (alive) { setCurrent(value); setSelected(value.analyses.map((a) => a.id)); } }).catch((e) => toast(e instanceof Error ? e.message : "Could not open comparison.", "error"));
    return () => { alive = false; };
  }, [params.comparison, toast]);
  const filteredReports = useMemo(() => reports.filter((r) => !filter || `${r.domain} ${r.url}`.toLowerCase().includes(filter.toLowerCase())), [filter, reports]);
  const chosen = current?.analyses || reports.filter((r) => selected.includes(r.id));
  function toggle(id: string) { setCurrent(null); setSelected((old) => old.includes(id) ? old.filter((x) => x !== id) : old.length < 4 ? [...old, id] : old); }
  async function create() {
    if (selected.length < 2 || selected.length > 4) return;
    setCreating(true);
    try {
      const result = await apiFetch<Comparison>("comparisons/", { method: "POST", body: JSON.stringify({ name, analysis_ids: selected }) });
      setCurrent(result); setHistory((old) => [result, ...old]); router.replace(`/compare?comparison=${result.id}`); toast(t("comparisonCreated"), "success");
    } catch (e) { toast(e instanceof Error ? e.message : "Could not create comparison.", "error"); }
    finally { setCreating(false); }
  }
  async function removeComparison(item: Comparison) {
    if (!window.confirm(t("confirmDeleteComparison"))) return;
    try { await apiFetch<void>(`comparisons/${item.id}/`, { method: "DELETE" }); setHistory((old) => old.filter((x) => x.id !== item.id)); if (current?.id === item.id) { setCurrent(null); setSelected([]); router.replace("/compare"); } toast(t("comparisonDeleted"), "success"); }
    catch (e) { toast(e instanceof Error ? e.message : "Could not delete comparison.", "error"); }
  }
  return <main className="shell page-wrap">
    <div className="page-head"><div><div className="eyebrow">{t("sideBySideReview")}</div><h1>{t("compareTitle")}</h1><p>{t("compareSubtitle")}</p></div><Link href="/dashboard" className="btn btn-outline btn-small"><ArrowLeft size={14}/>{t("backDashboard")}</Link></div>
    <div className="two-column" style={{ alignItems:"start" }}>
      <section className="panel">
        <div className="panel-pad" style={{ borderBottom:"1px solid var(--line)" }}><div className="report-section-head"><h2>{t("chooseReports")}</h2><span className="tag">{formatNumber(selected.length, locale)}/{formatNumber(4, locale)}</span></div><div className="search-field" style={{ width:"100%" }}><input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t("search")}/></div></div>
        {loading ? <div className="empty-state"><LoaderCircle className="animate-spin"/></div> : filteredReports.length ? <div style={{ maxHeight:390, overflowY:"auto" }}>{filteredReports.map((r) => <label key={r.id} style={{ display:"flex", gap:12, alignItems:"center", padding:"13px 17px", borderBottom:"1px solid #edf0eb", cursor:"pointer", background:selected.includes(r.id) ? "#f6f8f0" : "white" }}>
          <input className="check" type="checkbox" checked={selected.includes(r.id)} onChange={() => toggle(r.id)} disabled={!selected.includes(r.id) && selected.length >= 4}/><div style={{ flex:1, minWidth:0 }}><div className="domain-name">{r.domain}</div><div className="muted" style={{ fontSize:10 }}>{formatDate(r.created_at, locale)}</div></div><strong style={{ color:scoreColor(r.overall_score), fontSize:14 }}>{r.overall_score === null ? "—" : formatNumber(r.overall_score, locale)}</strong>
        </label>)}</div> : <div className="empty-state"><p>{t("noCompletedReports")}</p><Link href="/" className="btn btn-primary">{t("runAudit")}</Link></div>}
        {!current && <div className="panel-pad" style={{ borderTop:"1px solid var(--line)" }}><label className="field-label" htmlFor="comparison-name">{t("comparisonNameOptional")}</label><input id="comparison-name" className="input-field" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("comparisonNamePlaceholder")}/><button className="btn btn-primary" style={{ marginTop:12 }} onClick={() => void create()} disabled={selected.length < 2 || creating}>{creating ? <LoaderCircle size={14} className="animate-spin"/> : <GitCompareArrows size={14}/>} {t("createComparison")}</button></div>}
      </section>
      <aside className="panel">
        <div className="panel-pad" style={{ borderBottom:"1px solid var(--line)" }}><h2 style={{ fontSize:15, margin:0 }}>{t("previousComparisons")}</h2></div>
        {history.length ? history.map((item) => <div key={item.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"13px 16px", borderBottom:"1px solid #edf0eb" }}><button onClick={() => router.push(`/compare?comparison=${item.id}`)} style={{ textAlign:"start", flex:1, minWidth:0, background:"transparent", border:0, padding:0 }}><strong style={{ display:"block", fontSize:12 }}>{item.name || item.domains?.join(" × ") || item.analyses?.map((a) => a.domain).join(" × ")}</strong><span className="muted" style={{ fontSize:10 }}>{formatDate(item.created_at, locale)}</span></button><button className="btn btn-ghost btn-small" onClick={() => void removeComparison(item)} aria-label={t("deleteComparison")}><X size={14}/></button></div>) : <div className="panel-pad muted" style={{ fontSize:12 }}>{t("noSavedComparisons")}</div>}
      </aside>
    </div>

    {chosen.length >= 2 && <section className="report-section"><div className="report-section-head"><h2>{current?.name || t("comparisonOverview")}</h2><span className="tag">{formatNumber(chosen.length, locale)} {t("websites").toUpperCase()}</span></div>
      <div className="panel" style={{ overflowX:"auto" }}><table className="data-table" style={{ minWidth:Math.max(690, chosen.length*210+210) }}><thead><tr><th>{t("measure")}</th>{chosen.map((r) => <th key={r.id}><Link href={`/analyses/${r.id}`}>{r.domain}<ArrowUpRight size={12} style={{ display:"inline", marginInlineStart:5 }}/></Link></th>)}</tr></thead><tbody>
        <tr><td><strong>{t("overallVibe")}</strong></td>{chosen.map((r) => <td key={r.id}><strong style={{ color:scoreColor(r.overall_score), fontSize:19 }}>{r.overall_score === null ? "—" : formatNumber(r.overall_score, locale)}</strong><span className="muted"> / 100</span></td>)}</tr>
        {scoreKeys.map((key) => <tr key={key}><td>{categoryLabel(key, locale)}</td>{chosen.map((r) => { const score = r.scores?.[key]?.score ?? null; return <td key={r.id}><span className="score-inline" style={{ color:scoreColor(score) }}>{score === null ? "—" : `${formatNumber(score, locale)}/${formatNumber(100, locale)}`}</span><div className="meter" style={{ marginTop:6, width:130 }}><span style={{ width:`${score ?? 0}%`, background:scoreColor(score) }}/></div></td>; })}</tr>)}
        <tr><td>{t("lighthouseLcp")}</td>{chosen.map((r) => <td key={r.id}>{r.lighthouse?.metrics?.lcp?.display || "—"}</td>)}</tr>
        <tr><td>{t("measuredFindingsLabel")}</td>{chosen.map((r) => <td key={r.id}>{formatNumber(r.findings.filter((f) => f.source === "measurement").length, locale)}</td>)}</tr>
        <tr><td>{t("aiJudgments")}</td>{chosen.map((r) => <td key={r.id}>{formatNumber(r.findings.filter((f) => f.source === "ai_judgment").length, locale)}</td>)}</tr>
      </tbody></table></div>
      <div className="report-section two-column">{chosen.map((r) => <div className="panel panel-pad" key={r.id}><div className="report-section-head"><h3 style={{ margin:0, fontSize:14 }}>{r.domain}</h3><Link href={`/analyses/${r.id}`} className="btn btn-ghost btn-small">{t("openReport")}<ArrowUpRight size={12}/></Link></div><p className="muted" style={{ fontSize:11 }}>{r.summary}</p>{r.screenshot_available && <img src={`/api/backend/analyses/${r.id}/screenshot/desktop/`} alt={`Desktop screenshot of ${r.domain}`} style={{ width:"100%", border:"1px solid var(--line)", borderRadius:5 }}/>}<div className="finding-meta">{r.findings.slice(0,3).map((f,i) => <span key={`${r.id}-${i}`} className="tag">{f.title}</span>)}</div></div>)}</div>
    </section>}
  </main>;
}
