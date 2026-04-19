# Chrome Web Store Listing - Site Inspector v1.4.1

## Short Description (132 chars max)
One-click website audit: security, performance, SEO, privacy & accessibility. 140+ checks, A+ to F grading, free.

## Detailed Description

Site Inspector runs 140+ automated checks on any website in one click. No account needed, no data sent anywhere. Everything runs locally in your browser.

You get instant grades (A+ to F) across 6 categories:

SECURITY (21 checks)
- HTTPS, HSTS, CSP quality analysis
- Security headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy)
- SRI verification for third-party scripts
- Mixed content detection
- security.txt (RFC 9116) presence

SEO (55+ checks)
- Title tag length and quality
- Meta description CTA detection (English + Swedish)
- Heading hierarchy validation (H1 through H6)
- Open Graph and Twitter Card completeness
- OG image dimensions (1200x630 check)
- Structured data / JSON-LD detection and type listing
- FAQ schema vs visible content validation
- Canonical tag validation (tracking param aware)
- Hreflang tags
- External outbound link count
- Descriptive alt text quality (not just presence)
- llms.txt for AI search readiness
- robots.txt and XML sitemap detection
- SERP preview

PERFORMANCE (18 checks)
- Core Web Vitals: LCP, INP, CLS
- TTFB, FCP, DOM Content Loaded
- Page weight and request count
- Image format, lazy loading, dimensions
- Font loading (font-display, file count, Google Fonts family count)
- Inline CSS bloat detection
- Render-blocking script detection
- HTTP/2+ protocol check

PRIVACY (12 checks)
- Consent banner detection (30+ platforms supported)
- Pre-consent tracking detection (GDPR violation)
- Cookie count and security audit
- Third-party domain count
- Tracker identification
- AI training bot blocking check (19 crawlers: GPTBot, ClaudeBot, Google-Extended, PerplexityBot, Applebot-Extended, Bytespider, and more) — with proper robots.txt parsing
- Privacy policy detection (English + Swedish, with URL probe fallback for unlinked pages)
- Terms and cookie policy detection (English + Swedish, with URL probe fallback)

ACCESSIBILITY (21 checks)
- WCAG AA color contrast analysis (skips image/gradient backgrounds)
- Landmark roles (main, nav, header, footer)
- Skip navigation link
- Form labels and button labels
- Image alt text
- Video captions
- Heading order and structure
- Keyboard focus indicators

TECH STACK DETECTION
- Identifies frameworks, CMS platforms, page builders, hosting providers, and analytics tools
- Detects 30+ technologies across 5 categories

EXPORT OPTIONS
- PDF report with full findings
- CSV export for spreadsheets

KEYWORD ANALYSIS
- Top keyword extraction with density percentages
- Keyword distribution across headings vs body

Built by Bright Interaction (https://brightinteraction.com) - a security and compliance company based in Sweden. We use this tool ourselves to audit 599+ websites.

100% free. No ads. No tracking. No account required.

## Category
Developer Tools

## Language
English

## Privacy Policy URL
https://brightinteraction.com/privacy

## Homepage URL
https://brightinteraction.com/platform

## What's New in 1.4.1
- Privacy policy detection: scans the full URL path so /legal/privacy and /about/privacy-notice are now caught. Probe list expanded from 9 to 21 paths covering English variants (privacy-notice, data-protection, legal/privacy) and Swedish (integritetspolicy, sekretess, dataskydd)
- Terms / cookie policy detection: now mirrors the privacy policy logic with URL probe fallback. Catches sites that host /cookies, /legal, /tos, /villkor, /kakor without a footer link
- AI training bot detection: bot list grew from 5 to 19 — now catches ClaudeBot, OAI-SearchBot, PerplexityBot, Applebot-Extended, Bytespider, Amazonbot, Meta-ExternalAgent, cohere-ai, YouBot, and more
- AI training bot detection: replaced the naive regex with a proper robots.txt parser. Previously, "Disallow: /admin" could falsely register as fully blocking a bot — now requires an actual full-site block
- Consent banner detection: added 12 new platforms (30+ total)
- Consent banner detection: now matches secondary CDN domains so providers loaded from vendor CDNs are detected
- Consent cookie fallback: matches 25+ specific cookie names so consent is detected even when the script is blocked
- Sitemap detection: probe list grew from 3 to 13 paths — adds WordPress core (/wp-sitemap.xml), Yoast (/page-sitemap.xml, /post-sitemap.xml), gzipped variants, and /sitemap-index.xml. Now also checks the robots.txt-declared sitemap first
- llms.txt: also checks /llms-full.txt (the spec's full-content variant)
- security.txt: adds the RFC 9116 fallback location /security.txt. Tightened the Contact: matcher to a line-anchored regex to avoid false positives on HTML 404 pages

## What's New in 1.4.0
- Redirect detection: prevents mixing headers from one site with content from another after navigation
- Report URL now shows the actual analyzed page, not the tab URL (fixes wrong URL in reports)
- Performance scoring rebalanced: DOMContentLoaded and Full Load thresholds relaxed and graduated (no more F grades for 3-second loads)
- TTFB "good" threshold raised from 300ms to 500ms (realistic for most hosting)
- URL length check now uses canonical URL, no longer penalizes pages for UTM/tracking parameters
- CSP wildcard detection: no longer flags subdomain patterns (*.example.com) as bare wildcards
- Consent banner detection: added 2 new platforms
- Third-party domain classification: added Bing, Snapchat, Storyblok, Squarespace, Trustpilot, Voyado, New Relic, and more
- Cookie classification: added new consent cookie signatures
- Additional third-party domains now properly categorized

## What's New in 1.3.1
- Accuracy improvements from testing against Forbes, Apple, CDON, Nelly, Brownells, AlternativeTo, Product Hunt, and more
- FAQ schema: validates question text appears on page (any layout, not just accordions)
- Heading hierarchy: correctly fails when H1 is missing
- CTA detection: now supports Swedish meta descriptions
- Canonical check: no longer flags tracking params as mismatches
- Privacy policy: warns when policy links to external domain instead of your own
- Contrast analysis: skips text over images/gradients (eliminates false 1:1 ratios)
- TTFB thresholds aligned with Google guidance (300ms/800ms)
- Plaintext email detection: filters out logged-in user emails in navigation
- Empty link checks: SEO and Accessibility now use consistent criteria

## What's New in 1.3.0
- 12 new checks (130+ total, up from 80+)
- AI search readiness: llms.txt detection, AI training bot blocking check
- SEO: meta description CTA analysis, alt text quality, external link count, FAQ schema validation, title truncation warning, OG image dimensions
- Privacy: AI training bot detection in robots.txt
- Performance: Google Fonts count, inline CSS bloat detection
- Tech stack: page builder detection
- Removed: outreach email generator
