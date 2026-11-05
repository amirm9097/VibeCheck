import { cookies } from "next/headers";

const secure = process.env.AUTH_COOKIE_SECURE ? process.env.AUTH_COOKIE_SECURE === "true" : process.env.NODE_ENV === "production";
const common = { httpOnly: true, secure, sameSite: "lax" as const, path: "/" };

export async function setSession(access: string, refresh: string) {
  const jar = await cookies();
  const accessMinutes = Math.max(1, Number.parseInt(process.env.JWT_ACCESS_MINUTES || "15", 10) || 15);
  const refreshDays = Math.max(1, Number.parseInt(process.env.JWT_REFRESH_DAYS || "7", 10) || 7);
  jar.set("vc_access", access, { ...common, maxAge: accessMinutes * 60 });
  jar.set("vc_refresh", refresh, { ...common, maxAge: refreshDays * 24 * 60 * 60 });
}
export async function clearSession() {
  const jar = await cookies();
  jar.set("vc_access", "", { ...common, maxAge: 0 });
  jar.set("vc_refresh", "", { ...common, maxAge: 0 });
}
export function backendUrl(path: string) {
  const base = (process.env.BACKEND_INTERNAL_URL || "http://api:8000").replace(/\/$/, "");
  return `${base}/api/v1/${path.replace(/^\//, "")}`;
}
