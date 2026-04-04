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
      else if (name.match(/^(cookie.?consent|cookieyes|cc_|gdpr|euconsent|CookieConsent|cmplz|moove_gdpr)/)) category = 'consent';
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
      else if (d.match(/hubspot|marketo|pardot/)) category = 'Marketing';
      else if (d.match(/youtube|vimeo/)) category = 'Video';
      else if (d.match(/wp\.com|wordpress|s\.w\.org|w\.org/)) category = 'WordPress';
      else if (d.match(/tiktok/)) category = 'TikTok';
      else if (d.match(/pinterest/)) category = 'Pinterest';
      else if (d.match(/clarity\.ms/)) category = 'Microsoft Clarity';
      else if (d.match(/cookiebot|cookieconsent|onetrust|usercentrics|didomi|iubenda|consentmanager|termly|cookieyes/)) category = 'Consent';
      else if (d.match(/ahrefs|semrush|moz\.com|searchconsole/)) category = 'SEO';
      else if (d.match(/unpkg\.com|jsdelivr|cdnjs|fastly|stackpath|bunny\.net|keycdn|ajax\.googleapis|code\.jquery\.com/)) category = 'CDN';
      else if (d.match(/website-files\.com|webflow\.com|d3e54v103j8qbb\.cloudfront/)) category = 'Webflow CDN';
      else if (d.match(/posthog|heap\.io|plausible|umami/)) category = 'Analytics';
      else if (d.match(/recaptcha|hcaptcha|turnstile|challenges\.cloudflare/)) category = 'Security';
      else if (d.match(/alttextify|accessibe|userway|equalweb/)) category = 'Accessibility';
      else if (d.match(/typekit|fonts\.bunny|use\.typekit/)) category = 'Fonts';
      else if (d.match(/maps\.google|mapbox|openstreetmap/)) category = 'Maps';
      else if (d.match(/calendly|cal\.com|acuity/)) category = 'Booking';
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
      { pattern: /onetrust/, name: 'OneTrust' },
      { pattern: /quantcast|quantserve/, name: 'Quantcast' },
      { pattern: /iubenda/, name: 'Iubenda' },
      { pattern: /cookieconsent/, name: 'CookieConsent' },
      { pattern: /osano/, name: 'Osano' },
      { pattern: /trustarc/, name: 'TrustArc' },
      { pattern: /didomi/, name: 'Didomi' },
      { pattern: /axeptio/, name: 'Axeptio' },
      { pattern: /consentmanager/, name: 'Consentmanager' },
      { pattern: /complianz/, name: 'Complianz' },
      { pattern: /termly/, name: 'Termly' },
      { pattern: /cookieyes/, name: 'CookieYes' },
      { pattern: /cookieproof|consent\..*\/loader/, name: 'CookieProof' },
      { pattern: /usercentrics/, name: 'Usercentrics' },
      { pattern: /klaro/, name: 'Klaro' },
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
      const consentCookie = (domData.cookies || []).find((c) =>
        c.name.toLowerCase().match(/consent|gdpr|euconsent|cookieproof|cc_cookie/)
      );
      if (consentCookie) consentProvider = 'Unknown (consent cookie found)';
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
      { pattern: /google-analytics|googletagmanager|gtag/, cookiePattern: /^(_ga|_gid|_gat|_gcl|__utm)/, name: 'Google Analytics/GTM' },
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
      if (foundInScripts || foundInCookies) trackers.push(tp.name);
    }

    results.trackers = trackers;
    results.maxScore += 2;
    if (trackers.length <= 2) results.score += 2;
    else if (trackers.length <= 5) results.score += 1;

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

    // 1. Check DOM links for privacy policy
    const privacyLink = links.find((l) => {
      const path = l.href.replace(/\/$/, '').split('/').pop() || '';
      const isPrivacyPage = /^(privacy|gdpr|integritet|personuppgift|dataskydd|privacy-?policy|sekretess)$/i.test(path);
      const textMatch = l.text.match(/\b(privacy|integritet|personuppgift|dataskydd|sekretess)/i);
      return isPrivacyPage || textMatch;
    });

    // 2. If not found in DOM, probe common privacy policy URLs
    let probedUrl = null;
    if (!privacyLink && origin) {
      const commonPaths = [
        '/privacy', '/privacy-policy', '/integritetspolicy', '/sekretess',
        '/personuppgiftspolicy', '/dataskyddspolicy', '/gdpr',
        '/sv/privacy', '/en/privacy', '/privacy-policy/',
      ];
      for (const path of commonPaths) {
        try {
          const resp = await fetchWithTimeout(`${origin}${path}`, { method: 'HEAD', cache: 'no-cache' });
          if (resp.ok) {
            probedUrl = `${origin}${path}`;
            break;
          }
        } catch {}
      }
    }

    const found = privacyLink || probedUrl;
    results.maxScore += 2;
    if (found) results.score += 2;
    results.checks.push({
      name: 'Privacy Policy Link',
      passed: !!found,
      weight: 2,
      detail: found
        ? (privacyLink ? privacyLink.href : `${probedUrl} (found via URL probe, not linked on page)`)
        : 'No privacy policy found in page links or common URLs',
      recommendation: found ? null : 'Add a visible privacy policy link (required by GDPR)',
    });

    // 3. Check terms / cookie policy links
    const termsLink = links.find((l) =>
      l.href.match(/terms|villkor|cookie.?polic/i) ||
      l.text.match(/terms|villkor|cookie.?polic/i)
    );

    results.maxScore += 1;
    if (termsLink) results.score += 1;
    results.checks.push({
      name: 'Terms / Cookie Policy Link',
      passed: !!termsLink,
      weight: 1,
      detail: termsLink ? termsLink.href : 'No terms or cookie policy link found',
      recommendation: termsLink ? null : 'Consider adding terms of service and/or cookie policy links',
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
      if (resp.ok) {
        const text = await resp.text();
        const aiTrainingBots = ['GPTBot', 'CCBot', 'anthropic-ai', 'Google-Extended', 'ChatGPT-User'];
        const blocked = aiTrainingBots.filter(bot => {
          const regex = new RegExp(`user-agent:\\s*${bot}[\\s\\S]*?disallow:\\s*/`, 'i');
          return regex.test(text);
        });
        const allBlocked = blocked.length >= 3;
        results.maxScore += 2;
        if (allBlocked) results.score += 2;
        else if (blocked.length > 0) results.score += 1;
        results.checks.push({
          name: 'AI Training Bots Blocked',
          passed: allBlocked,
          weight: 2,
          detail: blocked.length > 0 ? `Blocking: ${blocked.join(', ')}` : 'No AI training bots blocked in robots.txt',
          recommendation: allBlocked ? null : 'Block AI training crawlers (GPTBot, CCBot, anthropic-ai) in robots.txt to protect content from unauthorized training use',
        });
      }
    } catch {}
  },

  calculateGrade(score, maxScore) {
    return calculateGradePlusMinus(score, maxScore);
  },
};
