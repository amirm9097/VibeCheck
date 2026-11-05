import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { backendUrl, setSession, clearSession } from "@/lib/session";

type RouteContext = { params: Promise<{ path: string[] }> };
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"] as const;
type Method = typeof METHODS[number];

async function refreshAccess(refresh: string, forwardedProto: string): Promise<{ access: string; refresh?: string } | null> {
  try {
    const response = await fetch(backendUrl("auth/token/refresh/"), { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-Proto": forwardedProto }, body: JSON.stringify({ refresh }), cache: "no-store" });
    if (!response.ok) return null;
    return await response.json();
  } catch { return null; }
}

async function proxy(request: NextRequest, context: RouteContext, method: Method) {
  const { path } = await context.params;
  const encodedPath = path.map((part) => encodeURIComponent(part)).join("/");
  const backendPath = `${encodedPath.replace(/\/+$/, "")}/`;
  const url = `${backendUrl(backendPath)}${request.nextUrl.search}`;
  const jar = await cookies();
  let access = jar.get("vc_access")?.value || "";
  const refresh = jar.get("vc_refresh")?.value || "";
  const body = method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer();
  const send = (token: string) => {
    const headers = new Headers();
    const type = request.headers.get("content-type");
    const accept = request.headers.get("accept");
    if (type) headers.set("Content-Type", type);
    if (accept) headers.set("Accept", accept);
    headers.set("X-Forwarded-Proto", request.headers.get("x-forwarded-proto") || request.nextUrl.protocol.replace(":", ""));
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(url, { method, headers, body, cache: "no-store", redirect: "manual" });
  };
  let upstream: Response;
  try { upstream = await send(access); }
  catch { return NextResponse.json({ detail: "The API service could not be reached." }, { status: 502 }); }
  let rotated: { access: string; refresh?: string } | null = null;
  if (upstream.status === 401 && refresh) {
    rotated = await refreshAccess(refresh, request.headers.get("x-forwarded-proto") || request.nextUrl.protocol.replace(":", ""));
    if (rotated?.access) {
      access = rotated.access;
      try { upstream = await send(access); }
      catch { return NextResponse.json({ detail: "The API service could not be reached." }, { status: 502 }); }
    } else {
      await clearSession();
    }
  }
  const headers = new Headers();
  for (const key of ["content-type", "content-disposition", "cache-control", "etag", "last-modified"]) {
    const value = upstream.headers.get(key);
    if (value) headers.set(key, value);
  }
  headers.set("Cache-Control", "no-store");
  const payload = method === "HEAD" ? null : await upstream.arrayBuffer();
  const response = new NextResponse(payload, { status: upstream.status, headers });
  if (rotated?.access) {
    // Preserve the current refresh token when rotation is disabled by the backend response.
    await setSession(rotated.access, rotated.refresh || refresh);
  }
  return response;
}

export async function GET(req: NextRequest, ctx: RouteContext) { return proxy(req, ctx, "GET"); }
export async function POST(req: NextRequest, ctx: RouteContext) { return proxy(req, ctx, "POST"); }
export async function PUT(req: NextRequest, ctx: RouteContext) { return proxy(req, ctx, "PUT"); }
export async function PATCH(req: NextRequest, ctx: RouteContext) { return proxy(req, ctx, "PATCH"); }
export async function DELETE(req: NextRequest, ctx: RouteContext) { return proxy(req, ctx, "DELETE"); }
export async function HEAD(req: NextRequest, ctx: RouteContext) { return proxy(req, ctx, "HEAD"); }
