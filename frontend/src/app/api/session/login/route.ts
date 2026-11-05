import { NextRequest, NextResponse } from "next/server";
import { backendUrl, setSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const upstream = await fetch(backendUrl("auth/token/"), { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-Proto": request.headers.get("x-forwarded-proto") || request.nextUrl.protocol.replace(":", "") }, body: JSON.stringify(payload), cache: "no-store" });
    const data = await upstream.json();
    if (!upstream.ok) return NextResponse.json(data, { status: upstream.status });
    await setSession(data.access, data.refresh);
    return NextResponse.json({ user: data.user });
  } catch {
    return NextResponse.json({ detail: "Authentication service is unavailable." }, { status: 503 });
  }
}
