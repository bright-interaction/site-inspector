// Site Inspector — Content Script
// Runs in the page context to extract DOM-based signals

(function () {
  'use strict';

  function analyze() {
    // Only analyze HTTP(S) pages
    if (!location.protocol.startsWith('http')) return;
    const data = {
      meta: extractMeta(),
      scripts: extractScripts(),
      styles: extractStyles(),
      dom: extractDomSignals(),
      cookies: extractCookies(),
      thirdParty: extractThirdPartyRequests(),
      performance: extractPerformance(),
      seo: extractSeo(),
      links: extractLinks(),
      accessibility: extractAccessibility(),
      images: extractImageDetails(),
      fonts: extractFontInfo(),
      contrast: extractContrastSamples(),
      keywords: extractKeywords(),
      pageUrl: location.href,
      pageOrigin: location.origin,
      pageRootDomain: getRootDomain(location.hostname),
    };

    chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_DATA', data });
  }

  function extractMeta() {
    const meta = {};
    const tags = document.querySelectorAll('meta');
    const duplicates = {};

    tags.forEach((tag) => {
      const name = tag.getAttribute('name') || tag.getAttribute('property') || tag.getAttribute('http-equiv');
      if (name) {
        const key = name.toLowerCase();
        if (meta[key] !== undefined) {
          if (!duplicates[key]) duplicates[key] = 1;
          duplicates[key]++;
        }
        meta[key] = tag.getAttribute('content') || '';
      }
    });

    meta._duplicates = duplicates;
    meta.title = document.title || '';
    meta.lang = document.documentElement.lang || '';
    meta.charset = document.characterSet || '';

    // Check for canonical
    const canonical = document.querySelector('link[rel="canonical"]');
    meta.canonical = canonical ? canonical.href : '';

    // Check for robots
    const robots = document.querySelector('meta[name="robots"]');
    meta.robots = robots ? robots.content : '';

    // Preconnect / DNS-prefetch hints
    meta.preconnect = Array.from(document.querySelectorAll('link[rel="preconnect"]')).map((l) => l.href);
    meta.dnsPrefetch = Array.from(document.querySelectorAll('link[rel="dns-prefetch"]')).map((l) => l.href);
    meta.preload = Array.from(document.querySelectorAll('link[rel="preload"]')).map((l) => ({
      href: l.href,
      as: l.getAttribute('as') || '',
    }));

    return meta;
  }

  function extractScripts() {
    const scripts = [];
    document.querySelectorAll('script').forEach((s) => {
      scripts.push({
        src: s.src || null,
        type: s.type || null,
        async: s.async,
        defer: s.defer,
        crossorigin: s.crossOrigin,
        integrity: s.integrity || null,
        dataConsent: s.getAttribute('data-consent') || null,
        dataDomain: s.getAttribute('data-domain') || null,
        dataWebsiteId: s.getAttribute('data-website-id') || null,
        // Grab first 500 chars of inline scripts for pattern matching
        inlineSnippet: !s.src ? (s.textContent || '').slice(0, 500) : null,
      });
    });
    return scripts;
  }

  function extractStyles() {
    const styles = [];
    document.querySelectorAll('link[rel="stylesheet"]').forEach((l) => {
      styles.push({
        href: l.href || null,
        crossorigin: l.crossOrigin,
        integrity: l.integrity || null,
      });
    });

    // Inline style count and size
    const inlineStyles = document.querySelectorAll('style');
    let inlineStyleSize = 0;
    inlineStyles.forEach((s) => { inlineStyleSize += (s.textContent || '').length; });

    // Elements with inline style attribute
    const inlineStyleAttrs = document.querySelectorAll('[style]').length;

    // Sample class names from body for framework detection
    const allClasses = new Set();
    const elements = document.querySelectorAll('body *');
    const sampleSize = Math.min(elements.length, 200);
    for (let i = 0; i < sampleSize; i++) {
      const el = elements[i];
      el.classList.forEach((c) => allClasses.add(c));
    }

    return {
      links: styles,
      sampleClasses: Array.from(allClasses).slice(0, 300),
      inlineStyleCount: inlineStyles.length,
      inlineStyleSize,
      inlineStyleAttrs,
    };
  }

  function extractDomSignals() {
    const signals = {};

    // Framework mount points
    signals.hasReactRoot = !!(
      document.getElementById('root') ||
      document.getElementById('__next') ||
      document.querySelector('[data-reactroot]') ||
      document.querySelector('[data-react-helmet]')
    );
    signals.hasVueApp = !!(
      document.getElementById('app') ||
      document.getElementById('__nuxt') ||
      document.querySelector('[data-v-]') ||
      document.querySelector('[data-server-rendered]')
    );
    signals.hasSvelteKit = !!document.querySelector('[data-sveltekit-preload-data]');
    signals.hasAngular = !!(
      document.querySelector('[ng-app]') ||
      document.querySelector('[ng-version]') ||
      document.querySelector('app-root')
    );
    signals.hasAstro = !!(
      document.querySelector('[data-astro-cid]') ||
      document.querySelector('[data-astro-source-file]') ||
      document.querySelector('script[src*="/_astro/"]') ||
      document.querySelector('link[href*="/_astro/"]') ||
      document.querySelector('script[src*=".astro_astro_type_script"]')
    );

    // CMS signals
    signals.hasWordPress = !!(
      document.querySelector('meta[name="generator"][content*="WordPress"]') ||
      document.querySelector('link[href*="wp-content"]') ||
      document.querySelector('link[href*="wp-includes"]')
    );
    signals.hasShopify = !!(
      document.querySelector('meta[name="shopify"]') ||
      document.querySelector('link[href*="cdn.shopify.com"]') ||
      document.querySelector('script[src*="cdn.shopify.com"]')
    );
    signals.hasWebflow = !!(
      document.querySelector('html[data-wf-site]') ||
      document.querySelector('meta[content*="Webflow"]')
    );
    signals.hasSquarespace = !!(
      document.querySelector('meta[content*="Squarespace"]') ||
      document.querySelector('script[src*="squarespace"]')
    );
    signals.hasWix = !!(
      document.querySelector('meta[name="generator"][content*="Wix"]') ||
      document.querySelector('script[src*="parastorage.com"]')
    );
    signals.hasDrupal = !!document.querySelector('meta[name="generator"][content*="Drupal"]');
    signals.hasJoomla = !!document.querySelector('meta[name="generator"][content*="Joomla"]');
    signals.hasGhost = !!document.querySelector('meta[name="generator"][content*="Ghost"]');

    // Count key elements
    signals.totalScripts = document.querySelectorAll('script').length;
    signals.totalStylesheets = document.querySelectorAll('link[rel="stylesheet"]').length;
    signals.totalImages = document.querySelectorAll('img').length;
    signals.totalIframes = document.querySelectorAll('iframe').length;

    // Deprecated HTML elements
    const deprecated = ['marquee', 'blink', 'font', 'center', 'big', 'strike', 'tt', 'frame', 'frameset', 'applet'];
    const foundDeprecated = [];
    for (const tag of deprecated) {
      const count = document.querySelectorAll(tag).length;
      if (count > 0) foundDeprecated.push({ tag, count });
    }
    signals.deprecatedElements = foundDeprecated;

    // PWA manifest
    signals.hasPwaManifest = !!(
      document.querySelector('link[rel="manifest"]') ||
      document.querySelector('link[rel="manifest"][href*=".webmanifest"]') ||
      document.querySelector('link[rel="manifest"][href*="manifest.json"]')
    );

    // Flash / Java detection
    signals.hasFlash = document.querySelectorAll('object[type*="flash"], embed[type*="flash"]').length > 0;

    // HTML size
    signals.htmlSize = (document.documentElement.outerHTML || '').length;

    return signals;
  }

  function extractCookies() {
    const raw = document.cookie || '';
    if (!raw) return [];
    return raw.split(';').map((c) => {
      const [name, ...rest] = c.trim().split('=');
      return { name: name.trim(), value: rest.join('=').slice(0, 50) };
    });
  }

  // Extract root domain, handling multi-part TLDs (co.uk, com.au, etc.)
  function getRootDomain(hostname) {
    const parts = hostname.split('.');
    if (parts.length <= 2) return hostname;
    // Common country-code second-level domains
    const ccSLDs = new Set(['co.uk', 'com.au', 'co.jp', 'co.kr', 'co.nz', 'co.za',
      'com.br', 'com.cn', 'com.tw', 'com.mx', 'com.ar', 'com.tr', 'com.sg',
      'co.in', 'co.id', 'co.th', 'co.il', 'org.uk', 'net.au', 'ac.uk']);
    const lastTwo = parts.slice(-2).join('.');
    if (ccSLDs.has(lastTwo) && parts.length > 2) {
      return parts.slice(-3).join('.');
    }
    return parts.slice(-2).join('.');
  }

  function extractThirdPartyRequests() {
    const rootDomain = getRootDomain(location.hostname);
    const thirdParty = new Set();

    // Helper: true if host belongs to a different organization
    const isThirdParty = (host) => host && host.includes('.') && getRootDomain(host) !== rootDomain;

    // Check script sources
    document.querySelectorAll('script[src]').forEach((s) => {
      try {
        const host = new URL(s.src).hostname;
        if (isThirdParty(host)) thirdParty.add(host);
      } catch {}
    });

    // Check stylesheet sources
    document.querySelectorAll('link[rel="stylesheet"][href]').forEach((l) => {
      try {
        const host = new URL(l.href).hostname;
        if (isThirdParty(host)) thirdParty.add(host);
      } catch {}
    });

    // Check image sources
    document.querySelectorAll('img[src]').forEach((img) => {
      try {
        const host = new URL(img.src).hostname;
        if (isThirdParty(host)) thirdParty.add(host);
      } catch {}
    });

    // Check iframes
    document.querySelectorAll('iframe[src]').forEach((f) => {
      try {
        const host = new URL(f.src).hostname;
        if (isThirdParty(host)) thirdParty.add(host);
      } catch {}
    });

    return Array.from(thirdParty);
  }

  function extractPerformance() {
    const perf = {};

    // Navigation timing
    const nav = performance.getEntriesByType('navigation')[0];
    if (nav) {
      perf.domContentLoaded = Math.round(nav.domContentLoadedEventEnd - nav.startTime);
      perf.loadComplete = Math.round(nav.loadEventEnd - nav.startTime);
      perf.ttfb = Math.round(nav.responseStart - nav.startTime);
      perf.domInteractive = Math.round(nav.domInteractive - nav.startTime);
      perf.transferSize = nav.transferSize;
      perf.encodedBodySize = nav.encodedBodySize;
      perf.decodedBodySize = nav.decodedBodySize;
      perf.protocol = nav.nextHopProtocol || '';
      perf.redirectCount = nav.redirectCount || 0;
      perf.redirectTime = Math.round((nav.redirectEnd - nav.redirectStart) || 0);
    }

    // Resource count and total size
    const resources = performance.getEntriesByType('resource');
    perf.totalRequests = resources.length;
    perf.totalTransferSize = resources.reduce((sum, r) => sum + (r.transferSize || 0), 0);

    // Resource breakdown by type
    const byType = {};
    for (const r of resources) {
      const type = r.initiatorType || 'other';
      if (!byType[type]) byType[type] = { count: 0, size: 0 };
      byType[type].count++;
      byType[type].size += r.transferSize || 0;
    }
    perf.resourcesByType = byType;

    // Largest resources
    perf.largestResources = resources
      .filter((r) => r.transferSize > 0)
      .sort((a, b) => b.transferSize - a.transferSize)
      .slice(0, 5)
      .map((r) => ({
        name: r.name.split('/').pop().split('?')[0] || r.name,
        type: r.initiatorType,
        size: r.transferSize,
      }));

    // Core Web Vitals
    try {
      const paintEntries = performance.getEntriesByType('paint');
      const fcp = paintEntries.find((e) => e.name === 'first-contentful-paint');
      if (fcp) perf.fcp = Math.round(fcp.startTime);
    } catch {}

    // LCP from PerformanceObserver entries (if available)
    // Note: 'largest-contentful-paint' is only available via PerformanceObserver,
    // not getEntriesByType. Use the observer-buffered approach instead.
    try {
      if (typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('largest-contentful-paint')) {
        const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
        if (lcpEntries && lcpEntries.length > 0) {
          const lastLcp = lcpEntries[lcpEntries.length - 1];
          perf.lcp = Math.round(lastLcp.startTime);
          perf.lcpElement = lastLcp.element ? lastLcp.element.tagName : null;
        }
      }
    } catch {}

    // CLS from PerformanceObserver entries (if available)
    try {
      if (typeof PerformanceObserver === 'undefined' || !PerformanceObserver.supportedEntryTypes?.includes('layout-shift')) throw 0;
      const clsEntries = performance.getEntriesByType('layout-shift');
      if (clsEntries && clsEntries.length > 0) {
        let clsScore = 0;
        for (const entry of clsEntries) {
          if (!entry.hadRecentInput) clsScore += entry.value;
        }
        perf.cls = Math.round(clsScore * 1000) / 1000;
      }
    } catch {}

    // Long tasks and INP are only available via PerformanceObserver
    // getEntriesByType('longtask') and getEntriesByType('event') are deprecated
    // Skip these entirely to avoid console warnings

    // Compression detection from resource entries
    perf.usesCompression = false;
    try {
      const navEntry = performance.getEntriesByType('navigation')[0];
      if (navEntry && navEntry.encodedBodySize > 0 && navEntry.decodedBodySize > 0) {
        perf.usesCompression = navEntry.encodedBodySize < navEntry.decodedBodySize;
        perf.compressionRatio = navEntry.decodedBodySize > 0
          ? Math.round((1 - navEntry.encodedBodySize / navEntry.decodedBodySize) * 100)
          : 0;
      }
    } catch {}

    return perf;
  }

  function extractSeo() {
    const seo = {};

    // Title
    seo.title = document.title || '';
    seo.titleLength = seo.title.length;

    // Meta description
    const desc = document.querySelector('meta[name="description"]');
    seo.description = desc ? desc.content : '';
    seo.descriptionLength = seo.description.length;

    // Headings — full hierarchy
    const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const headingHierarchy = [];
    let lastLevel = 0;
    let hierarchyIssues = [];
    headingElements.forEach((h) => {
      const level = parseInt(h.tagName.charAt(1));
      const text = h.textContent.trim().slice(0, 100);
      headingHierarchy.push({ level, text, empty: !text });
      if (lastLevel > 0 && level > lastLevel + 1) {
        hierarchyIssues.push(`Skipped from H${lastLevel} to H${level}`);
      }
      lastLevel = level;
    });
    seo.headingHierarchy = headingHierarchy.slice(0, 30);
    seo.headingHierarchyIssues = hierarchyIssues;
    seo.emptyHeadings = headingHierarchy.filter((h) => h.empty).length;

    seo.h1Count = document.querySelectorAll('h1').length;
    seo.h1Text = Array.from(document.querySelectorAll('h1'))
      .map((h) => h.textContent.trim())
      .slice(0, 3);
    seo.h2Count = document.querySelectorAll('h2').length;
    seo.h3Count = document.querySelectorAll('h3').length;
    seo.h4Count = document.querySelectorAll('h4').length;
    seo.h5Count = document.querySelectorAll('h5').length;
    seo.h6Count = document.querySelectorAll('h6').length;

    // Images without alt
    const images = document.querySelectorAll('img');
    seo.totalImages = images.length;
    // Only count images that have NO alt attribute at all. alt="" is valid (decorative).
    seo.imagesWithoutAlt = Array.from(images).filter(
      (img) => !img.hasAttribute('alt')
    ).length;
    seo.imagesWithoutDimensions = Array.from(images).filter(
      (img) => !img.width && !img.height && !img.getAttribute('width') && !img.getAttribute('height')
    ).length;

    // Images without title attribute
    seo.imagesWithoutTitle = Array.from(images).filter(
      (img) => !img.getAttribute('title')
    ).length;

    // Meta keywords (outdated but still used by some sites)
    const keywordsMeta = document.querySelector('meta[name="keywords"]');
    seo.metaKeywords = keywordsMeta ? keywordsMeta.content : '';

    // Robots meta raw value
    const robotsMeta = document.querySelector('meta[name="robots"]');
    seo.robotsRaw = robotsMeta ? robotsMeta.content : '';

    // Structured data
    const jsonLd = document.querySelectorAll('script[type="application/ld+json"]');
    seo.hasStructuredData = jsonLd.length > 0;
    seo.structuredDataCount = jsonLd.length;
    seo.structuredDataTypes = [];
    jsonLd.forEach((el) => {
      try {
        const obj = JSON.parse(el.textContent);
        if (obj['@type']) seo.structuredDataTypes.push(obj['@type']);
        if (Array.isArray(obj['@graph'])) {
          obj['@graph'].forEach((item) => {
            if (item['@type']) seo.structuredDataTypes.push(item['@type']);
          });
        }
      } catch {}
    });

    // Open Graph — detailed
    seo.hasOpenGraph = !!document.querySelector('meta[property^="og:"]');
    seo.ogTitle = (document.querySelector('meta[property="og:title"]') || {}).content || '';
    seo.ogDescription = (document.querySelector('meta[property="og:description"]') || {}).content || '';
    seo.ogType = (document.querySelector('meta[property="og:type"]') || {}).content || '';
    seo.ogUrl = (document.querySelector('meta[property="og:url"]') || {}).content || '';
    seo.ogImage = (document.querySelector('meta[property="og:image"]') || {}).content || '';
    seo.ogSiteName = (document.querySelector('meta[property="og:site_name"]') || {}).content || '';

    // Twitter Card — detailed
    seo.hasTwitterCard = !!document.querySelector('meta[name^="twitter:"]');
    seo.twitterCard = (document.querySelector('meta[name="twitter:card"]') || {}).content || '';
    seo.twitterTitle = (document.querySelector('meta[name="twitter:title"]') || {}).content || '';
    seo.twitterDescription = (document.querySelector('meta[name="twitter:description"]') || {}).content || '';
    seo.twitterImage = (document.querySelector('meta[name="twitter:image"]') || {}).content || '';

    // Canonical
    const canonical = document.querySelector('link[rel="canonical"]');
    seo.hasCanonical = !!canonical;
    seo.canonicalUrl = canonical ? canonical.href : '';
    seo.canonicalMatchesUrl = canonical ? canonical.href === location.href : false;

    // Robots
    const robots = document.querySelector('meta[name="robots"]');
    seo.robotsContent = robots ? robots.content : '';
    seo.hasNoindex = seo.robotsContent.toLowerCase().includes('noindex');
    seo.hasNofollow = seo.robotsContent.toLowerCase().includes('nofollow');

    // Hreflang
    const hreflangEls = document.querySelectorAll('link[hreflang]');
    seo.hasHreflang = hreflangEls.length > 0;
    seo.hreflangCount = hreflangEls.length;
    seo.hreflangValues = Array.from(hreflangEls).map((l) => ({
      lang: l.getAttribute('hreflang'),
      href: l.href,
    })).slice(0, 20);

    // Viewport
    const viewport = document.querySelector('meta[name="viewport"]');
    seo.hasViewport = !!viewport;
    seo.viewportContent = viewport ? viewport.content : '';

    // Charset
    seo.hasCharset = !!document.querySelector('meta[charset]');

    // Doctype
    seo.hasDoctype = document.doctype !== null;

    // Word count (rough)
    const bodyText = document.body?.innerText || '';
    seo.wordCount = bodyText.split(/\s+/).filter((w) => w.length > 0).length;

    // Text to HTML ratio — measure text against tag structure only.
    // Strip scripts, styles, SVGs, and HTML attributes (class, style, data-*, etc.)
    // since framework utility classes (Tailwind, etc.) massively inflate raw HTML size.
    const fullHtml = document.documentElement.outerHTML || '';
    const strippedHtml = fullHtml
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '')
      .replace(/<(\w+)[^>]*>/g, '<$1>'); // strip attributes from tags
    const htmlSize = strippedHtml.length;
    const textSize = bodyText.length;
    seo.textToHtmlRatio = htmlSize > 0 ? Math.round((textSize / htmlSize) * 100) : 0;

    // Internal vs external links
    const allLinks = document.querySelectorAll('a[href]');
    let internalLinks = 0;
    let externalLinks = 0;
    let nofollowLinks = 0;
    let emptyLinks = 0;
    let hashOnlyLinks = 0;
    const uniqueHrefs = new Set();
    const brokenAnchors = [];
    allLinks.forEach((a) => {
      const href = a.getAttribute('href') || '';
      const text = (a.textContent || '').trim();
      if (!text && !a.querySelector('img') && !a.getAttribute('aria-label')) emptyLinks++;
      if (href === '#' || href === '') hashOnlyLinks++;
      if (href.startsWith('#') && href.length > 1) {
        const targetId = href.slice(1);
        if (!document.getElementById(targetId)) brokenAnchors.push(href);
      }
      try {
        const fullUrl = new URL(a.href);
        uniqueHrefs.add(fullUrl.origin + fullUrl.pathname);
        if (fullUrl.hostname === location.hostname) internalLinks++;
        else externalLinks++;
      } catch {}
      if (a.rel && a.rel.includes('nofollow')) nofollowLinks++;
    });
    seo.internalLinks = internalLinks;
    seo.externalLinks = externalLinks;
    seo.nofollowLinks = nofollowLinks;
    seo.totalLinks = allLinks.length;
    seo.uniqueLinks = uniqueHrefs.size;
    seo.emptyLinks = emptyLinks;
    seo.hashOnlyLinks = hashOnlyLinks;
    seo.brokenAnchors = brokenAnchors.slice(0, 10);

    // Favicon
    seo.hasFavicon = !!(
      document.querySelector('link[rel="icon"]') ||
      document.querySelector('link[rel="shortcut icon"]')
    );
    seo.hasAppleTouchIcon = !!document.querySelector('link[rel="apple-touch-icon"]');

    // URL analysis
    seo.urlLength = location.href.length;
    seo.urlHasUnderscores = location.pathname.includes('_');
    seo.urlHasUppercase = /[A-Z]/.test(location.pathname);
    seo.urlDepth = location.pathname.split('/').filter((s) => s).length;
    seo.urlHasParameters = location.search.length > 0;

    // Pagination
    seo.hasPrevNext = !!(
      document.querySelector('link[rel="prev"]') || document.querySelector('link[rel="next"]')
    );

    // AMP
    seo.hasAmp = !!(
      document.querySelector('link[rel="amphtml"]') || document.documentElement.hasAttribute('amp') ||
      document.documentElement.hasAttribute('⚡')
    );

    // Iframes
    seo.iframeCount = document.querySelectorAll('iframe').length;

    // SERP preview data
    seo.serpTitle = seo.title;
    seo.serpDescription = seo.description;
    seo.serpUrl = location.href;
    seo.serpFavicon = (document.querySelector('link[rel="icon"]') || document.querySelector('link[rel="shortcut icon"]'))?.href || '';
    seo.serpSiteName = (document.querySelector('meta[property="og:site_name"]') || {}).content || location.hostname.replace(/^www\./, '');

    // Social profile links
    const socialProfiles = [];
    const socialPatterns = [
      { pattern: /facebook\.com|fb\.com/, name: 'Facebook' },
      { pattern: /twitter\.com|x\.com/, name: 'X (Twitter)' },
      { pattern: /linkedin\.com/, name: 'LinkedIn' },
      { pattern: /instagram\.com/, name: 'Instagram' },
      { pattern: /youtube\.com|youtu\.be/, name: 'YouTube' },
      { pattern: /github\.com/, name: 'GitHub' },
      { pattern: /tiktok\.com/, name: 'TikTok' },
      { pattern: /pinterest\.com/, name: 'Pinterest' },
      { pattern: /threads\.net/, name: 'Threads' },
      { pattern: /mastodon|fosstodon/, name: 'Mastodon' },
    ];
    document.querySelectorAll('a[href]').forEach((a) => {
      const href = a.href || '';
      for (const sp of socialPatterns) {
        if (sp.pattern.test(href)) {
          socialProfiles.push({ platform: sp.name, url: href });
          break;
        }
      }
    });
    // Dedupe by platform
    const seenPlatforms = new Set();
    seo.socialProfiles = socialProfiles.filter((p) => {
      if (seenPlatforms.has(p.platform)) return false;
      seenPlatforms.add(p.platform);
      return true;
    });

    // Plaintext email detection
    // Walk only text nodes to find emails hardcoded in the HTML source.
    // Emails assembled by JavaScript (obfuscated) are excluded by checking
    // whether the email also appears in a raw HTML attribute on the element
    // or its parent (data-email patterns used for JS assembly).
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const visibleEmails = new Set();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const text = walker.currentNode.textContent || '';
      const matches = text.match(emailRegex);
      if (!matches) continue;
      for (const email of matches) {
        // Skip if this text node lives inside an element that was JS-assembled
        // (has data-email, data-contact-email, or similar obfuscation markers)
        const el = walker.currentNode.parentElement;
        if (el && (el.closest('[data-email]') || el.closest('[data-contact-email]') || el.closest('[data-obfuscated]'))) continue;
        visibleEmails.add(email);
      }
    }
    seo.plaintextEmails = [...visibleEmails].slice(0, 10);

    return seo;
  }

  function extractLinks() {
    const links = [];
    document.querySelectorAll('a[href]').forEach((a) => {
      const href = a.href || '';
      const text = (a.textContent || '').trim().toLowerCase();
      const rel = a.rel || '';
      // Only capture links that might be relevant (privacy, terms, legal, sitemap)
      if (
        href.match(/privacy|gdpr|integritet|personuppgift|dataskydd|cookie/i) ||
        href.match(/terms|villkor|anv.ndningsvillkor/i) ||
        href.match(/sitemap|robots/i) ||
        text.match(/privacy|integritet|personuppgift|dataskydd|cookie/i) ||
        text.match(/terms|villkor/i)
      ) {
        links.push({ href, text: text.slice(0, 80), rel });
      }
    });
    return links;
  }

  function extractAccessibility() {
    const a11y = {};

    // ARIA landmarks
    const landmarks = {
      banner: document.querySelectorAll('[role="banner"], header').length,
      navigation: document.querySelectorAll('[role="navigation"], nav').length,
      main: document.querySelectorAll('[role="main"], main').length,
      contentinfo: document.querySelectorAll('[role="contentinfo"], footer').length,
      complementary: document.querySelectorAll('[role="complementary"], aside').length,
      search: document.querySelectorAll('[role="search"]').length,
    };
    a11y.landmarks = landmarks;
    a11y.hasMain = landmarks.main > 0;
    a11y.hasNav = landmarks.navigation > 0;
    a11y.hasBanner = landmarks.banner > 0;
    a11y.hasContentinfo = landmarks.contentinfo > 0;

    // Skip navigation link
    const firstLinks = Array.from(document.querySelectorAll('a')).slice(0, 5);
    a11y.hasSkipLink = firstLinks.some((a) => {
      const href = a.getAttribute('href') || '';
      const text = (a.textContent || '').toLowerCase();
      return (href.startsWith('#') && text.match(/skip|hoppa|till innehåll|to content|to main/i));
    });

    // Language attribute
    a11y.hasLangAttr = !!document.documentElement.lang;
    a11y.langValue = document.documentElement.lang || '';

    // Images without alt
    const images = document.querySelectorAll('img');
    a11y.totalImages = images.length;
    a11y.imagesWithoutAlt = Array.from(images).filter((img) => !img.hasAttribute('alt')).length;
    a11y.imagesWithEmptyAlt = Array.from(images).filter((img) => img.hasAttribute('alt') && img.alt === '').length;

    // Form inputs without labels
    const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), select, textarea');
    let inputsWithoutLabels = 0;
    inputs.forEach((input) => {
      const id = input.id;
      const hasLabel = id && document.querySelector(`label[for="${CSS.escape(id)}"]`);
      const hasAriaLabel = input.getAttribute('aria-label');
      const hasAriaLabelledby = input.getAttribute('aria-labelledby');
      const wrappedInLabel = input.closest('label');
      const hasTitle = input.getAttribute('title');
      const hasPlaceholder = input.getAttribute('placeholder');
      if (!hasLabel && !hasAriaLabel && !hasAriaLabelledby && !wrappedInLabel && !hasTitle) {
        inputsWithoutLabels++;
      }
    });
    a11y.totalInputs = inputs.length;
    a11y.inputsWithoutLabels = inputsWithoutLabels;

    // Buttons and links without accessible names
    let emptyButtons = 0;
    document.querySelectorAll('button, [role="button"]').forEach((btn) => {
      const text = (btn.textContent || '').trim();
      const ariaLabel = btn.getAttribute('aria-label');
      const ariaLabelledby = btn.getAttribute('aria-labelledby');
      const title = btn.getAttribute('title');
      const hasImg = btn.querySelector('img[alt]');
      const hasSvgTitle = btn.querySelector('svg title');
      if (!text && !ariaLabel && !ariaLabelledby && !title && !hasImg && !hasSvgTitle) emptyButtons++;
    });
    a11y.emptyButtons = emptyButtons;

    let emptyLinks = 0;
    document.querySelectorAll('a').forEach((a) => {
      const text = (a.textContent || '').trim();
      const ariaLabel = a.getAttribute('aria-label');
      const ariaLabelledby = a.getAttribute('aria-labelledby');
      const title = a.getAttribute('title');
      const hasImg = a.querySelector('img[alt]');
      if (!text && !ariaLabel && !ariaLabelledby && !title && !hasImg) emptyLinks++;
    });
    a11y.emptyLinks = emptyLinks;

    // Positive tabindex (bad practice)
    const positiveTabindex = document.querySelectorAll('[tabindex]');
    let positiveTabindexCount = 0;
    positiveTabindex.forEach((el) => {
      const val = parseInt(el.getAttribute('tabindex'));
      if (val > 0) positiveTabindexCount++;
    });
    a11y.positiveTabindex = positiveTabindexCount;

    // Tables without headers
    const tables = document.querySelectorAll('table');
    let tablesWithoutHeaders = 0;
    tables.forEach((t) => {
      if (!t.querySelector('th') && !t.querySelector('[scope]') && !t.getAttribute('role')) {
        tablesWithoutHeaders++;
      }
    });
    a11y.totalTables = tables.length;
    a11y.tablesWithoutHeaders = tablesWithoutHeaders;

    // Videos without captions/tracks
    const videos = document.querySelectorAll('video');
    let videosWithoutCaptions = 0;
    videos.forEach((v) => {
      if (!v.querySelector('track[kind="captions"]') && !v.querySelector('track[kind="subtitles"]')) {
        videosWithoutCaptions++;
      }
    });
    a11y.totalVideos = videos.length;
    a11y.videosWithoutCaptions = videosWithoutCaptions;

    // Autocomplete on forms
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    const emailInputs = document.querySelectorAll('input[type="email"]');
    a11y.passwordInputsWithoutAutocomplete = Array.from(passwordInputs).filter((i) => !i.getAttribute('autocomplete')).length;
    a11y.emailInputsWithoutAutocomplete = Array.from(emailInputs).filter((i) => !i.getAttribute('autocomplete')).length;

    // Document title
    a11y.hasTitle = !!document.title;

    // Focus outline detection: check if a common reset removes outlines
    const focusStyleIssues = [];
    try {
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules || []) {
            const selector = (rule.selectorText || '').toLowerCase();
            const style = rule.style;
            if (selector.includes(':focus') && style && style.outline === 'none' && !selector.includes(':focus-visible')) {
              focusStyleIssues.push(selector);
            }
          }
        } catch {} // Cross-origin stylesheets throw
      }
    } catch {}
    a11y.focusOutlineRemoved = focusStyleIssues.length > 0;
    a11y.focusOutlineSelectors = focusStyleIssues.slice(0, 5);

    // ARIA roles count
    a11y.ariaRoleCount = document.querySelectorAll('[role]').length;

    // aria-hidden on focusable elements (bad)
    let ariaHiddenFocusable = 0;
    document.querySelectorAll('[aria-hidden="true"]').forEach((el) => {
      if (el.querySelector('a, button, input, select, textarea, [tabindex]')) {
        ariaHiddenFocusable++;
      }
    });
    a11y.ariaHiddenFocusable = ariaHiddenFocusable;

    return a11y;
  }

  function extractImageDetails() {
    const imgs = [];
    document.querySelectorAll('img').forEach((img) => {
      const src = img.src || img.getAttribute('data-src') || '';
      const ext = src.split('?')[0].split('.').pop().toLowerCase();
      imgs.push({
        src: src.slice(0, 200),
        alt: img.alt || null,
        hasAlt: img.hasAttribute('alt'),
        width: img.naturalWidth || img.width || 0,
        height: img.naturalHeight || img.height || 0,
        hasDimensions: !!(img.getAttribute('width') || img.getAttribute('height') || img.style.width || img.style.height),
        loading: img.loading || null,
        format: ext,
        isLazy: img.loading === 'lazy' || !!img.getAttribute('data-src'),
        isSvg: ext === 'svg',
        isAboveFold: img.getBoundingClientRect().top < window.innerHeight,
      });
    });

    // Picture elements with modern formats
    const pictureElements = document.querySelectorAll('picture');
    let hasWebP = false;
    let hasAvif = false;
    pictureElements.forEach((p) => {
      p.querySelectorAll('source').forEach((s) => {
        const type = (s.getAttribute('type') || '').toLowerCase();
        if (type.includes('webp')) hasWebP = true;
        if (type.includes('avif')) hasAvif = true;
      });
    });

    return {
      images: imgs.slice(0, 50),
      totalCount: document.querySelectorAll('img').length,
      hasWebP: hasWebP || imgs.some((i) => i.format === 'webp'),
      hasAvif: hasAvif || imgs.some((i) => i.format === 'avif'),
      pictureElementCount: pictureElements.length,
    };
  }

  function extractFontInfo() {
    const fonts = {};

    // Check preloaded fonts
    fonts.preloadedFonts = Array.from(document.querySelectorAll('link[rel="preload"][as="font"]')).map((l) => ({
      href: l.href,
      crossorigin: l.crossOrigin,
    }));

    // Check @font-face rules for font-display
    const fontDisplayValues = [];
    try {
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules || []) {
            if (rule instanceof CSSFontFaceRule) {
              const display = rule.style.getPropertyValue('font-display');
              const family = rule.style.getPropertyValue('font-family');
              fontDisplayValues.push({
                family: family ? family.replace(/["']/g, '') : 'unknown',
                display: display || 'auto',
              });
            }
          }
        } catch {} // Cross-origin stylesheets throw
      }
    } catch {}
    fonts.fontFaces = fontDisplayValues;
    fonts.hasFontDisplay = fontDisplayValues.some((f) => f.display && f.display !== 'auto');
    fonts.missingFontDisplay = fontDisplayValues.filter((f) => !f.display || f.display === 'auto').length;

    // Google Fonts detection
    fonts.usesGoogleFonts = !!(
      document.querySelector('link[href*="fonts.googleapis.com"]') ||
      document.querySelector('link[href*="fonts.gstatic.com"]')
    );

    // Font resource count
    const fontResources = performance.getEntriesByType('resource').filter((r) =>
      r.name.match(/\.(woff2?|ttf|otf|eot)(\?|$)/i)
    );
    fonts.fontFileCount = fontResources.length;
    fonts.fontTotalSize = Math.round(fontResources.reduce((sum, r) => sum + (r.transferSize || 0), 0) / 1024);

    return fonts;
  }

  function extractContrastSamples() {
    const issues = [];
    const seen = new Set();

    // Sample text elements for contrast ratio
    const textElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, a, span, li, td, th, label, button');
    const sampleSize = Math.min(textElements.length, 150);

    for (let i = 0; i < sampleSize; i++) {
      const el = textElements[i];
      if (!el.textContent.trim()) continue;

      const style = window.getComputedStyle(el);
      const fg = style.color;
      const bg = getEffectiveBackground(el);
      if (!fg || !bg) continue;

      const fgRgb = parseRgb(fg);
      const bgRgb = parseRgb(bg);
      if (!fgRgb || !bgRgb) continue;

      const ratio = contrastRatio(fgRgb, bgRgb);
      const fontSize = parseFloat(style.fontSize);
      const fontWeight = parseInt(style.fontWeight) || 400;
      const isLarge = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);

      // WCAG AA: 4.5:1 for normal text, 3:1 for large text
      const required = isLarge ? 3 : 4.5;

      if (ratio < required) {
        const key = `${fg}|${bg}`;
        if (seen.has(key)) continue;
        seen.add(key);
        issues.push({
          ratio: Math.round(ratio * 100) / 100,
          required,
          fg,
          bg,
          text: el.textContent.trim().slice(0, 40),
          tag: el.tagName.toLowerCase(),
          isLarge,
        });
      }
    }

    return { issues: issues.slice(0, 10), totalSampled: sampleSize };
  }

  function getEffectiveBackground(el) {
    let current = el;
    while (current && current !== document.documentElement) {
      const bg = window.getComputedStyle(current).backgroundColor;
      const rgb = parseRgb(bg);
      if (rgb && (rgb.a === undefined || rgb.a > 0)) return bg;
      current = current.parentElement;
    }
    return 'rgb(255, 255, 255)'; // default white
  }

  function parseRgb(str) {
    if (!str) return null;
    const match = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (!match) return null;
    return { r: +match[1], g: +match[2], b: +match[3], a: match[4] !== undefined ? +match[4] : 1 };
  }

  function luminance(rgb) {
    const [rs, gs, bs] = [rgb.r / 255, rgb.g / 255, rgb.b / 255].map(
      (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
    );
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }

  function contrastRatio(fg, bg) {
    const l1 = luminance(fg);
    const l2 = luminance(bg);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  function extractKeywords() {
    const text = (document.body?.innerText || '').toLowerCase();
    // Remove common stop words
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'is', 'it', 'as', 'be', 'was', 'are',
      'that', 'this', 'have', 'has', 'had', 'not', 'we', 'our', 'you', 'your',
      'they', 'their', 'all', 'can', 'will', 'do', 'if', 'my', 'so', 'no',
      'up', 'out', 'about', 'more', 'just', 'than', 'also', 'how', 'its',
      'what', 'which', 'when', 'who', 'get', 'been', 'would', 'could',
      'one', 'two', 'new', 'like', 'into', 'over', 'such', 'after', 'use',
      'very', 'most', 'only', 'here', 'then', 'each', 'them', 'other',
      // Swedish stop words
      'och', 'att', 'det', 'som', 'en', 'ett', 'den', 'har', 'inte', 'med',
      'för', 'på', 'av', 'till', 'var', 'från', 'kan', 'om', 'vi', 'er',
      'de', 'alla', 'du', 'din', 'ditt', 'sig', 'ska', 'vår', 'våra',
      'mer', 'dig', 'där', 'hur', 'man', 'sina', 'eller', 'efter',
    ]);

    const words = text.split(/[\s\-/,.;:!?()[\]{}"'`\n\r\t]+/)
      .filter((w) => w.length >= 3 && !stopWords.has(w) && !/^\d+$/.test(w));

    // Count word frequency
    const freq = {};
    for (const w of words) {
      freq[w] = (freq[w] || 0) + 1;
    }

    // Top 15 keywords
    const topKeywords = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([word, count]) => ({ word, count, density: Math.round((count / words.length) * 1000) / 10 }));

    // Bigrams (two-word phrases)
    const bigrams = {};
    for (let i = 0; i < words.length - 1; i++) {
      if (stopWords.has(words[i]) || stopWords.has(words[i + 1])) continue;
      const bi = words[i] + ' ' + words[i + 1];
      bigrams[bi] = (bigrams[bi] || 0) + 1;
    }

    const topBigrams = Object.entries(bigrams)
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([phrase, count]) => ({ phrase, count }));

    return { keywords: topKeywords, bigrams: topBigrams, totalWords: words.length };
  }

  // Run analysis after page is fully loaded
  if (document.readyState === 'complete') {
    analyze();
  } else {
    window.addEventListener('load', () => setTimeout(analyze, 500));
  }
})();
