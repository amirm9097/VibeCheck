import { NextRequest, NextResponse } from "next/server";
import { backendUrl, setSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const registration = await fetch(backendUrl("auth/register/"), { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-Proto": request.headers.get("x-forwarded-proto") || request.nextUrl.protocol.replace(":", "") }, body: JSON.stringify(payload), cache: "no-store" });
    const registrationData = await registration.json();
    if (!registration.ok) return NextResponse.json(registrationData, { status: registration.status });
    const login = await fetch(backendUrl("auth/token/"), { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-Proto": request.headers.get("x-forwarded-proto") || request.nextUrl.protocol.replace(":", "") }, body: JSON.stringify({ email: payload.email, password: payload.password }), cache: "no-store" });
    const sessionData = await login.json();
    if (!login.ok) return NextResponse.json({ detail: "Your account was created. Please sign in." }, { status: 201 });
    await setSession(sessionData.access, sessionData.refresh);
    return NextResponse.json({ user: sessionData.user }, { status: 201 });
  } catch {
    return NextResponse.json({ detail: "Registration service is unavailable." }, { status: 503 });
  }
}
