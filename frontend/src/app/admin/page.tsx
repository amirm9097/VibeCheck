"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, AlertTriangle, CheckCircle2, ChevronRight, LoaderCircle, RefreshCw, Save, ShieldCheck, SlidersHorizontal, Users } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import type { Paginated, User } from "@/lib/types";
import { formatDate, formatNumber, scoreColor } from "@/lib/format";
import { useLocale } from "@/components/locale-provider";
import { useToast } from "@/components/toast-provider";

type Overview = { users: number; analyses_total: number; analyses_24h: number; queued: number; running: number; failed: number; completed: number; average_score: number | null };
type AdminJob = { id: string; url: string; domain: string; status: string; user_email: string; created_at: string; error_message: string; overall_score: number | null };
type AdminUser = { id: number; email: string; display_name: string; role: "user" | "admin"; is_active: boolean; date_joined: string; analysis_count: number };
type AdminSettings = { ai: { provider: string; base_url: string; model: string; enabled: boolean; api_key_configured: boolean }; usage: { daily_analysis_limit: number; max_comparison_sites: number; allow_public_shares: boolean } };
type Tab = "jobs" | "users" | "settings";

export default function AdminPage() {
  const { t, locale } = useLocale(); const toast = useToast(); const router = useRouter();
  const [user, setUser] = useState<User | null>(null); const [access, setAccess] = useState<"checking" | "allowed" | "denied">("checking");
  const [tab, setTab] = useState<Tab>("jobs"); const [overview, setOverview] = useState<Overview | null>(null);
  const [jobs, setJobs] = useState<AdminJob[]>([]); const [users, setUsers] = useState<AdminUser[]>([]); const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [jobsCount, setJobsCount] = useState(0); const [usersCount, setUsersCount] = useState(0);
  const [jobsPage, setJobsPage] = useState(1); const [usersPage, setUsersPage] = useState(1);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [jobFilter, setJobFilter] = useState("failed"); const [userSearch, setUserSearch] = useState("");
  const [apiKey, setApiKey] = useState(""); const [settingsError, setSettingsError] = useState("");

  useEffect(() => {
    let alive = true;
    apiFetch<User>("auth/me/").then((u) => { if (!alive) return; setUser(u); if (u.role !== "admin") setAccess("denied"); else setAccess("allowed"); }).catch((e) => { if (alive) { setAccess("denied"); if (e instanceof ApiError && e.status === 401) router.replace("/login?next=%2Fadmin"); } });
    return () => { alive = false; };
  }, [router]);
  const loadAdminData = useCallback(async () => {
    setLoading(true);
    try {
      const [o, j, u, s] = await Promise.all([
        apiFetch<Overview>("admin/overview/"),
        apiFetch<Paginated<AdminJob>>(`admin/analyses/?page=${jobsPage}&status=${encodeURIComponent(jobFilter)}`),
        apiFetch<Paginated<AdminUser>>(`admin/users/?page=${usersPage}&q=${encodeURIComponent(userSearch.trim())}`),
        apiFetch<AdminSettings>("admin/settings/")
      ]);
      setOverview(o); setJobs(j.results); setJobsCount(j.count); setUsers(u.results); setUsersCount(u.count); setSettings(s);
    } catch (e) { toast(e instanceof Error ? e.message : "Could not load the administration workspace.", "error"); }
    finally { setLoading(false); }
  }, [jobFilter, jobsPage, toast, userSearch, usersPage]);
  useEffect(() => { if (access === "allowed") void loadAdminData(); }, [access, loadAdminData]);
  async function retryJob(id: string) {
    try { await apiFetch(`admin/analyses/${id}/retry/`, { method: "POST" }); toast(t("queued"), "success"); await loadAdminData(); }
    catch (e) { toast(e instanceof Error ? e.message : "Could not retry this job.", "error"); }
  }
  async function updateUser(item: AdminUser, patch: Partial<Pick<AdminUser, "is_active" | "role">>) {
    if (patch.is_active === false && !window.confirm(`${t("disable")} ${item.email}? ${t("disableUserConfirm")}`)) return;
    try { await apiFetch(`admin/users/${item.id}/`, { method: "PATCH", body: JSON.stringify(patch) }); toast(t("userUpdated"), "success"); await loadAdminData(); }
    catch (e) { toast(e instanceof Error ? e.message : "Could not update this user.", "error"); }
  }
  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!settings) return; setSaving(true); setSettingsError("");
    const ai: Record<string, unknown> = { provider: settings.ai.provider, base_url: settings.ai.base_url, model: settings.ai.model, enabled: settings.ai.enabled };
    if (apiKey.trim()) ai.api_key = apiKey.trim();
    try {
      const updated = await apiFetch<AdminSettings>("admin/settings/", { method: "PUT", body: JSON.stringify({ ai, usage: settings.usage }) });
      setSettings(updated); setApiKey(""); toast(t("settingsSaved"), "success");
    } catch (e) { setSettingsError(e instanceof Error ? e.message : "Could not save settings."); }
    finally { setSaving(false); }
  }
  if (access === "checking" || loading && access === "allowed") return <main className="shell page-wrap"><div className="empty-state"><LoaderCircle className="animate-spin" size={24}/><p>{t("loading")}</p></div></main>;
  if (access === "denied") return <main className="shell page-wrap"><div className="empty-state"><div className="empty-icon"><ShieldCheck size={20}/></div><h2>{t("noAccess")}</h2><Link href="/dashboard" className="btn btn-primary">{t("backDashboard")}</Link></div></main>;

  const visibleJobs = jobs;
  const visibleUsers = users;
  const jobPageCount = Math.max(1, Math.ceil(jobsCount / 25));
  const userPageCount = Math.max(1, Math.ceil(usersCount / 25));
  return <main className="shell page-wrap">
    <div className="page-head"><div><div className="eyebrow">{t("admin")} · {user?.email}</div><h1>{t("adminTitle")}</h1><p>{t("adminSubtitle")}</p></div><button className="btn btn-outline btn-small" onClick={() => void loadAdminData()}><RefreshCw size={14}/>{t("refreshData")}</button></div>
    {overview && <div className="admin-stat-grid">
      {[{ label:t("totalUsers"), value:overview.users, icon:Users }, { label:t("totalAnalyses"), value:overview.analyses_total, icon:Activity }, { label:t("avgScore"), value:overview.average_score === null ? "—" : `${overview.average_score}/100`, icon:CheckCircle2 }, { label:t("failures"), value:overview.failed, icon:AlertTriangle }].map((item) => <div className="stat-card" key={item.label}><div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}><span>{item.label}</span><item.icon size={15} color="#7c8c69"/></div><strong>{item.value}</strong></div>)}
    </div>}
    <div className="panel">
      <div className="tab-row"><button onClick={() => setTab("jobs")} className={`tab-button ${tab === "jobs" ? "active" : ""}`}><Activity size={13} style={{ display:"inline", verticalAlign:"middle", marginInlineEnd:5 }}/>{t("jobs")}</button><button onClick={() => setTab("users")} className={`tab-button ${tab === "users" ? "active" : ""}`}><Users size={13} style={{ display:"inline", verticalAlign:"middle", marginInlineEnd:5 }}/>{t("users")}</button><button onClick={() => setTab("settings")} className={`tab-button ${tab === "settings" ? "active" : ""}`}><SlidersHorizontal size={13} style={{ display:"inline", verticalAlign:"middle", marginInlineEnd:5 }}/>{t("settings")}</button></div>
      {tab === "jobs" && <>
        <div className="toolbar"><div className="muted" style={{ fontSize:12, flex:1 }}>{t("volume24h")}: {overview?.analyses_24h ?? 0} · {overview?.queued ?? 0} {t("queuedCount")} · {overview?.running ?? 0} {t("runningCount")}</div><select className="select-field" aria-label={t("allStatuses")} style={{ width:"auto", minHeight:36 }} value={jobFilter} onChange={(e) => { setJobsPage(1); setJobFilter(e.target.value); }}><option value="">{t("allStatuses")}</option><option value="queued">{t("queued")}</option><option value="running">{t("running")}</option><option value="completed">{t("completed")}</option><option value="failed">{t("failed")}</option></select></div>
        <div className="table-wrap"><table className="data-table"><thead><tr><th>{t("websiteOwner")}</th><th>{t("status")}</th><th>{t("scoreLabel")}</th><th>{t("created")}</th><th>{t("actions")}</th></tr></thead><tbody>{visibleJobs.map((j) => <tr key={j.id}><td><div className="domain-name">{j.domain}</div><div className="muted">{j.user_email}</div></td><td><span className={`status status-${j.status}`}>{t(j.status)}</span>{j.error_message && <div className="field-error">{j.error_message}</div>}</td><td><strong style={{ color:scoreColor(j.overall_score) }}>{j.overall_score ?? "—"}</strong></td><td className="muted">{formatDate(j.created_at, locale)}</td><td><div style={{ display:"flex", gap:6 }}>{j.status === "completed" && <Link className="btn btn-outline btn-small" href={`/analyses/${j.id}`}>{t("openReport")}<ChevronRight size={12}/></Link>}{j.status === "failed" && <button className="btn btn-outline btn-small" onClick={() => void retryJob(j.id)}><RefreshCw size={12}/>{t("retryJob")}</button>}</div></td></tr>)}</tbody></table></div>
        {!visibleJobs.length && <div className="empty-state"><p>{t("noJobsMatch")}</p></div>}
        <div className="toolbar" style={{ justifyContent:"space-between", borderTop:"1px solid var(--line)", borderBottom:0 }}><span className="muted" style={{ fontSize:11 }}>{jobsCount ? `${(jobsPage - 1) * 25 + 1}–${Math.min(jobsPage * 25, jobsCount)} / ${jobsCount}` : "0"}</span><div style={{ display:"flex", gap:7 }}><button className="btn btn-outline btn-small" onClick={() => setJobsPage((p) => Math.max(1, p - 1))} disabled={jobsPage <= 1}>{t("previous")}</button><span className="muted" style={{ alignSelf:"center", fontSize:11 }}>{t("page")} {jobsPage} {t("of")} {jobPageCount}</span><button className="btn btn-outline btn-small" onClick={() => setJobsPage((p) => Math.min(jobPageCount, p + 1))} disabled={jobsPage >= jobPageCount}>{t("next")}</button></div></div>
      </>}
      {tab === "users" && <>
        <div className="toolbar"><div className="search-field"><Users size={14}/><input value={userSearch} onChange={(e) => { setUsersPage(1); setUserSearch(e.target.value); }} placeholder={t("searchByUser")}/></div><span className="muted" style={{ fontSize:11 }}>{usersCount} {t("users")}</span></div>
        <div className="table-wrap"><table className="data-table"><thead><tr><th>{t("account")}</th><th>{t("role")}</th><th>{t("analyses")}</th><th>{t("status")}</th><th>{t("actions")}</th></tr></thead><tbody>{visibleUsers.map((item) => <tr key={item.id}><td><div className="domain-name">{item.display_name || item.email}</div><div className="muted">{item.email} · {formatDate(item.date_joined, locale)}</div></td><td><select className="select-field" style={{ width:110, minHeight:32 }} value={item.role} onChange={(e) => void updateUser(item, { role:e.target.value as "user" | "admin" })}><option value="user">{t("userRole")}</option><option value="admin">{t("adminRole")}</option></select></td><td>{formatNumber(item.analysis_count, locale)}</td><td><span className={`status ${item.is_active ? "status-completed" : "status-failed"}`}>{item.is_active ? t("active") : t("disabled")}</span></td><td><button className={`btn btn-small ${item.is_active ? "btn-danger" : "btn-outline"}`} onClick={() => void updateUser(item, { is_active:!item.is_active })}>{item.is_active ? t("disable") : t("enable")}</button></td></tr>)}</tbody></table></div>
        {!visibleUsers.length && <div className="empty-state"><p>{t("searchEmpty")}</p></div>}
        <div className="toolbar" style={{ justifyContent:"space-between", borderTop:"1px solid var(--line)", borderBottom:0 }}><span className="muted" style={{ fontSize:11 }}>{usersCount ? `${(usersPage - 1) * 25 + 1}–${Math.min(usersPage * 25, usersCount)} / ${usersCount}` : "0"}</span><div style={{ display:"flex", gap:7 }}><button className="btn btn-outline btn-small" onClick={() => setUsersPage((p) => Math.max(1, p - 1))} disabled={usersPage <= 1}>{t("previous")}</button><span className="muted" style={{ alignSelf:"center", fontSize:11 }}>{t("page")} {usersPage} {t("of")} {userPageCount}</span><button className="btn btn-outline btn-small" onClick={() => setUsersPage((p) => Math.min(userPageCount, p + 1))} disabled={usersPage >= userPageCount}>{t("next")}</button></div></div>
      </>}
      {tab === "settings" && settings && <form className="panel-pad" onSubmit={saveSettings}>
        <div className="settings-grid">
          <section><div className="report-section-head"><h2 style={{ fontSize:16 }}>{t("platform")}</h2><ShieldCheck size={17}/></div>
            <div style={{ marginBottom:14 }}><label className="field-label" htmlFor="daily-limit">{t("dailyLimit")}</label><input id="daily-limit" className="input-field" type="number" min={1} max={500} value={settings.usage.daily_analysis_limit} onChange={(e) => setSettings({ ...settings, usage:{ ...settings.usage, daily_analysis_limit:Number(e.target.value) } })}/></div>
            <div style={{ marginBottom:14 }}><label className="field-label" htmlFor="max-sites">{t("maxSites")}</label><input id="max-sites" className="input-field" type="number" min={2} max={4} value={settings.usage.max_comparison_sites} onChange={(e) => setSettings({ ...settings, usage:{ ...settings.usage, max_comparison_sites:Number(e.target.value) } })}/></div>
            <label style={{ display:"flex", gap:9, alignItems:"center", fontSize:12 }}><input type="checkbox" className="check" checked={settings.usage.allow_public_shares} onChange={(e) => setSettings({ ...settings, usage:{ ...settings.usage, allow_public_shares:e.target.checked } })}/>{t("publicSharing")}</label>
          </section>
          <section><div className="report-section-head"><h2 style={{ fontSize:16 }}>{t("aiProvider")}</h2><SparklesPlaceholder/></div>
            <div style={{ marginBottom:13 }}><label className="field-label" htmlFor="provider-url">{t("apiBaseUrl")}</label><input id="provider-url" className="input-field" type="url" required value={settings.ai.base_url} onChange={(e) => setSettings({ ...settings, ai:{ ...settings.ai, base_url:e.target.value } })}/></div>
            <div style={{ marginBottom:13 }}><label className="field-label" htmlFor="provider-model">{t("model")}</label><input id="provider-model" className="input-field" required maxLength={120} value={settings.ai.model} onChange={(e) => setSettings({ ...settings, ai:{ ...settings.ai, model:e.target.value } })}/></div>
            <div style={{ marginBottom:13 }}><label className="field-label" htmlFor="provider-key">{t("apiKey")}</label><input id="provider-key" className="input-field" type="password" autoComplete="new-password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={settings.ai.api_key_configured ? t("providerKeyHint") : t("providerKeyPlaceholder")}/><div className="field-help">{t("apiKeySecurity")}</div></div>
            <label style={{ display:"flex", gap:9, alignItems:"center", fontSize:12 }}><input type="checkbox" className="check" checked={settings.ai.enabled} onChange={(e) => setSettings({ ...settings, ai:{ ...settings.ai, enabled:e.target.checked } })}/>{t("enabled")}</label>
          </section>
        </div>
        {settingsError && <div className="field-error" role="alert">{settingsError}</div>}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, borderTop:"1px solid var(--line)", marginTop:22, paddingTop:17 }}><span className="muted" style={{ fontSize:11 }}>{t("providerNote")}</span><button className="btn btn-primary" type="submit" disabled={saving}>{saving ? <LoaderCircle size={14} className="animate-spin"/> : <Save size={14}/>} {t("saveSettings")}</button></div>
      </form>}
    </div>
  </main>;
}
function SparklesPlaceholder() { return <span className="tag">OPENAI-COMPATIBLE</span>; }
