"use client";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type Locale = "en" | "fa";
type LocaleContextValue = { locale: Locale; dir: "ltr" | "rtl"; toggle: () => void; t: (key: string) => string };
const messages: Record<Locale, Record<string, string>> = {
  en: {
    product: "Product", howItWorks: "How it works", pricing: "Plans", dashboard: "Dashboard", compare: "Compare",
    signIn: "Sign in", createAccount: "Create account", signOut: "Sign out", runAudit: "Run an audit",
    heroEyebrow: "WEBSITE QUALITY INTELLIGENCE", heroTitle: "Your website has a vibe.\nNow measure it.",
    heroText: "A considered audit of the experience behind your URL — visual systems, usability, mobile behavior, accessibility and real performance data.",
    urlPlaceholder: "https://yourwebsite.com", analyze: "Analyze website", analyzing: "Starting analysis…",
    privateNote: "Public websites only · No code changes · Usually ready in a few minutes",
    proofTitle: "A clearer picture of your digital experience", proofText: "One report. Six lenses. Evidence behind every score.",
    dashboardTitle: "Your workspace", dashboardSubtitle: "A working history of the websites you have inspected.",
    analyses: "Analyses", savedSites: "Saved websites", comparisons: "Comparisons", search: "Search domain or URL…",
    all: "All reports", favorites: "Favorites", queued: "Queued", running: "Running", completed: "Completed", failed: "Failed",
    noAnalyses: "No reports yet", noAnalysesText: "Run your first website audit and its report will appear here.",
    noSaved: "No saved websites", noSavedText: "Save domains you revisit to keep your audit workspace tidy.",
    saveSite: "Save a website", websiteLabel: "Website URL", labelOptional: "Label (optional)", save: "Save website", cancel: "Cancel",
    compareSelected: "Compare selected", openReport: "Open report", remove: "Remove", favorite: "Add to favorites", unfavorite: "Remove from favorites",
    report: "Audit report", reportLoading: "Building your report", reportLoadingText: "Your pages are being inspected in an isolated browser.",
    overview: "Overview", findings: "Findings", positives: "What is working", recommendations: "Recommended next steps", evidence: "Evidence",
    desktop: "Desktop snapshot", mobile: "Mobile snapshot", performance: "Performance", visual: "Visual design", ux: "User experience",
    responsive: "Responsiveness", accessibility: "Accessibility", content: "Content structure", score: "Vibe score", exportPdf: "Download PDF",
    share: "Share report", copied: "Share link copied", retry: "Retry analysis", backDashboard: "Back to dashboard",
    measured: "Measured", aiJudgment: "AI judgment", method: "Scoring method", unavailable: "Unavailable", shareNote: "Anyone with this link can view this report.",
    compareTitle: "Website comparison", compareSubtitle: "Put completed audits side by side and compare the evidence, not just the headline score.",
    chooseReports: "Choose 2–4 completed reports", createComparison: "Create comparison", previousComparisons: "Recent comparisons",
    admin: "Administration", adminTitle: "Control room", adminSubtitle: "Operational view of users, analysis jobs and platform policy.",
    users: "Users", jobs: "Analysis jobs", settings: "Settings", platform: "Platform", dailyLimit: "Daily analysis limit", maxSites: "Maximum websites per comparison",
    publicSharing: "Allow public report sharing", aiProvider: "AI provider", apiBaseUrl: "API base URL", model: "Model", apiKey: "API key", enabled: "Enabled", saveSettings: "Save settings",
    totalUsers: "Total users", totalAnalyses: "Total analyses", avgScore: "Average completed score", failures: "Failed jobs", noAccess: "You do not have access to this workspace.",
    loginTitle: "Welcome back", loginSubtitle: "Sign in to continue your website audits.", registerTitle: "Create your VibeCheck account", registerSubtitle: "A sharper view of every website you work on.",
    email: "Email address", password: "Password", confirmPassword: "Confirm password", displayName: "Your name", forgot: "Use at least 12 characters.",
    login: "Sign in", register: "Create account", noAccount: "New to VibeCheck?", haveAccount: "Already have an account?", terms: "By continuing, you agree to use VibeCheck only for websites you are authorized to inspect.",
    status: "Status", scoreLabel: "Score", domain: "Website", created: "Created", actions: "Actions", page: "Page", of: "of", previous: "Previous", next: "Next",
    clear: "Clear", backHome: "Back to home", sample: "SAMPLE REPORT · ILLUSTRATIVE", noFindings: "No measurable findings were recorded.",
    scoreNote: "Rule-based categories deduct 3 / 6 / 12 / 20 points per low / medium / high / critical measured finding. Performance uses Lighthouse. AI judgments never alter numeric scores.",
    searchEmpty: "No reports match this filter.", allCaught: "You are all caught up.", loading: "Loading…", errorTitle: "Something went wrong", website: "Website", add: "Add",
    workspaceGreeting: "HELLO", yourWorkspace: "YOUR WORKSPACE", reports: "reports", completedOnPage: "completed on this page", savedSitesNote: "Saved domains are attached to your account.",
    confirmRemoveSite: "Remove this website from your saved list?", websiteSaved: "Website saved.", websiteRemoved: "Saved website removed.", favoriteAdded: "Added to favorites.", favoriteRemoved: "Removed from favorites.",
    reportNotFound: "This report could not be found in your workspace.", reportUnavailable: "Report unavailable", analysisFailed: "Analysis could not be completed", reference: "Reference",
    analysisProgress: "Browser inspection and Lighthouse measurement are in progress", averageAvailable: "Average of available categories", capturedRealBrowser: "Captured in a real browser session at 1440px and 390px viewports.", screenshotsUnavailable: "Browser screenshots are not available for this report.",
    lighthouseAccess: "Lighthouse accessibility", bestPractices: "Best practices", largestContent: "Largest contentful paint", cumulativeShift: "Cumulative layout shift", blockingTime: "Total blocking time",
    measuredSignals: "measured signals", aiJudgments: "AI judgments", total: "total", noPositive: "No positive observations were recorded.", noRecommendations: "No recommendations were generated.", action: "Action",
    comparisonNameOptional: "Comparison name (optional)", comparisonNamePlaceholder: "Homepage redesign review", comparisonOverview: "Comparison overview", websites: "websites", measure: "Measure", overallVibe: "Overall vibe score",
    noCompletedReports: "No completed reports are available yet.", noSavedComparisons: "No saved comparisons yet.", confirmDeleteComparison: "Delete this saved comparison? The source reports will remain.", comparisonCreated: "Comparison created.", comparisonDeleted: "Comparison deleted.",
    refreshData: "Refresh data", volume24h: "24-hour volume", allStatuses: "All statuses", searchByUser: "Search by email or name…", usersOnPage: "users on this page", account: "Account", role: "Role", active: "Active", disabled: "Disabled", disable: "Disable", enable: "Enable",
    queuedCount: "queued", runningCount: "running", retryJob: "Retry", websiteOwner: "Website / owner", providerKeyHint: "Configured · leave blank to keep current key", providerKeyPlaceholder: "Enter provider API key", apiKeySecurity: "The key is encrypted at rest and never returned by the API.",
    authMismatch: "Passwords do not match.", authUnavailable: "The authentication service could not be reached.", accountReady: "Your VibeCheck account is ready.", signedIn: "You are signed in.", signInToAudit: "Sign in to save and run your website audits.",
    sideBySideReview: "SIDE-BY-SIDE REVIEW", lighthouseLcp: "Lighthouse LCP", measuredFindingsLabel: "Measured findings", deleteComparison: "Delete comparison", selectReportForCompare: "Select report for comparison", noJobsMatch: "No jobs match this status.",
    sourceLighthouse: "Lighthouse", measuredRules: "Measured rules", playwright: "PLAYWRIGHT", googleLighthouse: "GOOGLE LIGHTHOUSE", lighthouseNotAvailable: "Lighthouse was not available for this run.",
    wcagHeuristicNote: "Accessibility signals are heuristic checks of the inspected DOM and a sample of visible text/background pairs; this is not a full WCAG conformance audit. AI findings are labeled as judgments and excluded from numeric score calculations.", reportCreated: "Report created", inspectionFailed: "The inspection failed.", userRole: "User", adminRole: "Administrator", disableUserConfirm: "They will no longer be able to sign in.", userUpdated: "User updated.", settingsSaved: "Platform settings saved.", providerNote: "OpenAI-compatible chat completions endpoint.", dismissNotification: "Dismiss notification",
    practicalAudit: "A PRACTICAL DESIGN AUDIT", fromUrlToAction: "FROM URL TO ACTION PLAN", fourStepsTitle: "Four steps to a sharper website.",
    lensVisualTitle: "Visual design", lensVisualBody: "Typography, color usage, hierarchy and the rhythm of the interface.", lensUxTitle: "User experience", lensUxBody: "Navigation, page structure, control clarity and the paths users can take.", lensResponsiveTitle: "Responsive behavior", lensResponsiveBody: "Real browser inspection at desktop and narrow mobile viewports.", lensPerformanceTitle: "Performance", lensPerformanceBody: "Lighthouse performance scoring with Core Web Vitals and loading signals.", lensAccessibilityTitle: "Accessibility", lensAccessibilityBody: "DOM-level checks for names, image alternatives and contrast risks.", lensContentTitle: "Content structure", lensContentBody: "Headings, landmarks, page metadata and readable information architecture.",
    stepUrlTitle: "Enter a public URL", stepUrlBody: "We validate the destination and inspect the page in an isolated browser session.", stepMeasureTitle: "Measure the experience", stepMeasureBody: "Playwright captures desktop and mobile views. Lighthouse measures performance.", stepPrioritizeTitle: "Prioritize improvements", stepPrioritizeBody: "A report brings together transparent scores, evidence, positive observations and next steps.", stepTrackTitle: "Track the change", stepTrackBody: "Keep your history, compare other websites, share a report or export a PDF.",
    previewEyebrow: "VIBECHECK / AUDIT PREVIEW", previewSample: "SAMPLE", previewScoreTag: "ILLUSTRATIVE REPORT", previewSummary: "Strong foundations. A few details to refine.", previewEngine: "PLAYWRIGHT + LIGHTHOUSE", previewFooter: "Evidence, not guesswork ↗", readOnly: "READ ONLY",
    notScored: "not scored", outOf: "out of", previewAria: "Illustrative VibeCheck report preview", publicReport: "PUBLIC VIBECHECK REPORT", shareInvalid: "This share link may no longer be valid.", openMenu: "Open navigation", closeMenu: "Close navigation", switchLanguage: "Switch language", mainNavigation: "Main navigation", footerClaim: "Built for better web experiences.", footerEvidence: "Evidence over instinct.",
  },
  fa: {
    product: "محصول", howItWorks: "نحوه کار", pricing: "طرح‌ها", dashboard: "میز کار", compare: "مقایسه",
    signIn: "ورود", createAccount: "ساخت حساب", signOut: "خروج", runAudit: "شروع بررسی",
    heroEyebrow: "هوشمندی کیفیت وب‌سایت", heroTitle: "وب‌سایت شما حال‌وهوایی دارد.\nحالا آن را بسنجید.",
    heroText: "ارزیابی دقیق تجربه وب‌سایت شما؛ از نظام بصری و کاربردپذیری تا رفتار موبایل، دسترس‌پذیری و داده‌های واقعی عملکرد.",
    urlPlaceholder: "https://yourwebsite.com", analyze: "تحلیل وب‌سایت", analyzing: "در حال شروع تحلیل…",
    privateNote: "فقط وب‌سایت‌های عمومی · بدون تغییر کد · گزارش پس از چند دقیقه آماده می‌شود",
    proofTitle: "تصویری روشن‌تر از تجربه دیجیتال شما", proofText: "یک گزارش، شش بُعد و شواهد پشت هر امتیاز.",
    dashboardTitle: "فضای کاری شما", dashboardSubtitle: "تاریخچه وب‌سایت‌هایی که بررسی کرده‌اید.",
    analyses: "تحلیل‌ها", savedSites: "وب‌سایت‌های ذخیره‌شده", comparisons: "مقایسه‌ها", search: "جست‌وجوی دامنه یا نشانی…",
    all: "همه گزارش‌ها", favorites: "علاقه‌مندی‌ها", queued: "در صف", running: "در حال اجرا", completed: "تکمیل‌شده", failed: "ناموفق",
    noAnalyses: "هنوز گزارشی ندارید", noAnalysesText: "اولین بررسی وب‌سایت خود را اجرا کنید تا گزارش اینجا نمایش داده شود.",
    noSaved: "وب‌سایتی ذخیره نشده است", noSavedText: "دامنه‌هایی را که دوباره بررسی می‌کنید ذخیره کنید.",
    saveSite: "ذخیره وب‌سایت", websiteLabel: "نشانی وب‌سایت", labelOptional: "عنوان (اختیاری)", save: "ذخیره", cancel: "انصراف",
    compareSelected: "مقایسه موارد انتخاب‌شده", openReport: "مشاهده گزارش", remove: "حذف", favorite: "افزودن به علاقه‌مندی‌ها", unfavorite: "حذف از علاقه‌مندی‌ها",
    report: "گزارش ارزیابی", reportLoading: "گزارش شما در حال آماده‌سازی است", reportLoadingText: "صفحات شما در مرورگری ایزوله بررسی می‌شوند.",
    overview: "نمای کلی", findings: "ایرادهای شناسایی‌شده", positives: "نقاط قوت", recommendations: "اقدام‌های پیشنهادی", evidence: "شواهد",
    desktop: "نمای دسکتاپ", mobile: "نمای موبایل", performance: "عملکرد", visual: "طراحی بصری", ux: "تجربه کاربری",
    responsive: "واکنش‌گرایی", accessibility: "دسترس‌پذیری", content: "ساختار محتوا", score: "امتیاز وایب", exportPdf: "دریافت PDF",
    share: "اشتراک گزارش", copied: "پیوند کپی شد", retry: "تلاش دوباره", backDashboard: "بازگشت به میز کار",
    measured: "اندازه‌گیری‌شده", aiJudgment: "ارزیابی هوش مصنوعی", method: "روش امتیازدهی", unavailable: "در دسترس نیست", shareNote: "هر فردی که این پیوند را داشته باشد می‌تواند گزارش را ببیند.",
    compareTitle: "مقایسه وب‌سایت‌ها", compareSubtitle: "گزارش‌های تکمیل‌شده را کنار هم ببینید و شواهد را مقایسه کنید.",
    chooseReports: "انتخاب ۲ تا ۴ گزارش تکمیل‌شده", createComparison: "ایجاد مقایسه", previousComparisons: "مقایسه‌های اخیر",
    admin: "مدیریت", adminTitle: "اتاق کنترل", adminSubtitle: "نمای عملیاتی کاربران، پردازش تحلیل‌ها و سیاست‌های سامانه.",
    users: "کاربران", jobs: "کارهای تحلیل", settings: "تنظیمات", platform: "سامانه", dailyLimit: "سقف تحلیل روزانه", maxSites: "حداکثر وب‌سایت در هر مقایسه",
    publicSharing: "اجازه اشتراک عمومی گزارش", aiProvider: "ارائه‌دهنده هوش مصنوعی", apiBaseUrl: "نشانی پایه API", model: "مدل", apiKey: "کلید API", enabled: "فعال", saveSettings: "ذخیره تنظیمات",
    totalUsers: "تعداد کاربران", totalAnalyses: "کل تحلیل‌ها", avgScore: "میانگین امتیاز گزارش‌ها", failures: "کارهای ناموفق", noAccess: "شما به این بخش دسترسی ندارید.",
    loginTitle: "خوش برگشتید", loginSubtitle: "برای ادامه بررسی وب‌سایت‌ها وارد شوید.", registerTitle: "حساب VibeCheck بسازید", registerSubtitle: "نگاهی دقیق‌تر به هر وب‌سایتی که روی آن کار می‌کنید.",
    email: "ایمیل", password: "گذرواژه", confirmPassword: "تکرار گذرواژه", displayName: "نام شما", forgot: "حداقل ۱۲ نویسه وارد کنید.",
    login: "ورود", register: "ساخت حساب", noAccount: "تازه به VibeCheck پیوسته‌اید؟", haveAccount: "از قبل حساب دارید؟", terms: "با ادامه، تأیید می‌کنید فقط وب‌سایت‌هایی را بررسی می‌کنید که مجاز به ارزیابی آن‌ها هستید.",
    status: "وضعیت", scoreLabel: "امتیاز", domain: "وب‌سایت", created: "تاریخ ایجاد", actions: "عملیات", page: "صفحه", of: "از", previous: "قبلی", next: "بعدی",
    clear: "پاک‌کردن", backHome: "بازگشت به خانه", sample: "نمونه گزارش · صرفاً نمایشی", noFindings: "ایراد قابل‌اندازه‌گیری ثبت نشده است.",
    scoreNote: "در امتیازهای قاعده‌محور، به ازای هر ایراد کم، متوسط، زیاد و بحرانی به‌ترتیب ۳، ۶، ۱۲ و ۲۰ امتیاز کسر می‌شود. عملکرد از Lighthouse می‌آید. ارزیابی AI در امتیاز عددی دخالت ندارد.",
    searchEmpty: "گزارشی با این فیلتر پیدا نشد.", allCaught: "همه موارد را بررسی کرده‌اید.", loading: "در حال بارگذاری…", errorTitle: "مشکلی پیش آمد", website: "وب‌سایت", add: "افزودن",
    workspaceGreeting: "سلام", yourWorkspace: "فضای کاری شما", reports: "گزارش", completedOnPage: "تکمیل‌شده در این صفحه", savedSitesNote: "وب‌سایت‌های ذخیره‌شده به حساب شما متصل هستند.",
    confirmRemoveSite: "این وب‌سایت از فهرست ذخیره‌شده‌ها حذف شود؟", websiteSaved: "وب‌سایت ذخیره شد.", websiteRemoved: "وب‌سایت ذخیره‌شده حذف شد.", favoriteAdded: "به علاقه‌مندی‌ها افزوده شد.", favoriteRemoved: "از علاقه‌مندی‌ها حذف شد.",
    reportNotFound: "این گزارش در فضای کاری شما پیدا نشد.", reportUnavailable: "گزارش در دسترس نیست", analysisFailed: "تحلیل انجام نشد", reference: "شناسه پیگیری",
    analysisProgress: "بررسی مرورگر و اندازه‌گیری Lighthouse در حال انجام است", averageAvailable: "میانگین دسته‌های در دسترس", capturedRealBrowser: "تصاویر در مرورگر واقعی و در اندازه‌های ۱۴۴۰ و ۳۹۰ پیکسل ثبت شده‌اند.", screenshotsUnavailable: "تصاویر مرورگر برای این گزارش در دسترس نیستند.",
    lighthouseAccess: "دسترس‌پذیری Lighthouse", bestPractices: "بهترین شیوه‌ها", largestContent: "بزرگ‌ترین محتوای قابل‌رندر", cumulativeShift: "تغییر چیدمان تجمعی", blockingTime: "زمان مسدودسازی کل",
    measuredSignals: "نشانه اندازه‌گیری‌شده", aiJudgments: "ارزیابی هوش مصنوعی", total: "مجموع", noPositive: "نکته مثبتی ثبت نشده است.", noRecommendations: "پیشنهادی تولید نشده است.", action: "اقدام پیشنهادی",
    comparisonNameOptional: "نام مقایسه (اختیاری)", comparisonNamePlaceholder: "بررسی بازطراحی صفحه اصلی", comparisonOverview: "نمای کلی مقایسه", websites: "وب‌سایت", measure: "شاخص", overallVibe: "امتیاز کلی وایب",
    noCompletedReports: "هنوز گزارش تکمیل‌شده‌ای وجود ندارد.", noSavedComparisons: "مقایسه ذخیره‌شده‌ای وجود ندارد.", confirmDeleteComparison: "این مقایسه حذف شود؟ گزارش‌های اصلی باقی می‌مانند.", comparisonCreated: "مقایسه ایجاد شد.", comparisonDeleted: "مقایسه حذف شد.",
    refreshData: "تازه‌سازی داده‌ها", volume24h: "حجم ۲۴ ساعت گذشته", allStatuses: "همه وضعیت‌ها", searchByUser: "جست‌وجو با ایمیل یا نام…", usersOnPage: "کاربر در این صفحه", account: "حساب کاربری", role: "نقش", active: "فعال", disabled: "غیرفعال", disable: "غیرفعال‌سازی", enable: "فعال‌سازی",
    queuedCount: "در صف", runningCount: "در حال اجرا", retryJob: "تلاش دوباره", websiteOwner: "وب‌سایت / مالک", providerKeyHint: "تنظیم شده · برای حفظ کلید فعلی خالی بگذارید", providerKeyPlaceholder: "کلید API ارائه‌دهنده را وارد کنید", apiKeySecurity: "کلید در پایگاه داده رمزنگاری می‌شود و هرگز از API بازگردانده نمی‌شود.",
    authMismatch: "گذرواژه‌ها یکسان نیستند.", authUnavailable: "ارتباط با سرویس ورود برقرار نشد.", accountReady: "حساب VibeCheck شما آماده است.", signedIn: "وارد حساب شدید.", signInToAudit: "برای ذخیره و اجرای بررسی وب‌سایت وارد شوید.",
    sideBySideReview: "مقایسه کنار هم", lighthouseLcp: "LCP در Lighthouse", measuredFindingsLabel: "ایرادهای اندازه‌گیری‌شده", deleteComparison: "حذف مقایسه", selectReportForCompare: "انتخاب گزارش برای مقایسه", noJobsMatch: "کاری با این وضعیت پیدا نشد.",
    sourceLighthouse: "Lighthouse", measuredRules: "قواعد اندازه‌گیری‌شده", playwright: "PLAYWRIGHT", googleLighthouse: "GOOGLE LIGHTHOUSE", lighthouseNotAvailable: "Lighthouse در این اجرا در دسترس نبود.",
    wcagHeuristicNote: "نشانه‌های دسترس‌پذیری بر پایه بررسی اکتشافی DOM و نمونه‌ای از جفت‌رنگ‌های متن و پس‌زمینه هستند؛ این بررسی ممیزی کامل انطباق با WCAG نیست. یافته‌های هوش مصنوعی به‌عنوان ارزیابی مشخص شده‌اند و در محاسبه امتیاز عددی دخالت ندارند.", reportCreated: "تاریخ گزارش", inspectionFailed: "بررسی انجام نشد.", userRole: "کاربر", adminRole: "مدیر", disableUserConfirm: "این کاربر دیگر نمی‌تواند وارد حساب شود.", userUpdated: "کاربر به‌روزرسانی شد.", settingsSaved: "تنظیمات سامانه ذخیره شد.", providerNote: "نشانی سازگار با OpenAI برای تکمیل گفتگو.", dismissNotification: "بستن اعلان",
    practicalAudit: "ارزیابی کاربردی طراحی", fromUrlToAction: "از نشانی تا برنامه اقدام", fourStepsTitle: "چهار گام برای وب‌سایتی بهتر.",
    lensVisualTitle: "طراحی بصری", lensVisualBody: "تایپوگرافی، کاربرد رنگ، سلسله‌مراتب و ریتم رابط کاربری.", lensUxTitle: "تجربه کاربری", lensUxBody: "پیمایش، ساختار صفحه، وضوح کنترل‌ها و مسیرهای پیش روی کاربر.", lensResponsiveTitle: "رفتار واکنش‌گرا", lensResponsiveBody: "بررسی در مرورگر واقعی و در اندازه دسکتاپ و موبایل.", lensPerformanceTitle: "عملکرد", lensPerformanceBody: "امتیاز Lighthouse همراه با معیارهای حیاتی وب و نشانه‌های بارگذاری.", lensAccessibilityTitle: "دسترس‌پذیری", lensAccessibilityBody: "بررسی نام عناصر، متن جایگزین تصاویر و خطرهای کنتراست در DOM.", lensContentTitle: "ساختار محتوا", lensContentBody: "عنوان‌ها، ناحیه‌های معنایی، فراداده صفحه و معماری خوانای اطلاعات.",
    stepUrlTitle: "نشانی عمومی را وارد کنید", stepUrlBody: "مقصد را اعتبارسنجی می‌کنیم و صفحه را در مرورگری ایزوله بررسی می‌کنیم.", stepMeasureTitle: "تجربه را اندازه بگیرید", stepMeasureBody: "Playwright نمای دسکتاپ و موبایل را ثبت می‌کند و Lighthouse عملکرد را می‌سنجد.", stepPrioritizeTitle: "بهبودها را اولویت‌بندی کنید", stepPrioritizeBody: "گزارش، امتیازهای شفاف، شواهد، نقاط قوت و اقدام‌های بعدی را کنار هم می‌آورد.", stepTrackTitle: "تغییرات را دنبال کنید", stepTrackBody: "تاریخچه را نگه دارید، وب‌سایت‌ها را مقایسه کنید، گزارش را به اشتراک بگذارید یا PDF بگیرید.",
    previewEyebrow: "VIBECHECK / پیش‌نمایش ارزیابی", previewSample: "نمونه", previewScoreTag: "گزارش نمونه", previewSummary: "پایه‌ای مناسب؛ چند جزئیات برای بهبود باقی مانده است.", previewEngine: "PLAYWRIGHT + LIGHTHOUSE", previewFooter: "شواهد، نه حدس و گمان ↗", readOnly: "فقط خواندنی",
    notScored: "امتیاز ندارد", outOf: "از", previewAria: "پیش‌نمایش نمونه گزارش VibeCheck", publicReport: "گزارش عمومی VIBECHECK", shareInvalid: "این پیوند اشتراک‌گذاری دیگر معتبر نیست.", openMenu: "بازکردن پیمایش", closeMenu: "بستن پیمایش", switchLanguage: "تغییر زبان", mainNavigation: "پیمایش اصلی", footerClaim: "برای تجربه‌های بهتر وب ساخته شده است.", footerEvidence: "شواهد، نه حدس و گمان.",
  }
};

const LocaleContext = createContext<LocaleContextValue | null>(null);
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("en");
  useEffect(() => {
    const stored = window.localStorage.getItem("vibecheck-locale");
    const initial = stored === "fa" ? "fa" : "en";
    setLocale(initial);
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale === "fa" ? "fa" : "en";
    document.documentElement.dir = locale === "fa" ? "rtl" : "ltr";
    window.localStorage.setItem("vibecheck-locale", locale);
  }, [locale]);
  const value = useMemo<LocaleContextValue>(() => ({
    locale, dir: locale === "fa" ? "rtl" : "ltr",
    toggle: () => setLocale((current) => current === "en" ? "fa" : "en"),
    t: (key) => messages[locale][key] ?? messages.en[key] ?? key
  }), [locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used inside LocaleProvider");
  return context;
}
