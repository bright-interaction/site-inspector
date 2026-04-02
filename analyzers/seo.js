// SEO Analyzer — Comprehensive On-Page + Technical

const SeoAnalyzer = {
  async analyze(data) {
    const seo = data.domData?.seo || {};
    const meta = data.domData?.meta || {};
    const dom = data.domData?.dom || {};
    const images = data.domData?.images || {};
    const origin = data.domData?.pageOrigin || '';

    const results = {
      score: 0,
      maxScore: 0,
      grade: '',
      checks: [],
      summary: {},
    };

    // ─── On-Page SEO ───
    this.checkTitle(seo, results);
    this.checkDescription(seo, results);
    this.checkHeadings(seo, results);
    this.checkHeadingHierarchy(seo, results);
    this.checkImages(seo, results);
    this.checkImageDimensions(seo, results);
    this.checkContent(seo, results);
    this.checkLinks(seo, results);
    this.checkLinkQuality(seo, results);
    this.checkTextToHtmlRatio(seo, results);
    this.checkUrlStructure(seo, results);

    // ─── Technical SEO ───
    this.checkCanonical(seo, results);
    this.checkCanonicalConsistency(seo, results);
    this.checkLanguage(seo, meta, results);
    this.checkViewport(seo, results);
    this.checkCharset(seo, results);
    this.checkDoctype(seo, results);
    this.checkFavicon(seo, results);
    this.checkNoindex(seo, results);
    this.checkDuplicateMeta(meta, results);
    this.checkPreconnect(meta, results);
    this.checkIframes(seo, results);
    this.checkDeprecatedHtml(dom, results);
    this.checkPagination(seo, results);
    this.checkAmp(seo, results);

    // Remote checks (robots.txt, sitemap)
    if (origin) {
      await Promise.all([
        this.checkRobotsTxt(origin, results),
        this.checkSitemap(origin, results),
      ]);
    }

    // ─── Social & Rich Results ───
    this.checkStructuredData(seo, results);
    this.checkStructuredDataTypes(seo, results);
    this.checkOpenGraph(seo, results);
    this.checkTwitterCard(seo, results);
    this.checkPlaintextEmails(seo, results);

    // Store SERP + social data for popup rendering (not scored)
    results.serp = {
      title: seo.serpTitle || '',
      description: seo.serpDescription || '',
      url: seo.serpUrl || '',
      favicon: seo.serpFavicon || '',
      siteName: seo.serpSiteName || '',
    };
    results.socialProfiles = seo.socialProfiles || [];

    results.grade = this.calculateGrade(results.score, results.maxScore);
    return results;
  },

  addCheck(results, name, passed, weight, detail, recommendation, category) {
    results.maxScore += weight;
    if (passed) results.score += weight;
    results.checks.push({
      name,
      passed,
      weight,
      detail,
      recommendation: passed ? null : recommendation,
      category: category || 'on-page',
    });
  },

  // ═══════════════════════════════════════════
  // ON-PAGE SEO
  // ═══════════════════════════════════════════

  checkTitle(seo, results) {
    const title = seo.title || '';
    const len = seo.titleLength || 0;
    results.summary.title = title;
    results.summary.titleLength = len;

    this.addCheck(results, 'Has Title', !!title, 2, title || 'Missing',
      'Add a <title> tag', 'on-page');
    this.addCheck(results, 'Title Length (30-60 chars)', len >= 30 && len <= 60, 1,
      `${len} characters`, 'Keep title between 30-60 characters for optimal SERP display', 'on-page');

    // Title starts with keyword-like content (not brand name or separator)
    if (title) {
      const startsWithSeparator = /^[\s|—–\-:]+/.test(title);
      this.addCheck(results, 'Title Starts with Content', !startsWithSeparator, 1,
        startsWithSeparator ? 'Starts with separator/whitespace' : title.slice(0, 40),
        'Put primary content/keyword first in the title, brand name last', 'on-page');
    }
  },

  checkDescription(seo, results) {
    const desc = seo.description || '';
    const len = seo.descriptionLength || 0;
    results.summary.description = desc;
    results.summary.descriptionLength = len;

    this.addCheck(results, 'Has Meta Description', !!desc, 2, desc ? `${len} chars` : 'Missing',
      'Add a meta description tag', 'on-page');
    this.addCheck(results, 'Description Length (120-160 chars)', len >= 120 && len <= 160, 1,
      `${len} characters`, 'Keep meta description between 120-160 characters', 'on-page');
  },

  checkHeadings(seo, results) {
    this.addCheck(results, 'Has H1', seo.h1Count > 0, 2,
      seo.h1Count > 0 ? seo.h1Text?.[0] : 'Missing',
      'Add an H1 heading to the page', 'on-page');
    this.addCheck(results, 'Single H1', seo.h1Count === 1, 1,
      `${seo.h1Count} H1 tag(s)`, 'Use exactly one H1 per page', 'on-page');
    this.addCheck(results, 'Has H2 Subheadings', (seo.h2Count || 0) > 0, 1,
      `${seo.h2Count || 0} H2 tag(s)`,
      'Add H2 subheadings to structure content', 'on-page');

    results.summary.headings = {
      h1: seo.h1Count || 0,
      h2: seo.h2Count || 0,
      h3: seo.h3Count || 0,
      h4: seo.h4Count || 0,
      h5: seo.h5Count || 0,
      h6: seo.h6Count || 0,
    };
  },

  checkHeadingHierarchy(seo, results) {
    const issues = seo.headingHierarchyIssues || [];
    this.addCheck(results, 'Heading Hierarchy', issues.length === 0, 2,
      issues.length > 0 ? issues.join('; ') : 'Proper H1→H2→H3 nesting',
      'Maintain proper heading hierarchy without skipping levels (e.g., H1→H3)', 'on-page');

    const emptyHeadings = seo.emptyHeadings || 0;
    if (emptyHeadings > 0) {
      this.addCheck(results, 'No Empty Headings', false, 1,
        `${emptyHeadings} empty heading(s)`,
        'Remove or fill empty heading tags — they confuse screen readers and search engines', 'on-page');
    }
  },

  checkImages(seo, results) {
    const total = seo.totalImages || 0;
    const missing = seo.imagesWithoutAlt || 0;
    const allHaveAlt = total === 0 || missing === 0;

    this.addCheck(results, 'Images Have Alt Text', allHaveAlt, 2,
      total > 0 ? `${missing}/${total} missing alt` : 'No images',
      'Add descriptive alt text to all images', 'on-page');
  },

  checkImageDimensions(seo, results) {
    const missing = seo.imagesWithoutDimensions || 0;
    if (seo.totalImages > 0) {
      this.addCheck(results, 'Images Have Dimensions', missing === 0, 1,
        missing > 0 ? `${missing} images missing width/height` : 'All images have dimensions',
        'Add width and height attributes to prevent Cumulative Layout Shift', 'on-page');
    }
  },

  checkContent(seo, results) {
    const words = seo.wordCount || 0;
    this.addCheck(results, 'Content Length (300+ words)', words >= 300, 1,
      `${words} words`, 'Pages with more content tend to rank better (aim for 300+)', 'on-page');
  },

  checkLinks(seo, results) {
    const internal = seo.internalLinks || 0;
    const unique = seo.uniqueLinks || 0;
    this.addCheck(results, 'Has Internal Links', internal > 0, 1,
      `${internal} internal, ${seo.externalLinks || 0} external (${unique} unique of ${seo.totalLinks || 0} total)`,
      'Add internal links to improve crawlability', 'on-page');
  },

  checkLinkQuality(seo, results) {
    // Empty links
    const emptyLinks = seo.emptyLinks || 0;
    if (emptyLinks > 0) {
      this.addCheck(results, 'No Empty Links', false, 1,
        `${emptyLinks} link(s) without text or aria-label`,
        'Add descriptive text or aria-label to all links', 'on-page');
    }

    // Hash-only links
    const hashOnly = seo.hashOnlyLinks || 0;
    if (hashOnly > 2) {
      this.addCheck(results, 'Minimal Hash-Only Links', false, 1,
        `${hashOnly} links with href="#" or empty href`,
        'Use proper URLs or button elements instead of empty anchor tags', 'on-page');
    }

    // Broken anchor links
    const broken = seo.brokenAnchors || [];
    if (broken.length > 0) {
      this.addCheck(results, 'No Broken Anchor Links', false, 1,
        `${broken.length} anchor(s) point to missing IDs: ${broken.slice(0, 3).join(', ')}`,
        'Fix or remove broken internal anchor links', 'on-page');
    }
  },

  checkTextToHtmlRatio(seo, results) {
    const ratio = seo.textToHtmlRatio || 0;
    this.addCheck(results, 'Text-to-HTML Ratio', ratio >= 10, 1,
      `${ratio}%`,
      'Text-to-HTML ratio below 10% suggests excessive code or thin content', 'on-page');
  },

  checkUrlStructure(seo, results) {
    // URL length
    const len = seo.urlLength || 0;
    this.addCheck(results, 'URL Length (< 75 chars)', len < 75, 1,
      `${len} characters`, 'Shorter URLs tend to rank better — keep under 75 characters', 'technical');

    // Underscores in URL
    if (seo.urlHasUnderscores) {
      this.addCheck(results, 'URL Uses Hyphens (not underscores)', false, 1,
        'URL contains underscores',
        'Google treats hyphens as word separators but not underscores — use hyphens', 'technical');
    }

    // Uppercase in URL
    if (seo.urlHasUppercase) {
      this.addCheck(results, 'URL is Lowercase', false, 1,
        'URL contains uppercase letters',
        'Use lowercase URLs to avoid duplicate content issues', 'technical');
    }

    // URL depth
    const depth = seo.urlDepth || 0;
    if (depth > 4) {
      this.addCheck(results, 'URL Depth (< 5 levels)', false, 1,
        `${depth} levels deep`,
        'Keep URL depth under 5 levels — flat structures rank better', 'technical');
    }
  },

  // ═══════════════════════════════════════════
  // TECHNICAL SEO
  // ═══════════════════════════════════════════

  checkCanonical(seo, results) {
    this.addCheck(results, 'Canonical URL', seo.hasCanonical, 2,
      seo.canonicalUrl || 'Missing',
      'Add a canonical link to prevent duplicate content issues', 'technical');
  },

  checkCanonicalConsistency(seo, results) {
    if (seo.hasCanonical && seo.canonicalUrl) {
      this.addCheck(results, 'Canonical Matches URL', seo.canonicalMatchesUrl, 1,
        seo.canonicalMatchesUrl ? 'Canonical matches current URL' : `Canonical: ${seo.canonicalUrl}`,
        seo.canonicalMatchesUrl ? null : 'Canonical URL differs from current URL — verify this is intentional', 'technical');
    }
  },

  checkLanguage(seo, meta, results) {
    this.addCheck(results, 'Language Declared', !!(meta.lang), 1,
      meta.lang || 'Missing', 'Add a lang attribute to the <html> tag', 'technical');

    if (seo.hasHreflang) {
      this.addCheck(results, 'Hreflang Tags', true, 1,
        `${seo.hreflangCount || 0} language(s)`, null, 'technical');
    }
  },

  checkViewport(seo, results) {
    this.addCheck(results, 'Viewport Meta', seo.hasViewport, 2,
      seo.viewportContent || 'Missing',
      'Add <meta name="viewport" content="width=device-width, initial-scale=1.0">', 'technical');
  },

  checkCharset(seo, results) {
    this.addCheck(results, 'Charset Declared', seo.hasCharset, 1,
      seo.hasCharset ? 'UTF-8' : 'Missing',
      'Add <meta charset="UTF-8"> as the first element in <head>', 'technical');
  },

  checkDoctype(seo, results) {
    this.addCheck(results, 'HTML5 Doctype', seo.hasDoctype, 1,
      seo.hasDoctype ? 'Present' : 'Missing',
      'Add <!DOCTYPE html> at the start of the document', 'technical');
  },

  checkFavicon(seo, results) {
    this.addCheck(results, 'Favicon', seo.hasFavicon, 1,
      seo.hasFavicon ? 'Present' : 'Missing',
      'Add a favicon for browser tabs and bookmarks', 'technical');

    if (seo.hasAppleTouchIcon !== undefined) {
      this.addCheck(results, 'Apple Touch Icon', seo.hasAppleTouchIcon, 1,
        seo.hasAppleTouchIcon ? 'Present' : 'Missing',
        'Add <link rel="apple-touch-icon"> for iOS home screen', 'technical');
    }
  },

  checkNoindex(seo, results) {
    if (seo.hasNoindex) {
      this.addCheck(results, 'Not Noindexed', false, 3,
        `meta robots: ${seo.robotsContent}`,
        'This page has noindex — it will NOT appear in search results. Remove noindex if this is unintentional.', 'technical');
    }
    if (seo.hasNofollow) {
      results.checks.push({
        name: 'Nofollow Detected',
        passed: null,
        weight: 0,
        detail: `meta robots: ${seo.robotsContent}`,
        recommendation: 'This page has nofollow — search engines won\'t follow links. Verify this is intentional.',
        category: 'technical',
      });
    }
  },

  checkDuplicateMeta(meta, results) {
    const dupes = meta._duplicates || {};
    const dupeKeys = Object.keys(dupes);
    if (dupeKeys.length > 0) {
      this.addCheck(results, 'No Duplicate Meta Tags', false, 2,
        `Duplicates: ${dupeKeys.join(', ')}`,
        'Remove duplicate meta tags — search engines may use the wrong value', 'technical');
    }
  },

  checkPreconnect(meta, results) {
    const preconnect = meta.preconnect || [];
    const dnsPrefetch = meta.dnsPrefetch || [];
    const preload = meta.preload || [];

    const hasHints = preconnect.length > 0 || dnsPrefetch.length > 0 || preload.length > 0;
    this.addCheck(results, 'Resource Hints', hasHints, 1,
      hasHints
        ? `${preconnect.length} preconnect, ${dnsPrefetch.length} dns-prefetch, ${preload.length} preload`
        : 'No resource hints found',
      'Add preconnect/dns-prefetch for third-party domains to speed up connections', 'technical');
  },

  checkIframes(seo, results) {
    const count = seo.iframeCount || 0;
    if (count > 3) {
      this.addCheck(results, 'Minimal Iframes', false, 1,
        `${count} iframes`,
        'Excessive iframes slow rendering — lazy-load or remove unnecessary ones', 'technical');
    }
  },

  checkDeprecatedHtml(dom, results) {
    const deprecated = dom?.deprecatedElements || [];
    if (deprecated.length > 0) {
      const detail = deprecated.map((d) => `<${d.tag}> (${d.count})`).join(', ');
      this.addCheck(results, 'No Deprecated HTML', false, 1,
        detail,
        'Replace deprecated HTML elements with modern semantic alternatives', 'technical');
    }
  },

  checkPagination(seo, results) {
    if (seo.hasPrevNext) {
      results.checks.push({
        name: 'Pagination (rel prev/next)',
        passed: true,
        weight: 0,
        detail: 'Pagination links detected',
        recommendation: null,
        category: 'technical',
      });
    }
  },

  checkAmp(seo, results) {
    if (seo.hasAmp) {
      results.checks.push({
        name: 'AMP Version',
        passed: null,
        weight: 0,
        detail: 'AMP version available',
        recommendation: null,
        category: 'technical',
      });
    }
  },

  async checkRobotsTxt(origin, results) {
    try {
      const resp = await fetchWithTimeout(`${origin}/robots.txt`, { cache: 'no-cache' });
      if (resp.ok) {
        const text = await resp.text();
        const hasUserAgent = /user-agent/i.test(text);
        const hasSitemap = /sitemap:/i.test(text);
        const hasDisallow = /disallow/i.test(text);

        let detail = 'Found';
        const notes = [];
        if (hasUserAgent) notes.push('User-Agent');
        if (hasDisallow) notes.push('Disallow rules');
        if (hasSitemap) notes.push('Sitemap reference');
        if (notes.length) detail += ` (${notes.join(', ')})`;

        this.addCheck(results, 'robots.txt', true, 2, detail, null, 'technical');

        if (hasSitemap) {
          const sitemapMatch = text.match(/sitemap:\s*(https?:\/\/\S+)/i);
          if (sitemapMatch) {
            results._robotsSitemapUrl = sitemapMatch[1];
          }
        }
      } else {
        this.addCheck(results, 'robots.txt', false, 2,
          `HTTP ${resp.status}`,
          'Add a robots.txt file to guide search engine crawlers', 'technical');
      }
    } catch {
      this.addCheck(results, 'robots.txt', false, 2,
        'Could not fetch',
        'Add a robots.txt file to guide search engine crawlers', 'technical');
    }
  },

  async checkSitemap(origin, results) {
    const urls = [
      `${origin}/sitemap.xml`,
      `${origin}/sitemap_index.xml`,
      `${origin}/sitemap/`,
    ];

    let found = false;
    let detail = '';

    for (const url of urls) {
      try {
        const resp = await fetchWithTimeout(url, { method: 'HEAD', cache: 'no-cache' });
        if (resp.ok) {
          const contentType = resp.headers.get('content-type') || '';
          if (contentType.includes('xml') || contentType.includes('text') || url.endsWith('.xml')) {
            found = true;
            detail = url.replace(origin, '');
            break;
          }
        }
      } catch {}
    }

    if (!found && results._robotsSitemapUrl) {
      try {
        const resp = await fetchWithTimeout(results._robotsSitemapUrl, { method: 'HEAD', cache: 'no-cache' });
        if (resp.ok) {
          found = true;
          detail = results._robotsSitemapUrl;
        }
      } catch {}
    }

    this.addCheck(results, 'XML Sitemap', found, 2,
      found ? detail : 'Not found at common locations',
      found ? null : 'Add a sitemap.xml to help search engines discover your pages', 'technical');
  },

  // ═══════════════════════════════════════════
  // SOCIAL & RICH RESULTS
  // ═══════════════════════════════════════════

  checkStructuredData(seo, results) {
    this.addCheck(results, 'Structured Data (JSON-LD)', seo.hasStructuredData, 2,
      seo.hasStructuredData ? `${seo.structuredDataCount} schema(s)` : 'None',
      'Add JSON-LD structured data for rich search results', 'social');
  },

  checkStructuredDataTypes(seo, results) {
    const types = seo.structuredDataTypes || [];
    if (types.length > 0) {
      results.checks.push({
        name: 'Schema Types',
        passed: null,
        weight: 0,
        detail: types.join(', '),
        recommendation: null,
        category: 'social',
      });
    }
  },

  checkOpenGraph(seo, results) {
    this.addCheck(results, 'Open Graph Tags', seo.hasOpenGraph, 1,
      seo.hasOpenGraph ? 'Present' : 'Missing',
      'Add Open Graph meta tags for social sharing', 'social');

    if (seo.hasOpenGraph) {
      // OG completeness
      const ogFields = [
        { name: 'og:title', value: seo.ogTitle },
        { name: 'og:description', value: seo.ogDescription },
        { name: 'og:image', value: seo.ogImage },
        { name: 'og:type', value: seo.ogType },
        { name: 'og:url', value: seo.ogUrl },
      ];
      const missing = ogFields.filter((f) => !f.value);
      if (missing.length > 0) {
        this.addCheck(results, 'OG Completeness', false, 1,
          `Missing: ${missing.map((f) => f.name).join(', ')}`,
          'Complete all Open Graph tags: og:title, og:description, og:image, og:type, og:url', 'social');
      } else {
        this.addCheck(results, 'OG Completeness', true, 1,
          'All essential OG tags present', null, 'social');
      }
    }

    this.addCheck(results, 'OG Image', !!seo.ogImage, 1,
      seo.ogImage || 'Missing',
      'Add og:image for link preview images (1200x630px recommended)', 'social');
  },

  checkTwitterCard(seo, results) {
    this.addCheck(results, 'Twitter Card', seo.hasTwitterCard, 1,
      seo.hasTwitterCard ? `Type: ${seo.twitterCard || 'present'}` : 'Missing',
      'Add Twitter Card meta tags', 'social');

    if (seo.hasTwitterCard && !seo.twitterImage) {
      this.addCheck(results, 'Twitter Image', false, 1,
        'Missing twitter:image',
        'Add twitter:image for link preview images on Twitter/X', 'social');
    }
  },

  // ─── Security / Privacy ───

  checkPlaintextEmails(seo, results) {
    const emails = seo.plaintextEmails || [];
    if (emails.length > 0) {
      this.addCheck(results, 'No Plaintext Emails', false, 1,
        `${emails.length} email(s) exposed: ${emails.slice(0, 3).join(', ')}`,
        'Replace plaintext emails with contact forms or obfuscate them to prevent scraping', 'technical');
    }
  },

  // ─── Scoring ───

  calculateGrade(score, maxScore) {
    return calculateGradePlusMinus(score, maxScore);
  },
};
