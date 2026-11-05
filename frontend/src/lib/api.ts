import type { ApiErrorBody } from "./types";

export class ApiError extends Error {
  status: number;
  fields?: Record<string, unknown>;
  constructor(message: string, status: number, fields?: Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fields = fields;
  }
}

function getMessage(body: ApiErrorBody): string {
  const raw = body.error?.detail ?? body.detail ?? body;
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return raw.map(String).join(" ");
  if (raw && typeof raw === "object") {
    const entries = Object.entries(raw as Record<string, unknown>);
    return entries.map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`).join(" · ");
  }
  return "Something went wrong. Please try again.";
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path.startsWith("/api/") ? path : `/api/backend/${path.replace(/^\//, "")}`, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
    headers: { ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...init.headers }
  });
  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    const parsed = (body && typeof body === "object" ? body : { detail: body }) as ApiErrorBody;
    const detail = parsed.error?.detail;
    const fields = detail && typeof detail === "object" && !Array.isArray(detail) ? detail as Record<string, unknown> : undefined;
    throw new ApiError(getMessage(parsed), response.status, fields);
  }
  return body as T;
}

export async function apiDownload(path: string, filename: string) {
  const response = await fetch(path.startsWith("/api/") ? path : `/api/backend/${path.replace(/^\//, "")}`, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new ApiError("Could not download this report.", response.status);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.click();
  URL.revokeObjectURL(url);
}
