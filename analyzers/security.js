// Security Header Analyzer

const SecurityAnalyzer = {
  async analyze(data) {
    const headers = data.headers?.headers || {};
    const rawHeaders = data.headers?.rawHeaders || data.rawHeaders || [];
    const duplicateHeaders = data.headers?.duplicateHeaders || data.duplicateHeaders || {};
    const domData = data.domData || {};
    const origin = domData.pageOrigin || '';
    const results = {
      score: 0,
      maxScore: 0,
      grade: '',
      checks: [],
      cookies: [],
      statusCode: data.headers?.statusCode || data.statusCode || null,
    };

    this.checkHeaders(headers, results);
    this.checkDuplicateHeaders(duplicateHeaders, results);
    this.checkCrossOriginHeaders(headers, results);
    this.checkCspQuality(headers, results);
    this.checkSri(domData.scripts || [], domData.styles?.links || [], results, domData.pageRootDomain || '');
    this.checkCompression(headers, domData.performance || {}, results);
    this.checkCacheHeaders(headers, results);
    this.checkCookies(domData.cookies || [], results);
    this.checkMixedContent(domData.scripts || [], domData.styles?.links || [], results);
    if (origin) await this.checkSecurityTxt(origin, results);

    // Calculate grade
    results.grade = this.calculateGrade(results.score, results.maxScore);
    return results;
  },

  checkHeaders(headers, results) {
    const checks = [
      {
        name: 'HTTPS',
        description: 'Site served over HTTPS',
        check: () => true,
        weight: 2,
        recommendation: 'Enable HTTPS with a valid SSL certificate',
      },
      {
        name: 'Strict-Transport-Security',
        description: 'Forces HTTPS connections',
        check: () => !!headers['strict-transport-security'],
        weight: 2,
        value: headers['strict-transport-security'],
        recommendation: 'Add header: Strict-Transport-Security: max-age=31536000; includeSubDomains',
      },
      {
        name: 'Content-Security-Policy',
        description: 'Controls allowed resource sources',
        check: () => !!(headers['content-security-policy'] || headers['content-security-policy-report-only']),
        weight: 3,
        value: headers['content-security-policy'] || headers['content-security-policy-report-only'],
        recommendation: "Add a Content-Security-Policy header to control which resources the browser can load",
      },
      {
        name: 'X-Content-Type-Options',
        description: 'Prevents MIME type sniffing',
        check: () => headers['x-content-type-options'] === 'nosniff',
        weight: 1,
        value: headers['x-content-type-options'],
        recommendation: 'Add header: X-Content-Type-Options: nosniff',
      },
      {
        name: 'X-Frame-Options',
        description: 'Prevents clickjacking attacks',
        check: () => !!headers['x-frame-options'],
        weight: 2,
        value: headers['x-frame-options'],
        recommendation: 'Add header: X-Frame-Options: DENY (or SAMEORIGIN)',
      },
      {
        name: 'X-XSS-Protection',
        description: 'Legacy XSS filter (deprecated but shows awareness)',
        check: () => !!headers['x-xss-protection'],
        weight: 1,
        value: headers['x-xss-protection'],
        recommendation: 'Add header: X-XSS-Protection: 1; mode=block (or rely on CSP)',
      },
      {
        name: 'Referrer-Policy',
        description: 'Controls referrer information sent with requests',
        check: () => !!headers['referrer-policy'],
        weight: 1,
        value: headers['referrer-policy'],
        recommendation: 'Add header: Referrer-Policy: strict-origin-when-cross-origin',
      },
      {
        name: 'Permissions-Policy',
        description: 'Controls browser feature access (camera, mic, etc.)',
        check: () => !!(headers['permissions-policy'] || headers['feature-policy']),
        weight: 1,
        value: headers['permissions-policy'] || headers['feature-policy'],
        recommendation: 'Add a Permissions-Policy header to restrict browser features',
      },
      {
        name: 'No Server Version Leak',
        description: 'Server header does not expose version details',
        check: () => {
          const server = headers['server'] || '';
          return !server.match(/\d+\.\d+/);
        },
        weight: 1,
        value: headers['server'],
        recommendation: 'Remove version numbers from the Server header',
      },
      {
        name: 'No X-Powered-By Leak',
        description: 'X-Powered-By header not present',
        check: () => !headers['x-powered-by'],
        weight: 1,
        value: headers['x-powered-by'],
        recommendation: 'Remove the X-Powered-By header to hide server technology',
      },
    ];

    for (const c of checks) {
      const passed = c.check();
      results.maxScore += c.weight;
      if (passed) results.score += c.weight;

      results.checks.push({
        name: c.name,
        description: c.description,
        passed,
        weight: c.weight,
        value: c.value || null,
        recommendation: passed ? null : c.recommendation,
        section: 'headers',
      });
    }
  },

  checkDuplicateHeaders(duplicateHeaders, results) {
    // Only flag security-relevant headers as duplicates.
    // Headers like "link", "set-cookie", "vary" are legitimately sent multiple times.
    const securityHeaders = new Set([
      'strict-transport-security', 'content-security-policy', 'x-content-type-options',
      'x-frame-options', 'x-xss-protection', 'referrer-policy', 'permissions-policy',
      'cross-origin-opener-policy', 'cross-origin-resource-policy', 'cross-origin-embedder-policy',
      'x-permitted-cross-domain-policies',
    ]);

    const securityDupes = Object.entries(duplicateHeaders).filter(([name]) => securityHeaders.has(name));
    const hasDuplicates = securityDupes.length > 0;

    results.maxScore += 2;
    if (!hasDuplicates) results.score += 2;

    if (hasDuplicates) {
      for (const [name, values] of securityDupes) {
        results.checks.push({
          name: `Duplicate Header: ${name}`,
          description: `Header "${name}" appears ${values.length} times`,
          passed: false,
          weight: 0,
          value: values.join(' | '),
          recommendation: `Remove duplicate "${name}" header — set it in only one layer (proxy or app)`,
          section: 'duplicates',
        });
      }
    }

    results.checks.push({
      name: 'No Duplicate Headers',
      description: 'Each security header appears only once',
      passed: !hasDuplicates,
      weight: 2,
      value: hasDuplicates ? `${securityDupes.length} header(s) duplicated` : null,
      recommendation: hasDuplicates ? 'Duplicate headers can cause unexpected behavior — ensure each header is set in only one place' : null,
      section: 'duplicates',
    });
  },

  checkCrossOriginHeaders(headers, results) {
    const checks = [
      {
        name: 'Cross-Origin-Opener-Policy',
        description: 'Isolates browsing context from cross-origin popups',
        present: !!headers['cross-origin-opener-policy'],
        value: headers['cross-origin-opener-policy'],
        recommendation: 'Add header: Cross-Origin-Opener-Policy: same-origin-allow-popups',
      },
      {
        name: 'Cross-Origin-Resource-Policy',
        description: 'Controls which origins can load this resource',
        present: !!headers['cross-origin-resource-policy'],
        value: headers['cross-origin-resource-policy'],
        recommendation: 'Add header: Cross-Origin-Resource-Policy: same-origin',
      },
      {
        name: 'Cross-Origin-Embedder-Policy',
        description: 'Controls cross-origin resource embedding',
        present: !!headers['cross-origin-embedder-policy'],
        value: headers['cross-origin-embedder-policy'],
        recommendation: 'Add header: Cross-Origin-Embedder-Policy: require-corp (or unsafe-none if needed)',
      },
      {
        name: 'X-Permitted-Cross-Domain-Policies',
        description: 'Prevents Flash/PDF cross-domain data loading',
        present: !!headers['x-permitted-cross-domain-policies'],
        value: headers['x-permitted-cross-domain-policies'],
        recommendation: 'Add header: X-Permitted-Cross-Domain-Policies: none',
      },
    ];

    for (const c of checks) {
      results.maxScore += 1;
      if (c.present) results.score += 1;
      results.checks.push({
        name: c.name,
        description: c.description,
        passed: c.present,
        weight: 1,
        value: c.value || null,
        recommendation: c.present ? null : c.recommendation,
        section: 'cross-origin',
      });
    }
  },

  checkCspQuality(headers, results) {
    const csp = headers['content-security-policy'] || '';
    if (!csp) return;

    const issues = [];
    if (csp.includes("'unsafe-inline'") && !csp.includes("'nonce-")) {
      issues.push("Uses 'unsafe-inline' without nonce — weakens XSS protection");
    }
    if (csp.includes("'unsafe-eval'")) {
      issues.push("Uses 'unsafe-eval' — allows dynamic code execution (eval, Function)");
    }
    // Match bare * wildcard (any origin), but not subdomain patterns like *.example.com
    if (csp.match(/script-src[^;]*\s\*(?:\s|;|$)/)) {
      issues.push("Wildcard (*) in script-src — allows scripts from any domain");
    }
    if (!csp.includes('default-src') && !csp.includes('script-src')) {
      issues.push("Missing default-src and script-src — CSP has no script control");
    }
    if (csp.includes('data:') && csp.match(/script-src[^;]*data:/)) {
      issues.push("Allows data: URIs in script-src — potential XSS vector");
    }
    if (!csp.includes('frame-ancestors')) {
      issues.push("Missing frame-ancestors — use it instead of X-Frame-Options");
    }
    if (!csp.includes('base-uri')) {
      issues.push("Missing base-uri — allows <base> tag injection");
    }
    if (!csp.includes('object-src') && !csp.includes("default-src 'none'")) {
      issues.push("Missing object-src — Flash/Java plugins not blocked");
    }
    if (!csp.includes('form-action')) {
      issues.push("Missing form-action — forms can submit to any domain");
    }

    const quality = issues.length === 0 ? 'strong' : issues.length <= 2 ? 'moderate' : 'weak';
    results.maxScore += 3;
    if (quality === 'strong') results.score += 3;
    else if (quality === 'moderate') results.score += 2;
    else results.score += 1;

    results.checks.push({
      name: 'CSP Quality',
      description: `Content Security Policy is ${quality}`,
      passed: quality === 'strong',
      weight: 3,
      value: issues.length > 0 ? issues.join('; ') : 'No issues found',
      recommendation: issues.length > 0 ? issues[0] : null,
      section: 'csp',
    });
  },

  checkSri(scripts, styleLinks, results, pageRootDomain) {
    const getRootDomain = (hostname) => {
      const parts = hostname.split('.');
      return parts.length <= 2 ? hostname : parts.slice(-2).join('.');
    };
    const rootDomain = pageRootDomain || '';

    const externalScripts = scripts.filter((s) => s.src && !s.src.startsWith('data:'));
    // Only flag truly third-party resources (different root domain), not own subdomains
    // CDNs that serve dynamic content (different per browser/UA) — SRI would break
    const dynamicCdns = /fonts\.googleapis\.com|fonts\.gstatic\.com|googletagmanager\.com/;
    const thirdPartyScripts = externalScripts.filter((s) => {
      try {
        const host = new URL(s.src).hostname;
        return getRootDomain(host) !== rootDomain && !dynamicCdns.test(host);
      } catch { return false; }
    });
    const thirdPartyStyles = (styleLinks || []).filter((l) => {
      try {
        const host = new URL(l.href).hostname;
        return l.href && getRootDomain(host) !== rootDomain && !dynamicCdns.test(host);
      } catch { return false; }
    });

    const scriptsWithSri = thirdPartyScripts.filter((s) => s.integrity);
    const stylesWithSri = thirdPartyStyles.filter((l) => l.integrity);
    const totalThirdParty = thirdPartyScripts.length + thirdPartyStyles.length;
    const totalWithSri = scriptsWithSri.length + stylesWithSri.length;

    results.maxScore += 2;
    if (totalThirdParty === 0) {
      results.score += 2;
      results.checks.push({
        name: 'Subresource Integrity (SRI)',
        description: 'No third-party scripts/styles to verify',
        passed: true,
        weight: 2,
        value: 'No third-party resources loaded',
        recommendation: null,
        section: 'sri',
      });
    } else {
      const pct = Math.round((totalWithSri / totalThirdParty) * 100);
      if (pct === 100) results.score += 2;
      else if (pct >= 50) results.score += 1;

      results.checks.push({
        name: 'Subresource Integrity (SRI)',
        description: 'Third-party resources have integrity hashes',
        passed: pct === 100,
        weight: 2,
        value: `${totalWithSri}/${totalThirdParty} resources have SRI (${pct}%)`,
        recommendation: pct < 100 ? 'Add integrity="sha384-..." to third-party script/link tags to prevent tampering' : null,
        section: 'sri',
      });
    }
  },

  checkCookies(cookies, results) {
    results.cookies = cookies.map((c) => {
      const flags = [];
      flags.push({ name: 'HttpOnly', present: false, note: 'Readable from JavaScript' });
      return {
        name: c.name,
        flags,
      };
    });
  },

  checkMixedContent(scripts, styleLinks, results) {
    const mixedScripts = scripts.filter((s) => s.src && s.src.startsWith('http://'));
    const mixedStyles = styleLinks.filter((l) => l.href && l.href.startsWith('http://'));

    const hasMixed = mixedScripts.length > 0 || mixedStyles.length > 0;
    results.maxScore += 2;
    if (!hasMixed) results.score += 2;

    results.checks.push({
      name: 'No Mixed Content',
      description: 'All resources loaded over HTTPS',
      passed: !hasMixed,
      weight: 2,
      value: hasMixed ? `${mixedScripts.length} scripts, ${mixedStyles.length} styles over HTTP` : null,
      recommendation: hasMixed ? 'Load all resources over HTTPS' : null,
      section: 'headers',
    });
  },

  checkCompression(headers, perf, results) {
    const encoding = headers['content-encoding'] || '';
    const hasBrotli = encoding.includes('br');
    const hasGzip = encoding.includes('gzip');
    const hasCompression = hasBrotli || hasGzip || perf.usesCompression;

    results.maxScore += 1;
    if (hasCompression) results.score += 1;

    let detail = 'None detected';
    if (hasBrotli) detail = 'Brotli (optimal)';
    else if (hasGzip) detail = 'Gzip';
    else if (perf.usesCompression) detail = `Compressed (${perf.compressionRatio}% savings)`;

    results.checks.push({
      name: 'Compression',
      description: 'Response uses gzip or brotli compression',
      passed: hasCompression,
      weight: 1,
      value: detail,
      recommendation: hasCompression ? null : 'Enable gzip or brotli compression to reduce transfer size by 60-80%',
      section: 'headers',
    });
  },

  checkCacheHeaders(headers, results) {
    const cacheControl = headers['cache-control'] || '';
    const etag = headers['etag'] || '';
    const expires = headers['expires'] || '';

    const hasCaching = !!(cacheControl || etag || expires);
    results.maxScore += 1;
    if (hasCaching) results.score += 1;

    const parts = [];
    if (cacheControl) parts.push(`Cache-Control: ${cacheControl}`);
    if (etag) parts.push('ETag present');
    if (expires) parts.push(`Expires: ${expires}`);

    results.checks.push({
      name: 'Cache Headers',
      description: 'Response includes caching directives',
      passed: hasCaching,
      weight: 1,
      value: hasCaching ? parts.join('; ') : 'No caching headers',
      recommendation: hasCaching ? null : 'Add Cache-Control headers to enable browser caching and reduce repeat visit load times',
      section: 'headers',
    });
  },

  async checkSecurityTxt(origin, results) {
    let found = false;
    let detail = '';
    // RFC 9116 §3: /.well-known/security.txt is the preferred location, but /security.txt
    // at the web root is allowed as a fallback for backwards compatibility.
    const paths = ['/.well-known/security.txt', '/security.txt'];
    for (const path of paths) {
      try {
        const resp = await fetchWithTimeout(`${origin}${path}`, { cache: 'no-cache' });
        if (resp.ok) {
          const text = await resp.text();
          if (/^contact\s*:/im.test(text)) {
            found = true;
            const contact = text.match(/^contact\s*:\s*(.+)$/im);
            detail = contact ? `Found at ${path} (${contact[1].trim()})` : `Found at ${path}`;
            break;
          }
        }
      } catch {}
    }

    results.maxScore += 1;
    if (found) results.score += 1;
    results.checks.push({
      name: 'security.txt',
      description: 'Security contact information published (RFC 9116)',
      passed: found,
      weight: 1,
      value: found ? detail : 'Not found',
      recommendation: found ? null : 'Add /.well-known/security.txt with contact info for security researchers',
      section: 'headers',
    });
  },

  calculateGrade(score, maxScore) {
    return calculateGradePlusMinus(score, maxScore);
  },
};
