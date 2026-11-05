"use client";
import { motion } from "framer-motion";
import { Accessibility, Blocks, Eye, Gauge, Globe2, LayoutPanelTop, Smartphone } from "lucide-react";
import { AuditForm } from "@/components/audit-form";
import { useLocale } from "@/components/locale-provider";
import { formatNumber } from "@/lib/format";

export default function HomePage() {
  const { t, locale } = useLocale();
  const lenses = [
    { icon: Eye, title: t("lensVisualTitle"), body: t("lensVisualBody") },
    { icon: Blocks, title: t("lensUxTitle"), body: t("lensUxBody") },
    { icon: Smartphone, title: t("lensResponsiveTitle"), body: t("lensResponsiveBody") },
    { icon: Gauge, title: t("lensPerformanceTitle"), body: t("lensPerformanceBody") },
    { icon: Accessibility, title: t("lensAccessibilityTitle"), body: t("lensAccessibilityBody") },
    { icon: LayoutPanelTop, title: t("lensContentTitle"), body: t("lensContentBody") },
  ];
  const steps = [
    { n: "01", title: t("stepUrlTitle"), body: t("stepUrlBody") },
    { n: "02", title: t("stepMeasureTitle"), body: t("stepMeasureBody") },
    { n: "03", title: t("stepPrioritizeTitle"), body: t("stepPrioritizeBody") },
    { n: "04", title: t("stepTrackTitle"), body: t("stepTrackBody") },
  ];
  const bars: [string, number][] = [[t("visual"),91], [t("ux"),84], [t("responsive"),93], [t("performance"),78], [t("accessibility"),82]];
  return <main>
    <section className="shell hero">
      <div>
        <div className="eyebrow">{t("heroEyebrow")}</div>
        <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .48 }}>{t("heroTitle").split("\n").map((line, i) => <span key={line}>{i === 1 ? <em>{line}</em> : line}{i === 0 ? <br/> : null}</span>)}</motion.h1>
        <motion.p className="hero-copy" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .08, duration: .48 }}>{t("heroText")}</motion.p>
        <AuditForm/>
      </div>
      <motion.div className="hero-stage" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .65, delay: .1 }} aria-label={t("previewAria")}>
        <div className="stage-top"><div className="stage-window"><span/><span/><span/></div><span>{t("previewEyebrow")}</span><span>01—06</span></div>
        <div className="stage-url"><Globe2 size={13}/> studio-north.example <span style={{ marginInlineStart: "auto", color: "#91bd65" }}><span aria-hidden="true">● </span>{t("previewSample")}</span></div>
        <div className="stage-body">
          <div className="stage-score"><span className="sample-tag">{t("previewScoreTag")}</span><div className="score-number">{formatNumber(86, locale)}<span>/{formatNumber(100, locale)}</span></div><p>{t("previewSummary")}</p></div>
          <div className="stage-bars">
            {bars.map(([label, value]) => <div key={label}>
              <div className="stage-bar-label"><span>{label}</span><strong>{formatNumber(value, locale)}</strong></div><div className="stage-bar-track"><div className="stage-bar-fill" style={{ width: `${value}%` }}/></div>
            </div>)}
          </div>
        </div>
        <div className="stage-footer"><span>{t("previewEngine")}</span><strong>{t("previewFooter")}</strong></div>
      </motion.div>
    </section>

    <section className="proof-section" id="product"><div className="shell">
      <div className="section-heading"><div className="eyebrow">{t("practicalAudit")}</div><h2>{t("proofTitle")}</h2><p>{t("proofText")}</p></div>
      <div className="lens-grid">{lenses.map((item, index) => <motion.article className="lens-item" key={item.title} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-30px" }} transition={{ delay: index * .045 }}>
        <div className="lens-num">0{index + 1} <item.icon size={16} style={{ display: "inline", marginInlineStart: 8, verticalAlign: "middle" }}/></div><h3>{item.title}</h3><p>{item.body}</p>
      </motion.article>)}</div>
    </div></section>

    <section className="shell" id="how-it-works" style={{ padding: "12px 0 78px" }}>
      <div className="section-heading"><div className="eyebrow">{t("fromUrlToAction")}</div><h2>{t("fourStepsTitle")}</h2></div>
      <div className="two-column">
        {steps.map((step) => <div key={step.n} style={{ display:"flex", gap:16, padding:"17px 0", borderBottom:"1px solid var(--line)" }}><span style={{ color:"#80916e", fontSize:11, fontWeight:800 }}>{step.n}</span><div><h3 style={{ margin:"0 0 5px", fontSize:14 }}>{step.title}</h3><p style={{ margin:0, color:"var(--ink-soft)", fontSize:12, maxWidth:410 }}>{step.body}</p></div></div>)}
      </div>
    </section>
  </main>;
}
