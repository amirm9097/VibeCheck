import { scoreColor, formatNumber } from "@/lib/format";
import { useLocale } from "./locale-provider";
export function ScoreRing({ score, label, size = 178 }: { score: number | null; label?: string; size?: number }) {
  const { t, locale } = useLocale();
  const accessibleLabel = label || t("score");
  const stroke = size > 170 ? 9 : 7;
  const radius = (size - stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const value = score === null ? 0 : Math.max(0, Math.min(100, score));
  return <div className="score-ring" style={{ width: size, height: size }} role="img" aria-label={`${accessibleLabel}: ${score === null ? t("unavailable") : `${formatNumber(score, locale)} ${t("outOf")} ${formatNumber(100, locale)}`}`}>
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
      <circle cx={size/2} cy={size/2} r={radius} stroke="#e8ece5" strokeWidth={stroke} fill="none"/>
      <circle cx={size/2} cy={size/2} r={radius} stroke={scoreColor(score)} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${circumference * value/100} ${circumference}`} fill="none"/>
    </svg>
    <div className="score-ring-copy"><strong>{score === null ? "—" : formatNumber(score, locale)}</strong><span>{score === null ? t("notScored") : `/ ${formatNumber(100, locale)}`}</span></div>
  </div>;
}
