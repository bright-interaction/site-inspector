// Privacy & Compliance Analyzer

const PrivacyAnalyzer = {
  async analyze(data) {
    const domData = data.domData || {};
    const headers = data.headers?.headers || {};
    const cookies = domData.cookies || [];
    const thirdParty = domData.thirdParty || [];
    const scripts = domData.scripts || [];

    const results = {
      score: 0,
      maxScore: 0,
      grade: '',
      checks: [],
      cookies: this.classifyCookies(cookies),
      thirdPartyDomains: this.classifyThirdParty(thirdParty),
      trackers: [],
    };

    // Store raw cookies for tracker detection
    results._cookies = cookies;

    this.checkConsentBanner(scripts, domData, results);
    this.checkCookieCount(cookies, results);
    this.checkCookieSecurity(cookies, results);
    this.checkThirdParty(thirdParty, results);
    this.checkTrackers(scripts, thirdParty, results);
    this.checkPreConsentTracking(cookies, results);
    await this.checkPrivacyPolicy(domData, results);
    this.checkDntGpc(headers, results);
    await this.checkAiTrainingBots(domData, results);

    results.grade = this.calculateGrade(results.score, results.maxScore);
    return results;
  },

  classifyCookies(cookies) {
    const classified = [];
    for (const c of cookies) {
      const name = c.name.toLowerCase();
      let category = 'unknown';
      if (name.match(/^(_ga|_gid|_gat|__utm)/)) category = 'analytics (Google)';
      else if (name.match(/^(_gcl_|_gcl_au|_gcl_aw|_gac_)/)) category = 'advertising (Google Ads)';
      else if (name.match(/^(_fb|_fbc|_fbp)/)) category = 'advertising (Meta)';
      else if (name.match(/^(li_|bcookie|bscookie)/)) category = 'advertising (LinkedIn)';
      else if (name.match(/^(session|sid|csrf|token|auth|jwt)/)) category = 'functional';
      else if (name.match(/^(cookie.?consent|cookieyes|cookieyes-consent|cc_|gdpr|euconsent|euconsent-v\d|cookieconsent|cmplz|moove_gdpr|didomi|didomi_token|cookiescript|cookiescript_consent|optanonconsent|optanonalertboxclosed|axeptio_|usercentrics|cookielawinfo|borlabs-cookie|wp-set-consent|cookiefirst|trustarc|notice_gdpr|ot-cookie|seers_consent|hs_opt_out|__hs_opt_out)/i)) category = 'consent';
      else if (name.match(/^(lang|locale|theme|dark|pref)/)) category = 'preferences';
      else if (name.match(/^(hubspot|hs_|__hs)/)) category = 'marketing (HubSpot)';
      else if (name.match(/^(intercom|ajs_)/)) category = 'marketing';
      else if (name.match(/^(pys_|pysTrafficSource|last_pys)/)) category = 'marketing (PixelYourSite)';
      else if (name.match(/^(_tt_|_ttp)/)) category = 'advertising (TikTok)';
      else if (name.match(/^(_pin_|_pinterest)/)) category = 'advertising (Pinterest)';
      else if (name.match(/^(_hjSession|_hj)/)) category = 'analytics (Hotjar)';
      else if (name.match(/^(_clck|_clsk|MUID)/)) category = 'analytics (Microsoft)';
      else if (name.match(/^(mp_|mixpanel)/)) category = 'analytics (Mixpanel)';
      else if (name.match(/^(amplitude)/)) category = 'analytics (Amplitude)';
      else if (name.match(/^(_uetsid|_uetvid)/)) category = 'advertising (Bing)';
      else if (name.match(/^(ph_)/)) category = 'analytics (PostHog)';

      classified.push({ name: c.name, category });
    }
    return classified;
  },

  classifyThirdParty(domains) {
    const classified = [];
    for (const d of domains) {
      let category = 'other';
      if (d.match(/google|gstatic|googleapis/)) category = 'Google';
      else if (d.match(/facebook|fbcdn|fb\.com/)) category = 'Meta';
      else if (d.match(/linkedin|licdn/)) category = 'LinkedIn';
      else if (d.match(/twitter|twimg/)) category = 'Twitter/X';
      else if (d.match(/cloudflare|cdnjs/)) category = 'CDN';
      else if (d.match(/fontawesome|fonts\.googleapis/)) category = 'Fonts';
      else if (d.match(/hotjar/)) category = 'Analytics';
      else if (d.match(/segment|mixpanel|amplitude/)) category = 'Analytics';
      else if (d.match(/stripe|paypal/)) category = 'Payment';
      else if (d.match(/sentry|bugsnag|datadog/)) category = 'Error Tracking';
      else if (d.match(/intercom|drift|crisp|tawk/)) category = 'Chat Widget';
      else if (d.match(/hubspot|hsadspixel|hs-analytics|hsappstatic|hscollectedforms|hs-scripts|usemessages\.com|marketo|pardot/)) category = 'Marketing';
      else if (d.match(/youtube|vimeo/)) category = 'Video';
      else if (d.match(/wp\.com|wordpress|s\.w\.org|w\.org/)) category = 'WordPress';
      else if (d.match(/tiktok/)) category = 'TikTok';
      else if (d.match(/pinterest/)) category = 'Pinterest';
      else if (d.match(/clarity\.ms/)) category = 'Microsoft Clarity';
      else if (d.match(/cookiebot|cookieconsent|onetrust|cookielaw\.org|usercentrics|didomi|iubenda|consentmanager|termly|cookieyes|cookie-?script|hs-banner|privacy-center\.org|trustarc|truste\.com|osano|axeptio|complianz|cookiefirst|borlabs|cookielawinfo|sourcepoint|sp-prod|civic.*cookie|seers|enzuzo|tarteaucitron|illow|klaro|quantcast/)) category = 'Consent';
      else if (d.match(/bat\.bing\.|bing\.net/)) category = 'Advertising (Bing)';
      else if (d.match(/snapchat|sc-static\.net/)) category = 'Snapchat';
      else if (d.match(/storyblok/)) category = 'Headless CMS';
      else if (d.match(/ahrefs|semrush|moz\.com|searchconsole/)) category = 'SEO';
      else if (d.match(/unpkg\.com|jsdelivr|cdnjs|fastly|stackpath|bunny\.net|keycdn|ajax\.googleapis|code\.jquery\.com|maxcdn\.bootstrapcdn|cloudflareinsights/)) category = 'CDN';
      else if (d.match(/squarespace|sqspcdn/)) category = 'Squarespace';
      else if (d.match(/website-files\.com|webflow\.com|d3e54v103j8qbb\.cloudfront/)) category = 'Webflow CDN';
      else if (d.match(/posthog|heap\.io|plausible|umami/)) category = 'Analytics';
      else if (d.match(/recaptcha|hcaptcha|turnstile|challenges\.cloudflare/)) category = 'Security';
      else if (d.match(/alttextify|accessibe|userway|equalweb/)) category = 'Accessibility';
      else if (d.match(/typekit|fonts\.bunny|use\.typekit/)) category = 'Fonts';
      else if (d.match(/maps\.google|mapbox|openstreetmap/)) category = 'Maps';
      else if (d.match(/calendly|cal\.com|acuity/)) category = 'Booking';
      else if (d.match(/trustpilot/)) category = 'Reviews';
      else if (d.match(/voyado/)) category = 'Marketing';
      else if (d.match(/leadsy\.ai|qualified\.com/)) category = 'Sales';
      else if (d.match(/newrelic|nr-data/)) category = 'Monitoring';
      else if (d.match(/^[a-z]{32}$/)) continue; // skip Chrome extension IDs

      if (!d || !d.trim()) continue; // skip empty hostnames
      classified.push({ domain: d, category });
    }
    return classified;
  },

  checkConsentBanner(scripts, domData, results) {
    const scriptSrcs = scripts.map((s) => (s.src || '').toLowerCase()).join(' ');
    const inlineScripts = scripts.map((s) => (s.inlineSnippet || '').toLowerCase()).join(' ');

    let consentProvider = null;

    const knownPlatforms = [
      { pattern: /cookiebot/, name: 'Cookiebot' },
      { pattern: /onetrust|cookielaw\.org|cdn\.cookielaw/, name: 'OneTrust' },
      { pattern: /quantcast|quantserve/, name: 'Quantcast' },
      { pattern: /iubenda/, name: 'Iubenda' },
      { pattern: /cookieconsent/, name: 'CookieConsent' },
      { pattern: /osano/, name: 'Osano' },
      { pattern: /trustarc|truste\.com/, name: 'TrustArc' },
      { pattern: /didomi/, name: 'Didomi' },
      { pattern: /axeptio/, name: 'Axeptio' },
      { pattern: /consentmanager|delivery\.consentmanager/, name: 'Consentmanager' },
      { pattern: /complianz/, name: 'Complianz' },
      { pattern: /termly/, name: 'Termly' },
      { pattern: /cookieyes/, name: 'CookieYes' },
      { pattern: /cookieproof|consent\..*\/loader/, name: 'CookieProof' },
      { pattern: /usercentrics|app\.usercentrics/, name: 'Usercentrics' },
      { pattern: /klaro/, name: 'Klaro' },
      { pattern: /cookie-?script/, name: 'CookieScript' },
      { pattern: /hs-banner|hubspot.*cookie-?banner/, name: 'HubSpot Cookie Banner' },
      { pattern: /cookiefirst/, name: 'CookieFirst' },
      { pattern: /borlabs-cookie|borlabs/, name: 'Borlabs Cookie' },
      { pattern: /cookielawinfo|gdpr-cookie-compliance/, name: 'GDPR Cookie Consent (CookieLawInfo)' },
      { pattern: /civic.*cookie.*control|cookiecontrol\.civic/, name: 'Civic Cookie Control' },
      { pattern: /seers.*consent|seersco/, name: 'Seers' },
      { pattern: /enzuzo/, name: 'Enzuzo' },
      { pattern: /privacypolicies\.com|cookie-?notice/, name: 'PrivacyPolicies.com' },
      { pattern: /sourcepoint|sp-prod/, name: 'Sourcepoint' },
      { pattern: /tarteaucitron/, name: 'tarte au citron' },
      { pattern: /freeprivacypolicy/, name: 'FreePrivacyPolicy' },
      { pattern: /illow/, name: 'illow' },
      { pattern: /consentcookie/, name: 'ConsentCookie' },
      { pattern: /termsfeed/, name: 'TermsFeed' },
    ];

    for (const p of knownPlatforms) {
      if (p.pattern.test(scriptSrcs) || p.pattern.test(inlineScripts)) {
        consentProvider = p.name;
        break;
      }
    }

    if (!consentProvider) {
      const gatedScripts = scripts.filter((s) => s.dataConsent);
      if (gatedScripts.length > 0) {
        const categories = [...new Set(gatedScripts.map((s) => s.dataConsent))];
        consentProvider = `Custom (consent-gated: ${categories.join(', ')})`;
      }
    }

    if (!consentProvider) {
      const blockedScripts = scripts.filter((s) => s.type === 'text/plain' && s.src);
      if (blockedScripts.length > 0) {
        consentProvider = 'Custom (blocked scripts detected)';
      }
    }

    if (!consentProvider) {
      // Fallback: match cookies set by known consent platforms when their script is blocked/lazy
      const consentCookiePattern = /^(cookieconsent|cookieconsent_status|cookieyes-consent|optanonconsent|optanonalertboxclosed|eupubconsent|euconsent|euconsent-v2|consent|gdpr|cookieproof|cc_cookie|cmplz_|moove_gdpr|didomi_token|euconsent-v\d|hs_opt_out|__hs_opt_out|cookielawinfo-checkbox|wp-set-consent|borlabs-cookie|axeptio_cookies|axeptio_authorized_vendors|usercentrics|cookiescript_consent|cookiefirst-consent|trustarc|notice_gdpr_prefs|ot-cookie-consent|cmpcookie|consentid|seers_consent)/i;
      const consentCookie = (domData.cookies || []).find((c) => consentCookiePattern.test(c.name));
      if (consentCookie) consentProvider = `Unknown (consent cookie found: ${consentCookie.name})`;
    }

    results.maxScore += 3;
    if (consentProvider) results.score += 3;
    results.checks.push({
      name: 'Consent Banner',
      passed: !!consentProvider,
      weight: 3,
      detail: consentProvider || 'No consent mechanism found',
      recommendation: consentProvider ? null : 'Add a cookie consent banner for GDPR/ePrivacy compliance',
    });
  },

  checkCookieCount(cookies, results) {
    const count = cookies.length;
    results.maxScore += 1;
    const ok = count <= 10;
    if (ok) results.score += 1;
    results.checks.push({
      name: 'Cookie Count',
      passed: ok,
      weight: 1,
      detail: `${count} cookie(s) readable from JS`,
      recommendation: ok ? null : 'Review and minimize the number of cookies set',
    });
  },

  checkCookieSecurity(cookies, results) {
    // Check if auth/session cookies are exposed to JS (not HttpOnly)
    // Exclude known analytics cookies that happen to contain "session" in their name
    const analyticsSessionPattern = /^(_hj|_ga|_gid|_fb|_tt|mp_|amplitude|_pk|_clck|ajs_)/i;
    const sessionCookies = cookies.filter((c) => {
      const name = c.name.toLowerCase();
      if (analyticsSessionPattern.test(name)) return false;
      return name.match(/^(session|sid|ssid|connect\.sid|phpsessid|jsessionid|aspsessionid|auth|token|jwt|csrf|_csrf|xsrf)/);
    });

    if (sessionCookies.length > 0) {
      results.maxScore += 2;
      results.checks.push({
        name: 'Session Cookies Not HttpOnly',
        passed: false,
        weight: 2,
        detail: `${sessionCookies.length} session cookie(s) readable from JS: ${sessionCookies.map((c) => c.name).join(', ')}`,
        recommendation: 'Session and auth cookies should be HttpOnly to prevent XSS theft',
      });
    }

    // Note: SameSite cannot be read from document.cookie — info only, no score impact
    if (cookies.length > 0) {
      results.checks.push({
        name: 'Cookie SameSite Awareness',
        passed: null,
        weight: 0,
        detail: `${cookies.length} JS-accessible cookies — SameSite attribute not readable from JS. Verify SameSite=Lax or Strict in server config.`,
        recommendation: 'Set SameSite=Lax (or Strict) on all cookies to prevent CSRF attacks',
      });
    }
  },

  checkThirdParty(thirdParty, results) {
    const count = thirdParty.length;
    results.maxScore += 2;
    const ok = count <= 10;
    if (ok) results.score += 2;
    else if (count <= 20) results.score += 1;

    results.checks.push({
      name: 'Third-Party Domains',
      passed: ok,
      weight: 2,
      detail: `${count} external domain(s)`,
      recommendation: ok ? null : 'Reduce third-party dependencies to improve privacy and performance',
    });
  },

  checkTrackers(scripts, thirdParty, results) {
    const trackers = [];
    const scriptSrcs = scripts.map((s) => (s.src || '').toLowerCase());
    const inlineSnippets = scripts.map((s) => (s.inlineSnippet || '').toLowerCase());
    const cookieNames = (results._cookies || []).map((c) => c.name.toLowerCase());

    const trackerPatterns = [
      { pattern: /google-analytics|gtag\/js/, cookiePattern: /^(_ga|_gid|_gat|__utm)/, name: 'Google Analytics (GA4)' },
      { pattern: /googletagmanager\.com\/gtm\.js/, cookiePattern: /^(_gcl)/, name: 'Google Tag Manager' },
      { pattern: /facebook\.net|connect\.facebook|fbevents/, cookiePattern: /^(_fb|_fbc|_fbp)/, name: 'Meta Pixel' },
      { pattern: /hotjar/, cookiePattern: /^(_hjSession|_hj)/, name: 'Hotjar' },
      { pattern: /clarity\.ms/, cookiePattern: /^(_clck|_clsk|MUID)/, name: 'Microsoft Clarity' },
      { pattern: /linkedin.*insight|snap\.licdn/, cookiePattern: /^(li_|bcookie|bscookie)/, name: 'LinkedIn Insight' },
      { pattern: /doubleclick|googlesyndication|googleadservices/, name: 'Google Ads' },
      { pattern: /tiktok/, cookiePattern: /^(_tt_|_ttp)/, name: 'TikTok Pixel' },
      { pattern: /pinterest/, cookiePattern: /^(_pin_|_pinterest)/, name: 'Pinterest Tag' },
      { pattern: /hubspot/, cookiePattern: /^(hubspot|hs_|__hs)/, name: 'HubSpot' },
      { pattern: /segment\.com|segment\.io/, cookiePattern: /^(ajs_)/, name: 'Segment' },
      { pattern: /mixpanel/, cookiePattern: /^(mp_|mixpanel)/, name: 'Mixpanel' },
      { pattern: /fullstory/, name: 'FullStory' },
      { pattern: /mouseflow/, name: 'Mouseflow' },
      { pattern: /crazyegg/, name: 'Crazy Egg' },
      { pattern: /heap\.io|heapanalytics/, name: 'Heap' },
      { pattern: /amplitude/, cookiePattern: /^(amplitude)/, name: 'Amplitude' },
      { pattern: /posthog/, cookiePattern: /^(ph_)/, name: 'PostHog' },
    ];

    for (const tp of trackerPatterns) {
      const foundInScripts = scriptSrcs.some((s) => tp.pattern.test(s)) ||
        inlineSnippets.some((s) => tp.pattern.test(s)) ||
        thirdParty.some((d) => tp.pattern.test(d));
      const foundInCookies = tp.cookiePattern && cookieNames.some((c) => tp.cookiePattern.test(c));
      // Require script/domain evidence to report a tracker. Cookie-only detection
      // is unreliable: cookies leak across subdomains, persist from browser
      // extensions, or carry over from other sites on the same root domain.
      if (foundInScripts) {
        trackers.push(tp.name);
      } else if (foundInCookies) {
        trackers.push(`${tp.name} (cookie only — may be from another subdomain or extension)`);
      }
    }

    results.trackers = trackers;
    // Only count confirmed (script-detected) trackers for scoring, not cookie-only
    const confirmedTrackers = trackers.filter((t) => !t.includes('cookie only'));
    results.maxScore += 2;
    if (confirmedTrackers.length <= 2) results.score += 2;
    else if (confirmedTrackers.length <= 5) results.score += 1;

    results.checks.push({
      name: 'Tracker Count',
      passed: trackers.length <= 2,
      weight: 2,
      detail: trackers.length > 0 ? trackers.join(', ') : 'No trackers detected',
      recommendation: trackers.length > 2 ? 'Review if all trackers are necessary and disclosed in privacy policy' : null,
    });
  },

  checkPreConsentTracking(cookies, results) {
    // Check if tracking cookies exist without a consent banner
    const hasConsent = results.checks.find((c) => c.name === 'Consent Banner')?.passed;
    const trackingCookies = cookies.filter((c) => {
      const name = c.name.toLowerCase();
      return name.match(/^(_ga|_gid|_gat|__utm|_gcl|_fb|_fbc|_fbp|_hj|_tt_|_ttp|_pin_|pys_|_clck|_clsk|mp_|_uetsid|_uetvid)/);
    });

    if (trackingCookies.length > 0 && !hasConsent) {
      results.maxScore += 3;
      results.checks.push({
        name: 'Pre-Consent Tracking',
        passed: false,
        weight: 3,
        detail: `${trackingCookies.length} tracking cookie(s) set without consent: ${trackingCookies.map((c) => c.name).slice(0, 5).join(', ')}${trackingCookies.length > 5 ? '...' : ''}`,
        recommendation: 'Tracking cookies are set before user consent — this violates GDPR/ePrivacy. Implement a consent banner that blocks tracking until opt-in.',
      });
    } else if (trackingCookies.length > 0 && hasConsent) {
      // Consent banner exists but tracking cookies are present on first load — could be pre-consent
      // This is informational since we can't distinguish "user already consented" from "pre-consent"
      results.checks.push({
        name: 'Pre-Consent Tracking',
        passed: null,
        weight: 0,
        detail: `${trackingCookies.length} tracking cookie(s) present — consent banner detected. Verify cookies are only set after explicit opt-in.`,
        recommendation: null,
      });
    }
  },

  async checkPrivacyPolicy(domData, results) {
    const links = domData.links || [];
    const origin = domData.pageOrigin || '';

    // 1. Check DOM links for privacy policy (prefer same-domain, then accept external)
    const isSameDomain = (href) => {
      try { return new URL(href).hostname === new URL(origin).hostname; } catch { return false; }
    };
    const matchesPrivacy = (l) => {
      // Match the full path so /legal/privacy and /about/privacy-notice both count
      let pathname = '';
      try { pathname = new URL(l.href).pathname.replace(/\/$/, '').toLowerCase(); } catch { pathname = (l.href || '').toLowerCase(); }
      const isPrivacyPage = /(^|\/)(privacy|privacy-?(policy|notice|statement)|data-?protection|gdpr|integritet|integritetspolicy|personuppgift(er|spolicy)?|dataskydd(spolicy)?|sekretess(policy)?)(\/?$)/i.test(pathname);
      const textMatch = l.text && /\b(privacy(\s+(policy|notice|statement))?|data\s+protection|integritet|personuppgift|dataskydd|sekretess)\b/i.test(l.text);
      return isPrivacyPage || textMatch;
    };
    // Prefer same-domain privacy policy; fall back to external only if no same-domain match
    const sameDomainLink = links.find((l) => matchesPrivacy(l) && isSameDomain(l.href));
    const externalLink = !sameDomainLink ? links.find((l) => matchesPrivacy(l)) : null;
    const privacyLink = sameDomainLink || externalLink;
    const isExternalPrivacy = !sameDomainLink && !!externalLink;

    // 2. If not found in DOM, probe common privacy policy URLs
    let probedUrl = null;
    if (!privacyLink && origin) {
      const commonPaths = [
        // English
        '/privacy', '/privacy-policy', '/privacy_policy', '/privacypolicy',
        '/privacy-notice', '/privacy-statement', '/privacy.html',
        '/data-protection', '/dataprotection', '/gdpr',
        '/legal/privacy', '/legal/privacy-policy', '/legal',
        '/about/privacy', '/policies/privacy', '/policy/privacy', '/policies',
        // Swedish
        '/integritetspolicy', '/integritet', '/sekretess', '/sekretesspolicy',
        '/personuppgiftspolicy', '/dataskyddspolicy', '/dataskydd',
        // Language-prefixed
        '/sv/privacy', '/en/privacy', '/sv/integritetspolicy', '/en/privacy-policy',
      ];
      for (const path of commonPaths) {
        try {
          const resp = await fetchWithTimeout(`${origin}${path}`, { method: 'HEAD', cache: 'no-cache', redirect: 'follow' });
          if (resp.ok) {
            probedUrl = `${origin}${path}`;
            break;
          }
        } catch {}
      }
    }

    const found = privacyLink || probedUrl;
    // External-only privacy policy (e.g. linking to Google's policy) is a warning, not a pass
    const passesCheck = !!found && !isExternalPrivacy;
    results.maxScore += 2;
    if (found) results.score += (isExternalPrivacy ? 1 : 2);
    results.checks.push({
      name: 'Privacy Policy Link',
      passed: passesCheck,
      weight: 2,
      detail: found
        ? (isExternalPrivacy
          ? `${privacyLink.href} (external — not on your domain)`
          : (privacyLink ? privacyLink.href : `${probedUrl} (found via URL probe, not linked on page)`))
        : 'No privacy policy found in page links or common URLs',
      recommendation: isExternalPrivacy
        ? 'Privacy policy links to an external domain — host your own privacy policy on your site'
        : (found ? null : 'Add a visible privacy policy link (required by GDPR)'),
    });

    // 3. Check terms / cookie policy links (DOM scan + URL probe fallback)
    const matchesTerms = (l) => {
      const path = l.href.replace(/\/$/, '').split('/').pop() || '';
      const isTermsPage = /^(terms|terms-?of-?(service|use)|tos|legal|villkor|allm[aä]nna-?villkor|anv[aä]ndarvillkor|kop[ -]?villkor|cookie-?polic[a-z]*|cookies?|kakor|kak-?polic[a-z]*|kak-?information)$/i.test(path);
      const textMatch = l.text.match(/\b(terms of (service|use)|terms|villkor|kakor|kakpolicy|cookies?|cookie\s*polic[a-z]*|legal)\b/i);
      return isTermsPage || textMatch;
    };
    const termsLink = links.find(matchesTerms);

    let probedTermsUrl = null;
    if (!termsLink && origin) {
      const commonTermsPaths = [
        '/cookie-policy', '/cookiepolicy', '/cookies', '/cookie',
        '/kakor', '/kakpolicy', '/kakinformation', '/kak-policy',
        '/terms', '/terms-of-service', '/terms-of-use', '/tos', '/legal',
        '/villkor', '/allmanna-villkor', '/allmänna-villkor', '/anvandarvillkor', '/användarvillkor',
        '/sv/cookies', '/en/cookies', '/sv/villkor', '/en/terms',
      ];
      for (const path of commonTermsPaths) {
        try {
          const resp = await fetchWithTimeout(`${origin}${path}`, { method: 'HEAD', cache: 'no-cache', redirect: 'follow' });
          if (resp.ok) {
            probedTermsUrl = `${origin}${path}`;
            break;
          }
        } catch {}
      }
    }

    const termsFound = termsLink || probedTermsUrl;
    results.maxScore += 1;
    if (termsFound) results.score += 1;
    results.checks.push({
      name: 'Terms / Cookie Policy Link',
      passed: !!termsFound,
      weight: 1,
      detail: termsFound
        ? (termsLink ? termsLink.href : `${probedTermsUrl} (found via URL probe, not linked on page)`)
        : 'No terms or cookie policy link found',
      recommendation: termsFound ? null : 'Consider adding terms of service and/or cookie policy links',
    });
  },

  checkDntGpc(headers, results) {
    const tkHeader = headers['tk'];
    const hasTk = !!tkHeader;

    results.maxScore += 1;
    if (hasTk) results.score += 1;
    results.checks.push({
      name: 'DNT/GPC Awareness',
      passed: hasTk,
      weight: 1,
      detail: hasTk
        ? `Tk header: ${tkHeader}`
        : 'No Tk header — not signaling Do Not Track compliance',
      recommendation: hasTk ? null : 'Add Tk: N header to signal DNT/GPC compliance',
    });
  },

  async checkAiTrainingBots(domData, results) {
    const origin = domData.pageOrigin || '';
    if (!origin) return;
    try {
      const resp = await fetchWithTimeout(`${origin}/robots.txt`, { cache: 'no-cache' });
      if (!resp.ok) return;
      const text = await resp.text();

      // Known AI training / scraping crawlers (2024-2025)
      const aiTrainingBots = [
        'GPTBot', 'ChatGPT-User', 'OAI-SearchBot',           // OpenAI
        'anthropic-ai', 'Claude-Web', 'ClaudeBot',           // Anthropic
        'Google-Extended',                                    // Google AI training
        'Applebot-Extended',                                  // Apple AI training
        'FacebookBot', 'Meta-ExternalAgent',                 // Meta
        'CCBot',                                              // Common Crawl
        'PerplexityBot', 'Perplexity-User',                  // Perplexity
        'Bytespider',                                         // ByteDance/TikTok
        'Amazonbot',                                          // Amazon
        'cohere-ai', 'cohere-training-data-crawler',         // Cohere
        'YouBot',                                             // You.com
        'DuckAssistBot',                                      // DuckDuckGo
        'Diffbot', 'omgili',                                  // Scrapers
      ];

      // Parse robots.txt into user-agent groups so we know which directives apply to which bot.
      // A "block all" means the group containing the bot has Disallow: / (with no path after).
      const groups = this.parseRobotsTxt(text);
      const blocked = aiTrainingBots.filter((bot) => {
        const botLc = bot.toLowerCase();
        // Find any group that targets this bot (or *) and has a fully-blocking Disallow: /
        return groups.some((g) => {
          const targetsBot = g.userAgents.some((ua) => ua === botLc || ua === '*');
          if (!targetsBot) return false;
          // Need a Disallow: / line (exactly /, possibly with trailing whitespace/comment)
          const fullyBlocked = g.disallows.some((d) => d === '/' || d === '/*');
          // Only count wildcard "*" group as blocking AI bots if no Allow override
          if (g.userAgents.includes('*') && !g.userAgents.includes(botLc)) {
            // Wildcard group must fully block AND not have an Allow that opens things back up
            return fullyBlocked && !g.allows.some((a) => a === '/');
          }
          return fullyBlocked;
        });
      });

      const allBlocked = blocked.length >= 3;
      results.maxScore += 2;
      if (allBlocked) results.score += 2;
      else if (blocked.length > 0) results.score += 1;
      results.checks.push({
        name: 'AI Training Bots Blocked',
        passed: allBlocked,
        weight: 2,
        detail: blocked.length > 0
          ? `Blocking ${blocked.length}: ${blocked.slice(0, 5).join(', ')}${blocked.length > 5 ? '...' : ''}`
          : 'No AI training bots blocked in robots.txt',
        recommendation: allBlocked ? null : 'Block AI training crawlers (GPTBot, ClaudeBot, Google-Extended, PerplexityBot, etc.) in robots.txt to protect content from unauthorized training use',
      });
    } catch {}
  },

  // Parse robots.txt into groups of { userAgents: [], disallows: [], allows: [] }
  // Each group is a contiguous run of User-agent lines followed by directives.
  parseRobotsTxt(text) {
    const groups = [];
    let current = null;
    let expectingUa = true; // true after a directive line — next UA starts a new group
    const lines = text.split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.replace(/#.*$/, '').trim();
      if (!line) continue;
      const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
      if (!m) continue;
      const field = m[1].toLowerCase();
      const value = m[2].trim();
      if (field === 'user-agent') {
        if (expectingUa || !current) {
          current = { userAgents: [], disallows: [], allows: [] };
          groups.push(current);
          expectingUa = false;
        }
        current.userAgents.push(value.toLowerCase());
      } else if (current) {
        expectingUa = true;
        if (field === 'disallow') current.disallows.push(value);
        else if (field === 'allow') current.allows.push(value);
      }
    }
    return groups;
  },

  calculateGrade(score, maxScore) {
    return calculateGradePlusMinus(score, maxScore);
  },
};
