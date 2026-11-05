import asyncio
import json
import logging
import os
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import urlsplit

from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError

from .url_guard import validate_public_url
from .scoring import calculate_scores
from .ai import request_ai_review

logger = logging.getLogger(__name__)

METRICS_SCRIPT = r"""() => {
  const clean = (v) => (v || '').replace(/\s+/g, ' ').trim();
  const visible = (el) => !!(el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
  const named = (el) => clean(el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || el.querySelector('img[alt]')?.getAttribute('alt') || '');
  const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(visible).map(el => ({level: Number(el.tagName.slice(1)), text: clean(el.innerText).slice(0, 120)}));
  const images = [...document.images].filter(visible);
  const links = [...document.querySelectorAll('a[href]')].filter(visible);
  const buttons = [...document.querySelectorAll('button,input[type=button],input[type=submit],[role=button]')].filter(visible);
  const fontSet = new Set(); const colorSet = new Set(); const badContrast = [];
  const candidates = [...document.querySelectorAll('h1,h2,h3,p,a,button,label,li')].filter(visible).slice(0, 80);
  const rgb = (value) => { const m = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i); return m ? m.slice(1,4).map(Number) : null; };
  const lum = (c) => { const a = c.map(v => {v/=255; return v <= .04045 ? v/12.92 : Math.pow((v+.055)/1.055,2.4)}); return .2126*a[0]+.7152*a[1]+.0722*a[2]; };
  for (const el of candidates) {
    const s = getComputedStyle(el); fontSet.add(s.fontFamily.split(',')[0].replace(/["']/g,''));
    if (s.color && s.color !== 'rgba(0, 0, 0, 0)') colorSet.add(s.color);
    if (s.backgroundColor && s.backgroundColor !== 'rgba(0, 0, 0, 0)') colorSet.add(s.backgroundColor);
    const fg = rgb(s.color); let bg = rgb(s.backgroundColor);
    if (!bg || (bg[0]===0 && bg[1]===0 && bg[2]===0 && s.backgroundColor.includes('0)'))) {
      let p=el.parentElement; while(p && !bg) { bg=rgb(getComputedStyle(p).backgroundColor); p=p.parentElement; }
    }
    if (fg && bg && clean(el.innerText).length > 0) { const a=lum(fg), b=lum(bg), ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05); if(ratio<4.5) badContrast.push({text:clean(el.innerText).slice(0,55), ratio:Number(ratio.toFixed(2))}); }
  }
  const root = document.documentElement;
  return {
    title: clean(document.title).slice(0,300),
    metaDescription: clean(document.querySelector('meta[name="description"]')?.content || ''),
    language: root.getAttribute('lang') || document.querySelector('html')?.getAttribute('lang') || '',
    h1Count: headings.filter(h=>h.level===1).length, headings,
    navCount: document.querySelectorAll('nav,[role=navigation]').length,
    mainCount: document.querySelectorAll('main,[role=main]').length,
    imageCount: images.length, imagesMissingAlt: images.filter(i=>!i.hasAttribute('alt') || !clean(i.getAttribute('alt'))).length,
    linkCount: links.length, linksWithoutName: links.filter(a=>!named(a)).length,
    buttonCount: buttons.length, buttonsWithoutName: buttons.filter(b=>!named(b)).length,
    fontFamilies: [...fontSet], colorTokens: [...colorSet],
    contrastFailures: badContrast,
    viewportWidth: window.innerWidth, documentWidth: Math.max(root.scrollWidth, document.body?.scrollWidth || 0),
    horizontalOverflow: Math.max(root.scrollWidth, document.body?.scrollWidth || 0) > window.innerWidth + 4,
    contentCharacters: clean(document.body?.innerText || '').length,
    documentHeight: Math.max(root.scrollHeight, document.body?.scrollHeight || 0),
    viewportCoverage: Math.round((window.innerWidth / Math.max(1, root.clientWidth))*100)
  };
}"""

SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}

def _bounded_text(value, limit: int, fallback: str = "") -> str:
    return value.strip()[:limit] if isinstance(value, str) else fallback

def _normalize_ai_result(value: dict | None) -> dict | None:
    if not isinstance(value, dict):
        return None
    allowed_categories = {"visual_design", "user_experience", "responsiveness", "accessibility", "content_structure"}
    allowed_severities = {"high", "medium", "low"}
    findings = []
    raw_findings = value.get("findings", [])
    if isinstance(raw_findings, list):
        for item in raw_findings[:5]:
            if not isinstance(item, dict):
                continue
            title = _bounded_text(item.get("title"), 180)
            category = item.get("category")
            severity = item.get("severity")
            if (
                not title
                or not isinstance(category, str)
                or category not in allowed_categories
                or not isinstance(severity, str)
                or severity not in allowed_severities
            ):
                continue
            findings.append({
                "category": category, "severity": severity, "title": title,
                "description": _bounded_text(item.get("description"), 1200),
                "evidence": _bounded_text(item.get("evidence"), 500, "AI design judgment"),
                "recommendation": _bounded_text(item.get("recommendation"), 1000),
            })
    recommendations = []
    raw_recommendations = value.get("recommendations", [])
    if isinstance(raw_recommendations, list):
        for item in raw_recommendations[:6]:
            if not isinstance(item, dict):
                continue
            title = _bounded_text(item.get("title"), 180)
            if not title:
                continue
            priority = item.get("priority", "medium")
            if not isinstance(priority, str) or priority not in allowed_severities:
                priority = "medium"
            recommendations.append({
                "priority": priority, "title": title,
                "rationale": _bounded_text(item.get("rationale"), 1000),
                "action": _bounded_text(item.get("action"), 1000),
            })
    positives = value.get("positives", [])
    if not isinstance(positives, list):
        positives = []
    return {
        "summary": _bounded_text(value.get("summary"), 1000),
        "positives": [_bounded_text(item, 240) for item in positives[:4] if isinstance(item, str)],
        "recommendations": recommendations,
        "findings": findings,
    }

def _finding(code, category, severity, title, description, evidence, recommendation):
    return {"code": code, "category": category, "severity": severity, "title": title,
            "description": description, "evidence": evidence, "recommendation": recommendation,
            "source": "measurement"}

def build_findings(desktop: dict, mobile: dict):
    findings = []
    if not desktop.get("title"):
        findings.append(_finding("missing_title", "content_structure", "high", "Page title is missing", "Search engines and assistive technology rely on a meaningful document title.", "document.title is empty", "Add a concise, page-specific title element."))
    if not desktop.get("metaDescription"):
        findings.append(_finding("missing_meta_description", "content_structure", "low", "Meta description is missing", "A search description is not present in the inspected document.", "meta[name=description] not found or empty", "Add a unique, useful meta description."))
    if desktop.get("h1Count", 0) == 0:
        findings.append(_finding("missing_h1", "content_structure", "high", "No primary heading found", "The page has no visible H1 to establish its main topic.", "0 visible H1 elements", "Add one descriptive H1 near the start of the main content."))
    elif desktop.get("h1Count", 0) > 1:
        findings.append(_finding("multiple_h1", "content_structure", "low", "Multiple primary headings", "Several visible H1 elements may make the page outline harder to scan.", f"{desktop['h1Count']} visible H1 elements", "Use one page-level H1 and structure sections with H2/H3 headings."))
    levels = [h["level"] for h in desktop.get("headings", [])]
    if any(curr > prev + 1 for prev, curr in zip(levels, levels[1:])):
        findings.append(_finding("heading_skip", "content_structure", "medium", "Heading levels are skipped", "The visible heading outline jumps over one or more levels.", f"Observed outline: {levels[:16]}", "Keep heading levels hierarchical; do not skip from H2 to H4."))
    if not desktop.get("navCount"):
        findings.append(_finding("no_navigation_landmark", "user_experience", "medium", "Navigation landmark not detected", "No nav element or navigation landmark was found in the visible page DOM.", "nav/[role=navigation] count: 0", "Mark the primary site navigation with a semantic nav element."))
    if desktop.get("linksWithoutName", 0):
        findings.append(_finding("unlabeled_links", "accessibility", "high", "Links without accessible names", "Some visible links have no usable text or accessible label.", f"{desktop['linksWithoutName']} of {desktop['linkCount']} visible links", "Give every link descriptive text or an aria-label that explains its destination."))
    if desktop.get("buttonsWithoutName", 0):
        findings.append(_finding("unlabeled_buttons", "accessibility", "high", "Buttons without accessible names", "Some visible buttons do not expose a discernible name.", f"{desktop['buttonsWithoutName']} of {desktop['buttonCount']} visible buttons", "Add visible text or an appropriate aria-label to each button."))
    if desktop.get("imagesMissingAlt", 0):
        findings.append(_finding("images_missing_alt", "accessibility", "medium", "Images missing alternative text", "Visible images are missing alt attributes or have empty alt text.", f"{desktop['imagesMissingAlt']} of {desktop['imageCount']} visible images", "Add concise alt text to informative images; use alt=\"\" only for decorative images."))
    contrast_count = len(desktop.get("contrastFailures", []))
    if contrast_count:
        first = desktop["contrastFailures"][0]
        findings.append(_finding("possible_low_contrast", "accessibility", "medium", "Potential low-contrast text", "A sampled text/background pair falls below the WCAG AA 4.5:1 text contrast threshold. This is a heuristic sample, not a full contrast audit.", f"{contrast_count} sampled pairs below 4.5:1; lowest sample {first.get('ratio')}:1", "Verify the foreground/background pair and adjust colors to meet the applicable WCAG contrast ratio."))
    if mobile.get("horizontalOverflow"):
        findings.append(_finding("mobile_horizontal_overflow", "responsiveness", "high", "Horizontal overflow on mobile", "The document is wider than the mobile viewport and may require horizontal scrolling.", f"Document width {mobile.get('documentWidth')}px vs viewport {mobile.get('viewportWidth')}px", "Inspect fixed-width sections, tables, images, and navigation at narrow breakpoints."))
    if mobile.get("viewportCoverage", 100) < 99:
        findings.append(_finding("mobile_viewport_mismatch", "responsiveness", "medium", "Mobile viewport does not fill the layout width", "The layout's root width differs from the device viewport measurement.", f"Measured width ratio: {mobile.get('viewportCoverage')}%", "Verify the viewport meta tag and responsive root layout."))
    fonts = desktop.get("fontFamilies", [])
    if len(fonts) > 4:
        findings.append(_finding("many_font_families", "visual_design", "low", "Typography uses many font families", "A sample of visible text uses more than four distinct font-family declarations.", f"{len(fonts)} sampled families: {', '.join(fonts[:8])}", "Consolidate typography into a small type system with clear roles."))
    colors = desktop.get("colorTokens", [])
    if len(colors) > 16:
        findings.append(_finding("many_color_tokens", "visual_design", "low", "Color usage may be inconsistent", "The sampled interface uses many distinct foreground and background colors.", f"{len(colors)} distinct computed colors in sampled elements", "Define a small set of semantic color tokens and reuse them consistently."))
    if desktop.get("contentCharacters", 0) < 80:
        findings.append(_finding("sparse_page_content", "content_structure", "medium", "Very little readable page content", "The inspected page contains little visible text; this may be intentional for a visual or application surface.", f"{desktop.get('contentCharacters', 0)} visible text characters", "Ensure the page communicates its purpose and key actions to visitors."))
    findings.sort(key=lambda f: (SEVERITY_ORDER.get(f["severity"], 9), f["category"], f["code"]))
    return findings

def _positive_observations(desktop, mobile):
    items = []
    if desktop.get("title"): items.append("A document title is present.")
    if desktop.get("h1Count") == 1: items.append("A single visible H1 establishes the page topic.")
    if desktop.get("navCount"): items.append("A semantic navigation landmark is present.")
    if not mobile.get("horizontalOverflow"): items.append("No horizontal overflow was detected at the 390px mobile viewport.")
    if desktop.get("imagesMissingAlt", 0) == 0 and desktop.get("imageCount", 0): items.append("All sampled visible images expose alt attributes.")
    if desktop.get("mainCount"): items.append("A main-content landmark is present.")
    return items[:6]

async def _inspect_with_browser(url: str):
    async with async_playwright() as p:
        configured_chromium_path = os.getenv(
            "PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH"
        )

        chromium_path = (
            configured_chromium_path or p.chromium.executable_path
        )

        if configured_chromium_path and not Path(chromium_path).is_file():
            raise RuntimeError(
                f"Configured Chromium executable was not found: {chromium_path}"
            )
        proxy_url = os.getenv("EGRESS_PROXY_URL", "http://egress-proxy:8888")
        browser = await p.chromium.launch(
            headless=True,
            chromium_sandbox=True,
            executable_path=chromium_path,
            proxy={"server": proxy_url, "bypass": ""},
            args=["--disable-dev-shm-usage", "--disable-background-networking", "--disable-webrtc", "--disable-features=WebRtcHideLocalIpsWithMdns" , "--no-sandbox", "--disable-setuid-sandbox"],
        )
        request_count = {"n": 0}
        async def guarded_route(route):
            request_count["n"] += 1
            request = route.request
            if request_count["n"] > 180:
                await route.abort("blockedbyclient")
                return
            try:
                validate_public_url(request.url, resolve=False)
            except Exception:
                await route.abort("blockedbyclient")
                return
            await route.continue_()
        try:
            desktop_context = await browser.new_context(
                viewport={"width": 1440, "height": 1000},
                device_scale_factor=1,
                service_workers="block",
            )
            desktop_page = await desktop_context.new_page()
            desktop_page.set_default_navigation_timeout(25000)
            desktop_page.set_default_timeout(12000)
            await desktop_page.route("**/*", guarded_route)
            await desktop_page.goto(url, wait_until="domcontentloaded", timeout=25000)
            try:
                await desktop_page.wait_for_load_state("networkidle", timeout=6500)
            except PlaywrightTimeoutError:
                pass
            await desktop_page.wait_for_timeout(500)
            actual_url = desktop_page.url
            validate_public_url(actual_url, resolve=False)
            desktop_metrics = await desktop_page.evaluate(METRICS_SCRIPT)
            desktop_screenshot = await desktop_page.screenshot(type="png", full_page=False, animations="disabled", timeout=10000)

            mobile_context = await browser.new_context(
                viewport={"width": 390, "height": 844},
                device_scale_factor=1,
                is_mobile=True,
                has_touch=True,
                service_workers="block",
            )
            mobile_page = await mobile_context.new_page()
            mobile_page.set_default_navigation_timeout(25000)
            await mobile_page.route("**/*", guarded_route)
            await mobile_page.goto(actual_url, wait_until="domcontentloaded", timeout=25000)
            try:
                await mobile_page.wait_for_load_state("networkidle", timeout=5000)
            except PlaywrightTimeoutError:
                pass
            await mobile_page.wait_for_timeout(300)
            mobile_metrics = await mobile_page.evaluate(METRICS_SCRIPT)
            mobile_screenshot = await mobile_page.screenshot(type="png", full_page=False, animations="disabled", timeout=10000)
            return desktop_metrics, mobile_metrics, desktop_screenshot, mobile_screenshot, chromium_path, actual_url
        finally:
            await browser.close()

def _run_lighthouse(url: str, chrome_path: str):
    with tempfile.TemporaryDirectory(prefix="vibecheck-lh-") as tmp:
        output = Path(tmp) / "lighthouse.json"
        env = os.environ.copy()
        env["CHROME_PATH"] = chrome_path
        env["HTTP_PROXY"] = os.getenv("EGRESS_PROXY_URL", "http://egress-proxy:8888")
        env["HTTPS_PROXY"] = env["HTTP_PROXY"]
        env["http_proxy"] = env["HTTP_PROXY"]
        env["https_proxy"] = env["HTTP_PROXY"]
        proxy_url = os.getenv("EGRESS_PROXY_URL", "http://egress-proxy:8888")
        chrome_flags = f"--headless --disable-dev-shm-usage --proxy-server={proxy_url} --proxy-bypass-list=<-loopback>"
        cmd = ["lighthouse", url, "--quiet", "--output=json", f"--output-path={output}",
               f"--chrome-flags={chrome_flags}",
               "--max-wait-for-load=25000", "--only-categories=performance,accessibility,best-practices,seo"]
        try:
            subprocess.run(cmd, check=True, timeout=90, env=env, capture_output=True, text=True)
            data = json.loads(output.read_text("utf-8"))
            categories = data.get("categories", {})
            audits = data.get("audits", {})
            def category(key):
                score = categories.get(key, {}).get("score")
                return round(score * 100) if isinstance(score, (int, float)) else None
            def metric(key):
                item = audits.get(key, {})
                return {"value": item.get("numericValue"), "display": item.get("displayValue"), "score": item.get("score")} if item else None
            return {
                "performance": category("performance"), "accessibility": category("accessibility"),
                "best_practices": category("best-practices"), "seo": category("seo"),
                "metrics": {"lcp": metric("largest-contentful-paint"), "fcp": metric("first-contentful-paint"),
                            "cls": metric("cumulative-layout-shift"), "tbt": metric("total-blocking-time"),
                            "speed_index": metric("speed-index"), "inp": metric("interaction-to-next-paint")},
            }
        except Exception as exc:
            logger.warning("Lighthouse could not complete: %s", str(exc)[:500])
            return {"available": False, "error": "Lighthouse could not complete for this page."}

def run_website_analysis(url: str):
    safe_url = validate_public_url(url, resolve=False)
    desktop, mobile, desktop_shot, mobile_shot, chrome_path, actual_url = asyncio.run(_inspect_with_browser(safe_url))
    findings = build_findings(desktop, mobile)
    lighthouse = _run_lighthouse(actual_url, chrome_path)
    performance = lighthouse.get("performance") if lighthouse.get("available", True) else None
    overall, scores = calculate_scores(findings, performance)
    measured_payload = {"desktop": desktop, "mobile": mobile, "lighthouse": lighthouse, "findings": findings}
    raw_ai_result, ai_status = request_ai_review(measured_payload, desktop_shot)
    ai_result = _normalize_ai_result(raw_ai_result)
    if raw_ai_result and not ai_result:
        ai_status = "unavailable"
    if ai_result:
        for finding in ai_result.get("findings", [])[:5]:
            if isinstance(finding, dict):
                finding.update({"source": "ai_judgment", "code": "ai_" + str(finding.get("title", "observation")).lower().replace(" ", "_")[:48], "evidence": str(finding.get("evidence", "AI visual/design judgment"))[:500]})
                findings.append(finding)
    positives = _positive_observations(desktop, mobile)
    if ai_result:
        positives.extend([str(x)[:240] for x in ai_result.get("positives", [])[:4] if isinstance(x, str)])
    recommendations = []
    for finding in findings:
        if finding.get("source") == "measurement":
            recommendations.append({"priority": finding.get("severity", "medium"), "title": finding.get("title", "Review finding"), "rationale": finding.get("description", ""), "action": finding.get("recommendation", "")})
    if ai_result:
        recommendations.extend([x for x in ai_result.get("recommendations", [])[:6] if isinstance(x, dict)])
    summary = str(ai_result.get("summary", "") if ai_result else "").strip()
    if not summary:
        summary = f"The inspection found {len([f for f in findings if f.get('source') == 'measurement'])} measurable improvement opportunities. " + ("Lighthouse performance could not be measured." if performance is None else f"Lighthouse performance scored {performance}/100.")
    # Add the Lighthouse data separately: its score is a measurement, while optional AI judgments never alter category scores.
    return {
        "url": actual_url, "title": desktop.get("title", ""), "overall_score": overall, "scores": scores,
        "metrics": {"desktop": desktop, "mobile": mobile, "analysis_engine": "Playwright DOM inspection + heuristic rules", "score_deduction_points": {"critical": 20, "high": 12, "medium": 6, "low": 3}},
        "lighthouse": lighthouse, "findings": findings, "positives": positives[:8],
        "recommendations": recommendations[:12], "summary": summary, "ai_status": ai_status,
        "desktop_screenshot": desktop_shot, "mobile_screenshot": mobile_shot,
    }
