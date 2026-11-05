export function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US", { maximumFractionDigits: 1 }).format(value);
}
export function formatDate(value: string, locale: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
export function scoreColor(score: number | null) {
  if (score === null) return "var(--muted)";
  if (score >= 85) return "var(--good)";
  if (score >= 65) return "var(--warn)";
  return "var(--bad)";
}
export function categoryLabel(key: string, locale: "en" | "fa" = "en") {
  const labels: Record<string, Record<string, string>> = {
    en: { visual_design: "Visual design", user_experience: "User experience", responsiveness: "Responsiveness", performance: "Performance", accessibility: "Accessibility", content_structure: "Content structure" },
    fa: { visual_design: "طراحی بصری", user_experience: "تجربه کاربری", responsiveness: "واکنش‌گرایی", performance: "عملکرد", accessibility: "دسترس‌پذیری", content_structure: "ساختار محتوا" },
  };
  return labels[locale][key] ?? labels.en[key] ?? key.replaceAll("_", " ");
}
