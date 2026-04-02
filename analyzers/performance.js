// Performance Analyzer

const PerformanceAnalyzer = {
  analyze(data) {
    const perf = data.domData?.performance || {};
    const dom = data.domData?.dom || {};
    const scripts = data.domData?.scripts || [];
    const images = data.domData?.images || {};
    const fonts = data.domData?.fonts || {};
    const styles = data.domData?.styles || {};

    const results = {
      timing: {},
      coreWebVitals: {},
      pageWeight: {},
      resourceBreakdown: {},
      issues: [],
      score: 0,
      maxScore: 0,
      grade: '',
    };

    this.analyzeTiming(perf, results);
    this.analyzeCoreWebVitals(perf, results);
    this.analyzePageWeight(perf, dom, results);
    this.analyzeRenderBlocking(scripts, results);
    this.analyzeResources(perf, results);
    this.analyzeImages(images, results);
    this.analyzeFonts(fonts, results);
    this.analyzeInlineStyles(styles, results);
    this.analyzeProtocol(perf, results);
    this.analyzeRedirects(perf, results);

    results.grade = this.calculateGrade(results.score, results.maxScore);
    return results;
  },

  analyzeTiming(perf, results) {
    results.timing = {
      ttfb: perf.ttfb || null,
      fcp: perf.fcp || null,
      domContentLoaded: perf.domContentLoaded || null,
      loadComplete: perf.loadComplete || null,
      domInteractive: perf.domInteractive || null,
    };

    // TTFB scoring
    if (perf.ttfb != null) {
      results.maxScore += 2;
      if (perf.ttfb < 200) { results.score += 2; }
      else if (perf.ttfb < 500) { results.score += 1; }
      else { results.issues.push({ severity: 'warning', message: `Slow TTFB: ${perf.ttfb}ms (target < 200ms)` }); }
    }

    // FCP scoring
    if (perf.fcp != null) {
      results.maxScore += 2;
      if (perf.fcp < 1800) { results.score += 2; }
      else if (perf.fcp < 3000) { results.score += 1; }
      else { results.issues.push({ severity: 'critical', message: `Slow FCP: ${perf.fcp}ms (target < 1800ms)` }); }
    }

    // DOM Content Loaded
    if (perf.domContentLoaded != null) {
      results.maxScore += 1;
      if (perf.domContentLoaded < 2000) { results.score += 1; }
      else { results.issues.push({ severity: 'warning', message: `Slow DOMContentLoaded: ${perf.domContentLoaded}ms` }); }
    }

    // Full load
    if (perf.loadComplete != null) {
      results.maxScore += 1;
      if (perf.loadComplete < 3000) { results.score += 1; }
      else { results.issues.push({ severity: 'warning', message: `Slow page load: ${perf.loadComplete}ms` }); }
    }
  },

  analyzeCoreWebVitals(perf, results) {
    results.coreWebVitals = {
      lcp: perf.lcp || null,
      lcpElement: perf.lcpElement || null,
      cls: perf.cls != null ? perf.cls : null,
      inp: perf.inp || null,
      fcp: perf.fcp || null,
    };

    // LCP scoring (Google thresholds: good < 2500ms, poor > 4000ms)
    if (perf.lcp != null) {
      results.maxScore += 3;
      if (perf.lcp < 2500) {
        results.score += 3;
      } else if (perf.lcp < 4000) {
        results.score += 1;
        results.issues.push({ severity: 'warning', message: `LCP needs improvement: ${perf.lcp}ms (target < 2500ms)` });
      } else {
        results.issues.push({ severity: 'critical', message: `Poor LCP: ${perf.lcp}ms (target < 2500ms)` });
      }
    }

    // CLS scoring (Google thresholds: good < 0.1, poor > 0.25)
    if (perf.cls != null) {
      results.maxScore += 3;
      if (perf.cls < 0.1) {
        results.score += 3;
      } else if (perf.cls < 0.25) {
        results.score += 1;
        results.issues.push({ severity: 'warning', message: `CLS needs improvement: ${perf.cls} (target < 0.1)` });
      } else {
        results.issues.push({ severity: 'critical', message: `Poor CLS: ${perf.cls} (target < 0.1)` });
      }
    }

    // Long tasks (proxy for INP)
    if (perf.longTaskCount != null) {
      results.maxScore += 2;
      if (perf.longTaskCount === 0) {
        results.score += 2;
      } else if (perf.longTaskCount <= 3) {
        results.score += 1;
        results.issues.push({ severity: 'info', message: `${perf.longTaskCount} long task(s) detected (${perf.longTaskTotalDuration}ms total)` });
      } else {
        results.issues.push({ severity: 'warning', message: `${perf.longTaskCount} long tasks (${perf.longTaskTotalDuration}ms) — may cause input lag` });
      }
    }
  },

  analyzePageWeight(perf, dom, results) {
    const totalSize = perf.totalTransferSize || 0;
    const docSize = perf.transferSize || 0;

    results.pageWeight = {
      totalTransferKB: Math.round(totalSize / 1024),
      documentKB: Math.round(docSize / 1024),
      totalRequests: perf.totalRequests || 0,
    };

    // Total page weight scoring
    results.maxScore += 2;
    if (totalSize < 1_000_000) { results.score += 2; }
    else if (totalSize < 3_000_000) {
      results.score += 1;
      results.issues.push({ severity: 'warning', message: `Page weight: ${Math.round(totalSize / 1024)}KB (target < 1000KB)` });
    }
    else {
      results.issues.push({ severity: 'critical', message: `Heavy page: ${Math.round(totalSize / 1024)}KB (target < 1000KB)` });
    }

    // Request count scoring
    results.maxScore += 1;
    const reqCount = perf.totalRequests || 0;
    if (reqCount < 50) { results.score += 1; }
    else { results.issues.push({ severity: 'info', message: `${reqCount} requests (consider bundling)` }); }
  },

  analyzeRenderBlocking(scripts, results) {
    const blocking = scripts.filter((s) => s.src && !s.async && !s.defer && s.type !== 'module');

    results.maxScore += 2;
    if (blocking.length === 0) {
      results.score += 2;
    } else {
      results.score += blocking.length <= 2 ? 1 : 0;
      results.issues.push({
        severity: blocking.length > 3 ? 'critical' : 'warning',
        message: `${blocking.length} render-blocking script(s) — add async/defer`,
      });
    }

    results.resourceBreakdown.renderBlockingScripts = blocking.length;
  },

  analyzeResources(perf, results) {
    results.resourceBreakdown.largestResources = (perf.largestResources || []).map((r) => ({
      name: r.name,
      type: r.type,
      sizeKB: Math.round(r.size / 1024),
    }));
    results.resourceBreakdown.byType = perf.resourcesByType || {};
  },

  analyzeImages(imageData, results) {
    if (!imageData || !imageData.images) return;
    const imgs = imageData.images;
    if (imgs.length === 0) return;

    // Modern format usage
    results.maxScore += 2;
    if (imageData.hasWebP || imageData.hasAvif) {
      results.score += 2;
    } else {
      const nonSvgImages = imgs.filter((i) => !i.isSvg);
      if (nonSvgImages.length === 0) {
        results.score += 2; // All SVGs, that's fine
      } else {
        results.issues.push({
          severity: 'warning',
          message: `No WebP/AVIF detected — modern formats can reduce image size 25-50%`,
        });
      }
    }

    // Lazy loading for below-fold images
    const belowFold = imgs.filter((i) => !i.isAboveFold && !i.isSvg);
    const belowFoldLazy = belowFold.filter((i) => i.isLazy);
    if (belowFold.length > 0) {
      results.maxScore += 2;
      const pct = belowFold.length > 0 ? Math.round((belowFoldLazy.length / belowFold.length) * 100) : 100;
      if (pct >= 80) {
        results.score += 2;
      } else if (pct >= 40) {
        results.score += 1;
        results.issues.push({ severity: 'warning', message: `Only ${pct}% of below-fold images use lazy loading` });
      } else {
        results.issues.push({ severity: 'warning', message: `${belowFold.length - belowFoldLazy.length} below-fold images missing loading="lazy"` });
      }
    }

    // Explicit dimensions (prevents CLS)
    const withoutDimensions = imgs.filter((i) => !i.hasDimensions && !i.isSvg);
    if (imgs.length > 0) {
      results.maxScore += 1;
      if (withoutDimensions.length === 0) {
        results.score += 1;
      } else {
        results.issues.push({
          severity: 'warning',
          message: `${withoutDimensions.length} image(s) missing width/height — causes layout shifts`,
        });
      }
    }

    results.resourceBreakdown.images = {
      total: imageData.totalCount,
      withWebP: imageData.hasWebP,
      withAvif: imageData.hasAvif,
      pictureElements: imageData.pictureElementCount,
      missingLazy: belowFold.length - belowFoldLazy.length,
      missingDimensions: withoutDimensions.length,
    };
  },

  analyzeFonts(fontData, results) {
    if (!fontData) return;

    // font-display check
    if (fontData.fontFaces && fontData.fontFaces.length > 0) {
      results.maxScore += 2;
      if (fontData.missingFontDisplay === 0) {
        results.score += 2;
      } else {
        results.score += fontData.hasFontDisplay ? 1 : 0;
        results.issues.push({
          severity: 'warning',
          message: `${fontData.missingFontDisplay} @font-face rule(s) missing font-display — add font-display: swap to prevent invisible text`,
        });
      }
    }

    // Font file count
    if (fontData.fontFileCount > 0) {
      results.maxScore += 1;
      if (fontData.fontFileCount <= 4) {
        results.score += 1;
      } else {
        results.issues.push({
          severity: 'info',
          message: `${fontData.fontFileCount} font files loaded (${fontData.fontTotalSize}KB) — consider subsetting or reducing variants`,
        });
      }
    }

    // Preloaded fonts
    results.resourceBreakdown.fonts = {
      fileCount: fontData.fontFileCount,
      totalSizeKB: fontData.fontTotalSize,
      preloaded: fontData.preloadedFonts?.length || 0,
      usesGoogleFonts: fontData.usesGoogleFonts,
    };
  },

  analyzeInlineStyles(styles, results) {
    if (!styles) return;
    const inlineAttrs = styles.inlineStyleAttrs || 0;
    if (inlineAttrs > 20) {
      results.issues.push({
        severity: 'info',
        message: `${inlineAttrs} elements with inline style attributes — consider using CSS classes`,
      });
    }
  },

  analyzeProtocol(perf, results) {
    if (perf.protocol) {
      results.maxScore += 1;
      const isH2Plus = perf.protocol === 'h2' || perf.protocol === 'h3';
      if (isH2Plus) {
        results.score += 1;
      } else {
        results.issues.push({
          severity: 'info',
          message: `Using ${perf.protocol || 'HTTP/1.1'} — HTTP/2+ enables multiplexing for faster loads`,
        });
      }
      results.resourceBreakdown.protocol = perf.protocol;
    }
  },

  analyzeRedirects(perf, results) {
    if (perf.redirectCount > 0) {
      results.issues.push({
        severity: perf.redirectCount > 1 ? 'warning' : 'info',
        message: `${perf.redirectCount} redirect(s) adding ${perf.redirectTime}ms — minimize redirect chains`,
      });
    }
  },

  calculateGrade(score, maxScore) {
    return calculateGradePlusMinus(score, maxScore);
  },
};
