"use client";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Bookmark, ChevronLeft, ChevronRight, Clock3, Heart, LoaderCircle, Plus, Search, Trash2 } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import type { Analysis, Paginated, User } from "@/lib/types";
import { formatDate, formatNumber, scoreColor } from "@/lib/format";
import { useLocale } from "@/components/locale-provider";
import { useToast } from "@/components/toast-provider";

 type SavedWebsite = { id: string; url: string; domain: string; label: string; created_at: string };
const statusKeys = ["", "queued", "running", "completed", "failed"] as const;

function StatusPill({ status }: { status: Analysis["status"] }) {
  const { t } = useLocale();
  return <span className={`status status-${status}`}>{t(status)}</span>;
}

export default function DashboardPage() {
  const { t, locale } = useLocale(); const toast = useToast(); const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<"analyses" | "saved">("analyses");
  const [data, setData] = useState<Paginated<Analysis> | null>(null);
  const [saved, setSaved] = useState<SavedWebsite[]>([]);
  const [loading, setLoading] = useState(true); const [savedLoading, setSavedLoading] = useState(false);
  const [search, setSearch] = useState(""); const [status, setStatus] = useState<(typeof statusKeys)[number]>("");
  const [favoritesOnly, setFavoritesOnly] = useState(false); const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [adding, setAdding] = useState(false); const [newUrl, setNewUrl] = useState(""); const [newLabel, setNewLabel] = useState(""); const [addError, setAddError] = useState("");

  useEffect(() => { apiFetch<User>("auth/me/").then(setUser).catch(() => router.replace("/login?next=%2Fdashboard")); }, [router]);
  const loadAnalyses = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), page_size: "20", ordering: "-created_at" });
    if (status) params.set("status", status);
    if (search.trim()) params.set("search", search.trim());
    if (favoritesOnly) params.set("is_favorite", "true");
    try { const result = await apiFetch<Paginated<Analysis>>(`analyses/?${params.toString()}`); setData(result); }
    catch (error) { if (error instanceof ApiError && error.status === 401) router.replace("/login?next=%2Fdashboard"); else toast(error instanceof Error ? error.message : "Could not load report history.", "error"); }
    finally { setLoading(false); }
  }, [favoritesOnly, page, router, search, status, t, toast]);
  useEffect(() => { if (tab === "analyses") void loadAnalyses(); }, [loadAnalyses, tab]);
  useEffect(() => {
    if (tab !== "saved") return;
    setSavedLoading(true);
    apiFetch<Paginated<SavedWebsite>>("saved-websites/").then((response) => setSaved(response.results)).catch((e) => toast(e instanceof Error ? e.message : "Could not load saved websites.", "error")).finally(() => setSavedLoading(false));
  }, [tab, t, toast]);
  const completedOnPage = useMemo(() => data?.results.filter((a) => a.status === "completed").length ?? 0, [data]);

  async function toggleFavorite(analysis: Analysis) {
    try {
      await apiFetch<Analysis>(`analyses/${analysis.id}/`, { method: "PATCH", body: JSON.stringify({ is_favorite: !analysis.is_favorite }) });
      setData((old) => old ? { ...old, results: old.results.map((a) => a.id === analysis.id ? { ...a, is_favorite: !a.is_favorite } : a) } : old);
      toast(analysis.is_favorite ? t("favoriteRemoved") : t("favoriteAdded"), "success");
    } catch (e) { toast(e instanceof Error ? e.message : "Could not update favorite.", "error"); }
  }
  async function addSaved(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setAddError("");
    try {
      const item = await apiFetch<SavedWebsite>("saved-websites/", { method: "POST", body: JSON.stringify({ url: newUrl, label: newLabel }) });
      setSaved((old) => [item, ...old]); setNewUrl(""); setNewLabel(""); setAdding(false); toast(t("websiteSaved"), "success");
    } catch (e) { setAddError(e instanceof Error ? e.message : "Could not save this website."); }
  }
  async function deleteSaved(item: SavedWebsite) {
    if (!window.confirm(`${t("confirmRemoveSite")} (${item.domain})`)) return;
    try { await apiFetch<void>(`saved-websites/${item.id}/`, { method: "DELETE" }); setSaved((old) => old.filter((x) => x.id !== item.id)); toast(t("websiteRemoved"), "success"); }
    catch (e) { toast(e instanceof Error ? e.message : "Could not remove this website.", "error"); }
  }
  async function runSaved(item: SavedWebsite) {
    try { const a = await apiFetch<Analysis>("analyses/", { method: "POST", body: JSON.stringify({ url: item.url }) }); router.push(`/analyses/${a.id}`); }
    catch (e) { toast(e instanceof Error ? e.message : "Could not start the analysis.", "error"); }
  }
  const toggleSelected = (id: string) => setSelected((old) => old.includes(id) ? old.filter((x) => x !== id) : old.length < 4 ? [...old, id] : old);

  return <main className="shell page-wrap">
    <div className="page-head"><div><div className="eyebrow">{user?.display_name ? `${t("workspaceGreeting")}, ${user.display_name.toUpperCase()}` : t("yourWorkspace")}</div><h1>{t("dashboardTitle")}</h1><p>{t("dashboardSubtitle")}</p></div><Link href="/#product" className="btn btn-primary"><Plus size={15}/>{t("runAudit")}</Link></div>
    <div className="panel">
      <div className="tab-row">
        <button className={`tab-button ${tab === "analyses" ? "active" : ""}`} onClick={() => setTab("analyses")}>{t("analyses")}{data ? <span className="muted"> · {formatNumber(data.count, locale)}</span> : null}</button>
        <button className={`tab-button ${tab === "saved" ? "active" : ""}`} onClick={() => setTab("saved")}>{t("savedSites")}</button>
        <Link className="tab-button" href="/compare">{t("comparisons")} <ArrowUpRight size={12} style={{ display:"inline", verticalAlign:"middle" }}/></Link>
      </div>
      {tab === "analyses" ? <>
        <div className="toolbar">
          <div className="search-field"><Search size={15} className="muted"/><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={t("search")}/></div>
          <select className="select-field" style={{ width:"auto", minWidth:140, minHeight:38 }} value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setPage(1); }} aria-label={t("allStatuses")}>
            {statusKeys.map((s) => <option key={s} value={s}>{s ? t(s) : t("all")}</option>)}
          </select>
          <button className={`btn btn-small ${favoritesOnly ? "btn-primary" : "btn-outline"}`} onClick={() => { setFavoritesOnly((v) => !v); setPage(1); }}><Heart size={13} fill={favoritesOnly ? "currentColor" : "none"}/>{t("favorites")}</button>
          {selected.length > 0 && <button className="btn btn-lime btn-small" onClick={() => router.push(`/compare?ids=${selected.join(",")}`)} disabled={selected.length < 2}>{t("compareSelected")} · {formatNumber(selected.length, locale)}</button>}
        </div>
        {loading ? <div className="empty-state"><LoaderCircle className="animate-spin" size={24}/><p>{t("loading")}</p></div> : data?.results.length ? <>
          <div className="table-wrap"><table className="data-table"><thead><tr><th style={{ width:35 }}></th><th>{t("website")}</th><th>{t("status")}</th><th>{t("scoreLabel")}</th><th>{t("created")}</th><th>{t("actions")}</th></tr></thead>
            <tbody>{data.results.map((analysis) => <tr key={analysis.id}>
              <td>{analysis.status === "completed" ? <input className="check" type="checkbox" checked={selected.includes(analysis.id)} onChange={() => toggleSelected(analysis.id)} aria-label={`${t("selectReportForCompare")}: ${analysis.domain}`}/> : null}</td>
              <td><Link className="domain-name" href={`/analyses/${analysis.id}`}>{analysis.domain}</Link><div className="muted" style={{ fontSize:10, maxWidth:270, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{analysis.title || analysis.normalized_url}</div></td>
              <td><StatusPill status={analysis.status}/></td>
              <td><span className="score-inline" style={{ color:scoreColor(analysis.overall_score) }}><span className="score-dot"/>{analysis.overall_score === null ? "—" : `${formatNumber(analysis.overall_score, locale)}/${formatNumber(100, locale)}`}</span></td>
              <td className="muted">{formatDate(analysis.created_at, locale)}</td>
              <td><div style={{ display:"flex", alignItems:"center", gap:5 }}><Link className="btn btn-outline btn-small" href={`/analyses/${analysis.id}`}>{t("openReport")}<ArrowUpRight size={12}/></Link><button className="btn btn-ghost btn-small" onClick={() => void toggleFavorite(analysis)} aria-label={analysis.is_favorite ? t("unfavorite") : t("favorite")} title={analysis.is_favorite ? t("unfavorite") : t("favorite")}><Heart size={15} fill={analysis.is_favorite ? "#536e43" : "none"}/></button></div></td>
            </tr>)}</tbody></table></div>
          <div className="pagination"><span>{formatNumber(data.count, locale)} {t("reports")} · {formatNumber(completedOnPage, locale)} {t("completedOnPage")}</span><div style={{ display:"flex", alignItems:"center", gap:8 }}><button className="btn btn-outline btn-small" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={!data.previous}><ChevronLeft size={13}/>{t("previous")}</button><span>{t("page")} {formatNumber(page, locale)} {t("of")} {formatNumber(Math.max(1, Math.ceil(data.count / 20)), locale)}</span><button className="btn btn-outline btn-small" onClick={() => setPage((p) => p + 1)} disabled={!data.next}>{t("next")}<ChevronRight size={13}/></button></div></div>
        </> : <div className="empty-state"><div className="empty-icon"><Clock3 size={19}/></div><h3>{search || status || favoritesOnly ? t("searchEmpty") : t("noAnalyses")}</h3><p>{search || status || favoritesOnly ? t("allCaught") : t("noAnalysesText")}</p>{!search && !status && !favoritesOnly && <Link href="/" className="btn btn-primary">{t("runAudit")}<ArrowUpRight size={14}/></Link>}</div>}
      </> : <>
        <div className="toolbar" style={{ justifyContent:"space-between" }}><span className="muted" style={{ fontSize:12 }}>{t("savedSitesNote")}</span><button className="btn btn-primary btn-small" onClick={() => setAdding((v) => !v)}><Plus size={14}/>{t("saveSite")}</button></div>
        {adding && <form className="panel-pad" onSubmit={addSaved} style={{ borderBottom:"1px solid var(--line)", background:"#fbfcf9" }}><div className="two-column"><div><label className="field-label" htmlFor="saved-url">{t("websiteLabel")}</label><input id="saved-url" className="input-field" type="text" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://example.com" required/></div><div><label className="field-label" htmlFor="saved-label">{t("labelOptional")}</label><input id="saved-label" className="input-field" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} maxLength={120}/></div></div>{addError && <div className="field-error">{addError}</div>}<div style={{ display:"flex", gap:8, marginTop:14 }}><button className="btn btn-primary btn-small" type="submit">{t("save")}</button><button className="btn btn-ghost btn-small" type="button" onClick={() => { setAdding(false); setAddError(""); }}>{t("cancel")}</button></div></form>}
        {savedLoading ? <div className="empty-state"><LoaderCircle className="animate-spin" size={24}/></div> : saved.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>{t("website")}</th><th>{t("created")}</th><th>{t("actions")}</th></tr></thead><tbody>{saved.map((item) => <tr key={item.id}><td><div className="domain-name">{item.label || item.domain}</div><div className="muted">{item.url}</div></td><td className="muted">{formatDate(item.created_at, locale)}</td><td><div style={{ display:"flex", gap:5 }}><button className="btn btn-primary btn-small" onClick={() => void runSaved(item)}>{t("analyze")}<ArrowUpRight size={12}/></button><button className="btn btn-ghost btn-small" onClick={() => void deleteSaved(item)} aria-label={`${t("remove")} ${item.domain}`}><Trash2 size={14}/></button></div></td></tr>)}</tbody></table></div> : <div className="empty-state"><div className="empty-icon"><Bookmark size={19}/></div><h3>{t("noSaved")}</h3><p>{t("noSavedText")}</p><button className="btn btn-primary" onClick={() => setAdding(true)}><Plus size={14}/>{t("saveSite")}</button></div>}
      </>}
    </div>
  </main>;
}
