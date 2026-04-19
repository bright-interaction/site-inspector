# Site Inspector

One-click website audit for Chrome. 140+ automated checks across security, performance, SEO, privacy, and accessibility. A+ to F grading, PDF reports, CSV export.

**Free. No tracking. No account. Everything runs locally.**

[Install from Chrome Web Store](https://chromewebstore.google.com/detail/bihhnpeaflahiocgnihloegfjcajgfdj)

---

## What It Checks

### Security (21 checks)
HTTPS, HSTS, Content-Security-Policy quality, X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy, Cross-Origin policies (COOP, CORP, COEP), Subresource Integrity, mixed content, server version leaks, compression, cache headers, security.txt (RFC 9116).

### SEO (55+ checks)
**On-page:** Title tag (length, truncation, CTA), meta description (length, action words), H1/H2 hierarchy, image alt text quality (not just presence), content length, internal links, external outbound links, text-to-HTML ratio, URL structure.

**Technical:** Canonical tags, hreflang, viewport, charset, doctype, favicon, apple-touch-icon, noindex/nofollow detection, duplicate meta tags, resource hints (preconnect, dns-prefetch, preload), pagination, AMP detection, robots.txt, XML sitemap, llms.txt (AI search readiness).

**Social & Rich Results:** JSON-LD structured data detection, schema type listing, Open Graph completeness, OG image dimensions (1200x630), Twitter Card, FAQ schema vs visible content validation, rating/review schema consistency.

**SERP Preview:** Live preview of how the page appears in Google search results.

### Performance (18 checks)
Core Web Vitals (LCP, INP, CLS), TTFB, FCP, DOM Content Loaded, page weight, request count, render-blocking scripts, image format (WebP/AVIF), lazy loading, image dimensions, font-display declarations, font file count, Google Fonts family count, inline CSS bloat detection, HTTP/2+ protocol, redirects.

### Privacy (12 checks)
Consent banner detection (30+ platforms: Cookiebot, OneTrust, Usercentrics, Didomi, Iubenda, Axeptio, Borlabs, CookieFirst, CookieYes, TrustArc, Sourcepoint, Termly, Complianz, CookieProof, and more), pre-consent tracking detection (GDPR violation), cookie count and security audit (HttpOnly, SameSite), third-party domain count, tracker identification (Google Analytics, Meta Pixel, Hotjar, Clarity, LinkedIn, TikTok, and more), AI training bot blocking in robots.txt (19 crawlers including GPTBot, ClaudeBot, Google-Extended, PerplexityBot, Applebot-Extended), privacy policy detection (English + Swedish, URL probe fallback), terms/cookie policy detection, DNT/GPC awareness.

### Accessibility (21 checks)
WCAG AA color contrast analysis, landmark roles (main, nav, header, footer), skip navigation link, heading structure and order, form input labels, button labels, link labels, image alt text, video captions, autocomplete attributes, tabindex issues, focus indicators, aria-hidden traps, table headers.

### Tech Stack Detection
**Frameworks:** React, Vue, Angular, Svelte, Astro, Next.js, Nuxt, Remix, Gatsby.
**CMS:** WordPress, Shopify, Webflow, Squarespace, Wix, Drupal, Joomla, Ghost.
**Page builders:** Elementor, Divi, Bricks, Beaver Builder, Gutenberg, Webflow, Squarespace, Wix.
**Hosting:** Netlify, Vercel, Cloudflare, AWS CloudFront, Azure, Google Cloud, Fly.io, Render, Railway, GitHub Pages.
**Analytics:** GA4, GTM, Meta Pixel, Hotjar, Clarity, Plausible, Umami, PostHog, Mixpanel, Segment, Amplitude.

### Keyword Analysis
Top keyword extraction with density percentages, distribution across headings vs body content.

---

## Export Options

- **PDF** -- branded report with all findings, grades, and recommendations
- **CSV** -- full data export for spreadsheets

---

## Grading Scale

| Grade | Score |
|-------|-------|
| A+ | 97%+ |
| A | 93%+ |
| A- | 90%+ |
| B+ | 87%+ |
| B | 83%+ |
| B- | 80%+ |
| C+ | 77%+ |
| C | 73%+ |
| C- | 70%+ |
| D/F | Below 70% |

Each category (Security, SEO, Performance, Privacy, Accessibility) gets its own grade. The overall grade is a weighted composite.

---

## Architecture

```
site-inspector/
  analyzers/
    security.js      # Security header analysis
    seo.js           # On-page + technical SEO (55+ checks)
    performance.js   # Core Web Vitals + resource analysis
    privacy.js       # Consent, cookies, trackers, GDPR
    accessibility.js # WCAG AA checks
    tech-detect.js   # Framework/CMS/hosting fingerprinting
    grading.js       # A+ to F grade calculation
  popup/
    popup.html       # Extension popup UI
    popup.js         # Analysis orchestration + UI rendering
    popup.css        # Styles (light + dark mode)
    report.js        # PDF report generation
  content-script.js  # DOM data collection (runs on every page)
  background.js      # Service worker (HTTP header capture)
  manifest.json      # Chrome Extension manifest v3
```

**How it works:**
1. `content-script.js` runs on every page load, extracts DOM signals (headings, meta tags, images, links, cookies, performance metrics, accessibility attributes, tech stack fingerprints)
2. `background.js` captures HTTP response headers via the webRequest API
3. When you click the extension, `popup.js` combines both data sources and runs all 6 analyzers in parallel
4. Results are rendered in the popup with grades, detailed checks, and recommendations

---

## Privacy

This extension:
- Does **not** collect any user data
- Does **not** send data to any server
- Does **not** use analytics or tracking
- Runs **entirely locally** in your browser
- Only makes network requests to the site you're inspecting (robots.txt, sitemap, llms.txt checks)

---

## Version History

### 1.4.1 (April 2026)
- Privacy policy detection now scans the full URL path (catches `/legal/privacy`, `/about/privacy-notice`); probe list expanded from 9 to 21 paths
- Terms/cookie policy detection: added URL probe fallback (catches sites that host `/cookies`, `/legal`, `/tos`, `/villkor`, `/kakor` without a footer link)
- AI training bot detection: bot list grew from 5 to 19 (added ClaudeBot, OAI-SearchBot, PerplexityBot, Applebot-Extended, Bytespider, Amazonbot, Meta-ExternalAgent, cohere-ai, YouBot, and more)
- AI training bot detection: replaced naive regex with a proper robots.txt parser — `Disallow: /admin` no longer falsely registers as fully blocking a bot
- Consent banner detection: 30+ platforms (added CookieFirst, Borlabs, CookieLawInfo, Civic Cookie Control, Sourcepoint, Seers, Enzuzo, tarte au citron, FreePrivacyPolicy, illow, ConsentCookie, TermsFeed) plus secondary CDN domains (cdn.cookielaw.org, app.usercentrics.eu)
- Consent cookie fallback: matches 25+ specific cookie names so consent is detected even when the script is blocked
- Sitemap detection: 13 probe paths (added WordPress core `/wp-sitemap.xml`, Yoast `/page-sitemap.xml`, gzipped variants); checks robots.txt-declared sitemap first
- llms.txt: also checks `/llms-full.txt`
- security.txt: adds the RFC 9116 `/security.txt` fallback location; line-anchored Contact: matcher to avoid false positives on HTML 404 pages

### 1.4.0 (April 2026)
- Redirect detection: prevents header/content mixing after navigation
- Performance scoring rebalanced: graduated thresholds for DOMContentLoaded, Full Load, TTFB
- URL length check uses canonical URL (no longer penalized by UTM params)
- CSP: subdomain wildcards (`*.example.com`) no longer flagged as bare wildcards
- Consent banner: added CookieScript, HubSpot Cookie Banner

### 1.3.0 (April 2026)
- 130+ checks (up from 80+)
- New: llms.txt AI search readiness check
- New: AI training bot blocking detection (GPTBot, CCBot, anthropic-ai)
- New: Meta description CTA analysis
- New: Alt text quality check (catches generic "image", "logo")
- New: External outbound link count
- New: FAQ schema vs visible content validation
- New: Title truncation warning (>60 chars)
- New: OG image dimensions check (1200x630)
- New: Rating/review schema consistency
- New: Google Fonts family count
- New: Inline CSS bloat detection (>50KB)
- New: Page builder detection (Elementor, Divi, Bricks, Webflow, etc.)
- Removed: Outreach email generator
- Footer now shows version number
- "Need help?" links to /platform instead of homepage

### 1.2.0
- Initial public release
- 80+ checks across 6 categories
- PDF and CSV export
- Dark mode
- SERP preview
- Keyword analysis

---

## Built By

[Bright Interaction](https://brightinteraction.com) -- security and compliance infrastructure for European businesses. Based in Malmo, Sweden.

Built by [Tom Isgren](https://brightinteraction.com/about/tom-isgren), who scored 100/100 on his own scanner after auditing 599 Swedish law firms and 17 cybersecurity companies.
