import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { LocaleProvider } from "@/components/locale-provider";
import { ToastProvider } from "@/components/toast-provider";
import { TopNav } from "@/components/top-nav";
import { Footer } from "@/components/footer";

export const metadata: Metadata = {
  title: { default: "VibeCheck — Website Quality Intelligence", template: "%s · VibeCheck" },
  description: "A considered website audit for visual design, UX, responsive behavior, accessibility and Lighthouse performance.",
  applicationName: "VibeCheck",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f5f5ef" };
export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en" dir="ltr"><body><LocaleProvider><ToastProvider><TopNav/>{children}<Footer/></ToastProvider></LocaleProvider></body></html>;
}
