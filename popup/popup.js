// Site Inspector — Popup Controller

(function () {
  'use strict';

  let currentTab = 'tech';
  let analysisResults = {};
  let analyzedUrl = '';

  async function init() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) return showError();

    analyzedUrl = tab.url;
    document.getElementById('site-url').textContent = tab.url;

    show('loading');

    const [bgData, fetchedHeaders] = await Promise.all([
      getBackgroundData(tab.id),
      fetchHeaders(tab.url),
    ]);

    const data = bgData || { url: tab.url, headers: {}, rawHeaders: [], duplicateHeaders: {}, timestamp: Date.now() };

    if (fetchedHeaders && Object.keys(fetchedHeaders).length > 0) {
      if (!data.headers || Object.keys(data.headers).length === 0) {
        data.headers = { headers: fetchedHeaders };
      } else if (!data.headers.headers || Object.keys(data.headers.headers).length === 0) {
        data.headers.headers = fetchedHeaders;
      }
    }

    if (data.headers && !data.headers.headers) {
      data.headers = { headers: data.headers };
    }
    if (!data.headers.duplicateHeaders && data.duplicateHeaders) {
      data.headers.duplicateHeaders = data.duplicateHeaders;
    }
    if (!data.headers.rawHeaders && data.rawHeaders) {
      data.headers.rawHeaders = data.rawHeaders;
    }

    if (data.domData) {
      await runAnalysis(data);
    } else {
      await reinjectAndWait(tab, data, fetchedHeaders);
    }

    // Tab switching
    document.querySelectorAll('.grade-card').forEach((card) => {
      card.addEventListener('click', () => switchTab(card.dataset.tab));
    });

    // Refresh
    document.getElementById('refresh-btn').addEventListener('click', async () => {
      show('loading');
      const [, freshHeaders] = await Promise.all([
        reinjectContentScript(tab),
        fetchHeaders(tab.url),
      ]);
      setTimeout(async () => {
        const bgData2 = await getBackgroundData(tab.id);
        const merged = bgData2 || { url: tab.url, headers: {}, rawHeaders: [], duplicateHeaders: {}, timestamp: Date.now() };
        if (freshHeaders && Object.keys(freshHeaders).length > 0) {
          merged.headers = { headers: freshHeaders };
        }
        if (merged.headers && !merged.headers.headers) {
          merged.headers = { headers: merged.headers };
        }
        if (!merged.headers.duplicateHeaders && merged.duplicateHeaders) {
          merged.headers.duplicateHeaders = merged.duplicateHeaders;
        }
        if (!merged.headers.rawHeaders && merged.rawHeaders) {
          merged.headers.rawHeaders = merged.rawHeaders;
        }
        if (merged.domData) {
          await runAnalysis(merged);
        } else {
          showError();
        }
      }, 1200);
    });

    // Export CSV
    document.getElementById('export-btn').addEventListener('click', exportCsv);
    document.getElementById('pdf-btn').addEventListener('click', openPdfReport);
    document.getElementById('email-btn').addEventListener('click', showEmailModal);
    document.getElementById('email-modal-close').addEventListener('click', () => document.getElementById('email-modal').classList.add('hidden'));
    document.getElementById('email-copy').addEventListener('click', copyEmail);
    initDarkMode();
  }

  function getBackgroundData(tabId) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_ALL_DATA', tabId }, (response) => {
        resolve(response?.data || null);
      });
    });
  }

  async function fetchHeaders(url) {
    try {
      const parsedUrl = new URL(url);
      if (!parsedUrl.protocol.startsWith('http')) return {};
      const response = await fetch(url, { method: 'HEAD', mode: 'cors', cache: 'no-cache' });
      const headers = {};
      response.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });
      return headers;
    } catch {
      return {};
    }
  }

  async function reinjectContentScript(tab) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content-script.js'],
      });
    } catch {}
  }

  async function reinjectAndWait(tab, existingData, fetchedHeaders) {
    try {
      await reinjectContentScript(tab);
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const bgData = await getBackgroundData(tab.id);
      const data = bgData || existingData;
      if (fetchedHeaders && Object.keys(fetchedHeaders).length > 0) {
        data.headers = { headers: fetchedHeaders };
      }
      if (data.headers && !data.headers.headers) {
        data.headers = { headers: data.headers };
      }
      if (!data.headers.duplicateHeaders && data.duplicateHeaders) {
        data.headers.duplicateHeaders = data.duplicateHeaders;
      }
      if (data.domData) {
        await runAnalysis(data);
      } else {
        showError();
      }
    } catch {
      showError();
    }
  }

  async function runAnalysis(data) {
    const tech = TechDetect.analyze(data);
    TechDetect.dedupe(tech);

    const security = await SecurityAnalyzer.analyze(data);
    const perf = PerformanceAnalyzer.analyze(data);
    const seo = await SeoAnalyzer.analyze(data);
    const privacy = await PrivacyAnalyzer.analyze(data);
    const a11y = AccessibilityAnalyzer.analyze(data);

    analysisResults = { tech, security, perf, seo, privacy, a11y, keywords: data.domData?.keywords || {} };

    renderGrades();
    renderQuickWins();
    renderTech(tech);
    renderSecurity(security);
    renderPerformance(perf);
    renderSeo(seo);
    renderPrivacy(privacy);
    renderAccessibility(a11y);
    renderKeywords(analysisResults.keywords);

    show('results');
    document.getElementById('export-btn').classList.remove('hidden');
    document.getElementById('pdf-btn').classList.remove('hidden');
    document.getElementById('email-btn').classList.remove('hidden');

    // Set badge on extension icon
    const overallGrade = getOverallGrade();
    const badgeColor = { A: '#16a34a', B: '#2563eb', C: '#d97706', D: '#ea580c', F: '#dc2626' };
    const letter = overallGrade.charAt(0);
    chrome.runtime.sendMessage({
      type: 'SET_BADGE',
      text: overallGrade,
      color: badgeColor[letter] || '#64748b',
      tabId: (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id,
    });

    // Save scan history
    try {
      const hostname = new URL(analyzedUrl).hostname;
      chrome.runtime.sendMessage({
        type: 'SAVE_SCAN',
        hostname,
        grades: {
          security: security.grade,
          performance: perf.grade,
          seo: seo.grade,
          privacy: privacy.grade,
          accessibility: a11y.grade,
        },
        scores: {
          security: { score: security.score, max: security.maxScore },
          performance: { score: perf.score, max: perf.maxScore },
          seo: { score: seo.score, max: seo.maxScore },
          privacy: { score: privacy.score, max: privacy.maxScore },
          accessibility: { score: a11y.score, max: a11y.maxScore },
        },
      });
      // Load and display history
      loadHistory(hostname);
    } catch {}
  }

  function getOverallGrade() {
    const r = analysisResults;
    const totalScore = r.security.score + r.perf.score + r.seo.score + r.privacy.score + r.a11y.score;
    const totalMax = r.security.maxScore + r.perf.maxScore + r.seo.maxScore + r.privacy.maxScore + r.a11y.maxScore;
    return calculateGradePlusMinus(totalScore, totalMax);
  }

  function show(state) {
    document.getElementById('loading').classList.toggle('hidden', state !== 'loading');
    document.getElementById('grades').classList.toggle('hidden', state !== 'results');
    document.getElementById('content').classList.toggle('hidden', state !== 'results');
    document.getElementById('error').classList.toggle('hidden', state !== 'error');
  }

  function showError() { show('error'); }

  function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.grade-card').forEach((c) => c.classList.toggle('active', c.dataset.tab === tab));
    document.querySelectorAll('.tab-content').forEach((c) => c.classList.toggle('active', c.id === `tab-${tab}`));
  }

  function gradeClass(grade) {
    const g = (grade || '?').toUpperCase();
    if (g.startsWith('A')) return 'grade-a';
    if (g.startsWith('B')) return 'grade-b';
    if (g.startsWith('C')) return 'grade-c';
    if (g.startsWith('D')) return 'grade-d';
    if (g === 'F') return 'grade-f';
    return 'grade-unknown';
  }

  function setGrade(id, grade) {
    const el = document.getElementById(id);
    el.textContent = grade || '?';
    el.className = `grade-letter ${gradeClass(grade)}`;
  }

  // ═══════════════════════════════════════════
  // STATUS CODE + QUICK WINS + HISTORY
  // ═══════════════════════════════════════════

  function renderQuickWins() {
    const container = document.getElementById('quick-wins');
    if (!container) return;

    const r = analysisResults;

    // Collect all failing checks grouped by category
    const grouped = {};
    const addFails = (category, grade, checks) => {
      for (const c of checks) {
        if (c.passed === false && c.recommendation) {
          if (!grouped[category]) grouped[category] = { grade, issues: [] };
          grouped[category].issues.push({ name: c.name, recommendation: c.recommendation });
        }
      }
    };

    addFails('Security', r.security.grade, r.security.checks);
    addFails('Performance', r.perf.grade, (r.perf.issues || []).map((i) => ({
      name: i.message, passed: false, recommendation: i.message, weight: 1,
    })));
    addFails('SEO', r.seo.grade, r.seo.checks);
    addFails('Privacy', r.privacy.grade, r.privacy.checks);
    addFails('Accessibility', r.a11y.grade, r.a11y.checks);

    const categories = Object.entries(grouped);
    if (categories.length === 0) {
      container.innerHTML = '<div class="empty-state">No issues found — great job!</div>';
      return;
    }

    let html = '';
    for (const [category, data] of categories) {
      const count = data.issues.length;
      html += `<div class="qw-group" data-expandable>
        <div class="qw-group-header">
          <span class="qw-category-badge">${escapeHtml(category)}</span>
          <span class="qw-group-title">${count} issue${count !== 1 ? 's' : ''}</span>
          <span class="qw-group-grade ${gradeClass(data.grade)}">${escapeHtml(data.grade)}</span>
          <span class="check-expand-icon">&#9656;</span>
        </div>
        <div class="qw-group-issues">`;
      for (const issue of data.issues) {
        html += `<div class="qw-issue">
          <span class="check-icon check-fail">&#10007;</span>
          <div class="qw-issue-body">
            <div class="qw-issue-name">${escapeHtml(issue.name)}</div>
            <div class="qw-issue-fix">${escapeHtml(issue.recommendation)}</div>
          </div>
        </div>`;
      }
      html += '</div></div>';
    }
    container.innerHTML = html;

    // Bind expand/collapse
    container.querySelectorAll('.qw-group[data-expandable]').forEach((group) => {
      group.querySelector('.qw-group-header').addEventListener('click', () => {
        group.classList.toggle('expanded');
      });
    });
  }

  function loadHistory(hostname) {
    chrome.runtime.sendMessage({ type: 'GET_SCAN_HISTORY', hostname }, (response) => {
      const history = response?.history || [];
      const container = document.getElementById('history-section');
      if (!container || history.length < 2) return;

      const prev = history[history.length - 2];
      const curr = history[history.length - 1];

      // Numeric rank for semantic grade comparison (higher = better)
      const gradeRank = (g) => {
        const ranks = { 'A+': 12, 'A': 11, 'A-': 10, 'B+': 9, 'B': 8, 'B-': 7, 'C+': 6, 'C': 5, 'C-': 4, 'D+': 3, 'D': 2, 'D-': 1, 'F': 0 };
        return ranks[g] ?? -1;
      };

      let html = '<div class="section-title">Change Since Last Scan</div><div class="stat-grid">';
      const cats = ['security', 'performance', 'seo', 'privacy', 'accessibility'];
      for (const cat of cats) {
        const prevGrade = prev.grades[cat] || '?';
        const currGrade = curr.grades[cat] || '?';
        const prevRank = gradeRank(prevGrade);
        const currRank = gradeRank(currGrade);
        const improved = currRank > prevRank;
        const worsened = currRank < prevRank;
        const label = cat.charAt(0).toUpperCase() + cat.slice(1);
        html += `<div class="stat-card">
          <div class="stat-value ${improved ? 'stat-good' : worsened ? 'stat-bad' : 'stat-neutral'}">${prevGrade} → ${currGrade}</div>
          <div class="stat-label">${label}</div>
        </div>`;
      }
      html += '</div>';
      container.innerHTML = html;
      container.classList.remove('hidden');
    });
  }

  // ═══════════════════════════════════════════
  // EXPANDABLE CHECK ITEMS
  // ═══════════════════════════════════════════

  function bindExpandable(container) {
    container.querySelectorAll('.check-item[data-expandable]').forEach((item) => {
      item.addEventListener('click', () => {
        item.classList.toggle('expanded');
      });
    });
  }

  function renderExpandableCheck(c) {
    const hasExtra = c.detail || c.recommendation || c.value;
    if (!hasExtra) {
      // Simple non-expandable row
      const icon = c.passed === null ? 'i' : c.passed ? '&#10003;' : '&#10007;';
      const iconClass = c.passed === null ? 'check-info' : c.passed ? 'check-pass' : 'check-fail';
      return `<div class="check-item">
        <span class="check-icon ${iconClass}">${icon}</span>
        <div class="check-body">
          <div class="check-name">${c.name}</div>
        </div>
      </div>`;
    }

    const icon = c.passed === null ? 'i' : c.passed ? '&#10003;' : '&#10007;';
    const iconClass = c.passed === null ? 'check-info' : c.passed ? 'check-pass' : 'check-fail';

    // Short summary for collapsed view
    const summary = c.detail ? String(c.detail).slice(0, 60) + (String(c.detail).length > 60 ? '...' : '') : '';

    let expandedHtml = '';
    if (c.detail) expandedHtml += `<div class="check-detail">${escapeHtml(String(c.detail))}</div>`;
    if (c.value && c.value !== c.detail) expandedHtml += `<div class="check-detail">${escapeHtml(String(c.value))}</div>`;
    if (c.recommendation) expandedHtml += `<div class="check-recommendation">${escapeHtml(c.recommendation)}</div>`;

    return `<div class="check-item" data-expandable>
      <span class="check-icon ${iconClass}">${icon}</span>
      <div class="check-body">
        <div class="check-name">${c.name}<span class="check-expand-icon">&#9656;</span></div>
        <div class="check-summary">${escapeHtml(summary)}</div>
        <div class="check-expanded-content">${expandedHtml}</div>
      </div>
    </div>`;
  }

  function renderCheckListExpandable(checks) {
    return checks.map(renderExpandableCheck).join('');
  }

  // ═══════════════════════════════════════════
  // RENDERERS
  // ═══════════════════════════════════════════

  function renderGrades() {
    const r = analysisResults;
    const techCount = Object.values(r.tech).reduce((sum, arr) => sum + arr.length, 0);
    const techEl = document.getElementById('grade-tech');
    techEl.textContent = techCount;
    techEl.className = 'grade-letter grade-b';

    setGrade('grade-overall', getOverallGrade());
    setGrade('grade-security', r.security.grade);
    setGrade('grade-perf', r.perf.grade);
    setGrade('grade-seo', r.seo.grade);
    setGrade('grade-privacy', r.privacy.grade);
    setGrade('grade-a11y', r.a11y.grade);

    // Status code badge
    const statusCode = r.security.statusCode;
    const statusEl = document.getElementById('status-code');
    if (statusEl && statusCode) {
      statusEl.textContent = statusCode;
      statusEl.className = `status-badge ${statusCode < 300 ? 'status-ok' : statusCode < 400 ? 'status-redirect' : 'status-error'}`;
      statusEl.classList.remove('hidden');
    }

    switchTab('quick-wins');
  }

  function renderTech(tech) {
    const container = document.getElementById('tech-results');
    let html = '';

    const sections = [
      { key: 'frameworks', title: 'Frameworks' },
      { key: 'cms', title: 'CMS / Platform' },
      { key: 'hosting', title: 'Hosting' },
      { key: 'buildTools', title: 'Build Tools' },
      { key: 'cssFrameworks', title: 'CSS Framework' },
      { key: 'analytics', title: 'Analytics & Tracking' },
      { key: 'libraries', title: 'Libraries' },
    ];

    for (const s of sections) {
      const items = tech[s.key] || [];
      if (items.length === 0) continue;
      html += `<div class="section">
        <div class="section-title">${s.title}</div>
        <div class="tech-list">
          ${items.map((i) => `
            <div class="tech-badge">
              <span class="icon">${i.icon || ''}</span>
              <span>${escapeHtml(i.name)}</span>
              <span class="confidence">${i.confidence}%</span>
            </div>
          `).join('')}
        </div>
      </div>`;
    }

    if (!html) html = '<div class="empty-state">No technologies detected</div>';
    container.innerHTML = html;
  }

  function renderSecurity(sec) {
    const container = document.getElementById('security-results');
    let html = '';

    html += `<div class="section"><div class="stat-grid">
      <div class="stat-card"><div class="stat-value">${sec.score}/${sec.maxScore}</div><div class="stat-label">Security Score</div></div>
      <div class="stat-card"><div class="stat-value ${gradeClass(sec.grade)}">${sec.grade}</div><div class="stat-label">Grade</div></div>
    </div></div>`;

    const sections = [
      { key: 'headers', title: 'Header Checks' },
      { key: 'duplicates', title: 'Duplicate Headers' },
      { key: 'cross-origin', title: 'Cross-Origin Headers' },
      { key: 'csp', title: 'CSP Quality' },
      { key: 'sri', title: 'Subresource Integrity' },
    ];

    for (const s of sections) {
      const checks = sec.checks.filter((c) => c.section === s.key);
      if (checks.length === 0) continue;
      html += `<div class="section"><div class="section-title">${s.title}</div><div class="check-list">`;
      html += renderCheckListExpandable(checks);
      html += '</div></div>';
    }

    if (sec.cookies.length > 0) {
      html += '<div class="section"><div class="section-title">Cookies (JS-readable)</div><div class="check-list">';
      for (const c of sec.cookies) {
        html += renderExpandableCheck({
          name: c.name,
          passed: false,
          detail: 'Not HttpOnly — accessible from JavaScript',
          recommendation: 'Set HttpOnly flag to prevent XSS cookie theft',
        });
      }
      html += '</div></div>';
    }

    container.innerHTML = html;
    bindExpandable(container);
  }

  // Thresholds: [goodBelow, okBelow] — below good = green, below ok = yellow, else red
  // For "lower is better" metrics (ms, count, size)
  function perfColor(value, goodBelow, okBelow) {
    if (value < goodBelow) return 'stat-good';
    if (value < okBelow) return 'stat-ok';
    return 'stat-bad';
  }

  // For CLS (special decimal thresholds)
  function clsColor(value) {
    if (value < 0.1) return 'stat-good';
    if (value < 0.25) return 'stat-ok';
    return 'stat-bad';
  }

  // For boolean-ish: yes = good, no = bad
  function yesNoColor(value) {
    return value ? 'stat-good' : 'stat-ok';
  }

  // For "zero is best" (render-blocking, missing lazy, etc.)
  function zeroIsBestColor(value) {
    if (value === 0) return 'stat-good';
    if (value <= 2) return 'stat-ok';
    return 'stat-bad';
  }

  function protocolColor(proto) {
    if (proto === 'h2' || proto === 'h3') return 'stat-good';
    return 'stat-ok';
  }

  function renderPerformance(perf) {
    const container = document.getElementById('perf-results');
    let html = '';

    // Core Web Vitals
    const cwv = perf.coreWebVitals;
    if (cwv.lcp != null || cwv.cls != null || cwv.inp != null) {
      html += '<div class="section"><div class="section-title">Core Web Vitals</div><div class="stat-grid">';
      if (cwv.lcp != null) html += colorStatCard(cwv.lcp + 'ms', 'LCP', perfColor(cwv.lcp, 2500, 4000));
      if (cwv.cls != null) html += colorStatCard(cwv.cls, 'CLS', clsColor(cwv.cls));
      if (cwv.inp != null) html += colorStatCard(cwv.inp + 'ms', 'INP', perfColor(cwv.inp, 200, 500));
      if (cwv.fcp != null) html += colorStatCard(cwv.fcp + 'ms', 'FCP', perfColor(cwv.fcp, 1800, 3000));
      html += '</div></div>';
    }

    const t = perf.timing;
    html += '<div class="section"><div class="section-title">Timing</div><div class="stat-grid">';
    if (t.ttfb != null) html += colorStatCard(t.ttfb + 'ms', 'TTFB', perfColor(t.ttfb, 200, 500));
    if (t.fcp != null && cwv.lcp == null) html += colorStatCard(t.fcp + 'ms', 'FCP', perfColor(t.fcp, 1800, 3000));
    if (t.domContentLoaded != null) html += colorStatCard(t.domContentLoaded + 'ms', 'DOM Ready', perfColor(t.domContentLoaded, 2000, 3500));
    if (t.loadComplete != null) html += colorStatCard(t.loadComplete + 'ms', 'Full Load', perfColor(t.loadComplete, 3000, 5000));
    html += '</div></div>';

    const pw = perf.pageWeight;
    html += '<div class="section"><div class="section-title">Page Weight</div><div class="stat-grid">';
    html += colorStatCard(pw.totalTransferKB > 0 ? pw.totalTransferKB + ' KB' : 'N/A', 'Total Size', pw.totalTransferKB > 0 ? perfColor(pw.totalTransferKB, 1000, 3000) : 'stat-neutral');
    html += colorStatCard(pw.totalRequests, 'Requests', perfColor(pw.totalRequests, 50, 100));
    html += colorStatCard(perf.resourceBreakdown.renderBlockingScripts || 0, 'Render-Blocking', zeroIsBestColor(perf.resourceBreakdown.renderBlockingScripts || 0));
    if (perf.resourceBreakdown.protocol) html += colorStatCard(perf.resourceBreakdown.protocol, 'Protocol', protocolColor(perf.resourceBreakdown.protocol));
    html += '</div></div>';

    const imgStats = perf.resourceBreakdown.images;
    if (imgStats) {
      html += '<div class="section"><div class="section-title">Images</div><div class="stat-grid">';
      html += colorStatCard(imgStats.total, 'Total', 'stat-neutral');
      html += colorStatCard(imgStats.withWebP ? 'Yes' : 'No', 'WebP', yesNoColor(imgStats.withWebP));
      html += colorStatCard(imgStats.withAvif ? 'Yes' : 'No', 'AVIF', yesNoColor(imgStats.withAvif));
      html += colorStatCard(imgStats.missingLazy || 0, 'Missing Lazy', zeroIsBestColor(imgStats.missingLazy || 0));
      html += colorStatCard(imgStats.missingDimensions || 0, 'No Dimensions', zeroIsBestColor(imgStats.missingDimensions || 0));
      html += '</div></div>';
    }

    const fontStats = perf.resourceBreakdown.fonts;
    if (fontStats && fontStats.fileCount > 0) {
      html += '<div class="section"><div class="section-title">Fonts</div><div class="stat-grid">';
      html += colorStatCard(fontStats.fileCount, 'Font Files', perfColor(fontStats.fileCount, 5, 8));
      html += colorStatCard(fontStats.totalSizeKB + ' KB', 'Font Size', perfColor(fontStats.totalSizeKB, 100, 250));
      html += colorStatCard(fontStats.preloaded, 'Preloaded', fontStats.preloaded > 0 ? 'stat-good' : 'stat-neutral');
      html += '</div></div>';
    }

    if (perf.issues.length > 0) {
      html += '<div class="section"><div class="section-title">Issues</div>';
      for (const issue of perf.issues) {
        html += `<div class="issue-item issue-${issue.severity}">${escapeHtml(issue.message)}</div>`;
      }
      html += '</div>';
    }

    const lr = perf.resourceBreakdown.largestResources || [];
    if (lr.length > 0) {
      html += '<div class="section"><div class="section-title">Largest Resources</div>';
      html += '<table class="data-table"><tr><th>File</th><th>Type</th><th>Size</th></tr>';
      for (const r of lr) {
        html += `<tr><td>${escapeHtml(r.name)}</td><td>${r.type}</td><td>${r.sizeKB} KB</td></tr>`;
      }
      html += '</table></div>';
    }

    container.innerHTML = html;
  }

  function renderSeo(seo) {
    const container = document.getElementById('seo-results');
    let html = '';

    html += `<div class="section"><div class="stat-grid">
      <div class="stat-card"><div class="stat-value">${seo.score}/${seo.maxScore}</div><div class="stat-label">SEO Score</div></div>
      <div class="stat-card"><div class="stat-value ${gradeClass(seo.grade)}">${seo.grade}</div><div class="stat-label">Grade</div></div>
    </div></div>`;

    const groups = [
      { cat: 'on-page', title: 'On-Page SEO' },
      { cat: 'technical', title: 'Technical SEO' },
      { cat: 'social', title: 'Social & Rich Results' },
    ];

    for (const g of groups) {
      const checks = seo.checks.filter((c) => c.category === g.cat);
      if (checks.length === 0) continue;
      html += `<div class="section"><div class="section-title">${g.title}</div><div class="check-list">`;
      html += renderCheckListExpandable(checks);
      html += '</div></div>';
    }

    const h = seo.summary.headings;
    if (h) {
      html += '<div class="section"><div class="section-title">Heading Structure</div><div class="stat-grid">';
      html += statCard(h.h1, 'H1');
      html += statCard(h.h2, 'H2');
      html += statCard(h.h3, 'H3');
      html += statCard(h.h4, 'H4');
      html += statCard(h.h5, 'H5');
      html += statCard(h.h6, 'H6');
      html += '</div></div>';
    }

    // SERP preview
    const serp = seo.serp;
    if (serp && serp.title) {
      html += '<div class="section"><div class="section-title">SERP Preview</div>';
      html += `<div class="serp-preview">
        <div class="serp-url">${escapeHtml(serp.siteName)} &rsaquo; ${escapeHtml(serp.url)}</div>
        <div class="serp-title">${escapeHtml(serp.title)}</div>
        <div class="serp-desc">${escapeHtml(serp.description)}</div>
      </div></div>`;
    }

    // Social profiles
    const profiles = seo.socialProfiles || [];
    if (profiles.length > 0) {
      html += '<div class="section"><div class="section-title">Social Profiles</div><div class="tech-list">';
      for (const p of profiles) {
        html += `<div class="tech-badge"><span>${escapeHtml(p.platform)}</span></div>`;
      }
      html += '</div></div>';
    }

    container.innerHTML = html;
    bindExpandable(container);
  }

  function renderPrivacy(priv) {
    const container = document.getElementById('privacy-results');
    let html = '';

    html += `<div class="section"><div class="stat-grid">
      <div class="stat-card"><div class="stat-value">${priv.score}/${priv.maxScore}</div><div class="stat-label">Privacy Score</div></div>
      <div class="stat-card"><div class="stat-value ${gradeClass(priv.grade)}">${priv.grade}</div><div class="stat-label">Grade</div></div>
    </div></div>`;

    html += '<div class="section"><div class="section-title">Checks</div><div class="check-list">';
    html += renderCheckListExpandable(priv.checks);
    html += '</div></div>';

    if (priv.trackers.length > 0) {
      html += '<div class="section"><div class="section-title">Trackers Detected</div><div class="tracker-list">';
      for (const t of priv.trackers) {
        html += `<span class="tracker-tag">${escapeHtml(t)}</span>`;
      }
      html += '</div></div>';
    }

    if (priv.cookies.length > 0) {
      html += '<div class="section"><div class="section-title">Cookies</div>';
      html += '<table class="data-table"><tr><th>Name</th><th>Category</th></tr>';
      for (const c of priv.cookies) {
        html += `<tr><td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.category)}</td></tr>`;
      }
      html += '</table></div>';
    }

    if (priv.thirdPartyDomains.length > 0) {
      html += '<div class="section"><div class="section-title">Third-Party Domains</div>';
      for (const d of priv.thirdPartyDomains) {
        html += `<div class="domain-item">
          <span>${escapeHtml(d.domain)}</span>
          <span class="domain-category">${escapeHtml(d.category)}</span>
        </div>`;
      }
      html += '</div>';
    }

    container.innerHTML = html;
    bindExpandable(container);
  }

  function renderAccessibility(a11y) {
    const container = document.getElementById('a11y-results');
    let html = '';

    html += `<div class="section"><div class="stat-grid">
      <div class="stat-card"><div class="stat-value">${a11y.score}/${a11y.maxScore}</div><div class="stat-label">A11y Score</div></div>
      <div class="stat-card"><div class="stat-value ${gradeClass(a11y.grade)}">${a11y.grade}</div><div class="stat-label">Grade</div></div>
    </div></div>`;

    const sections = [
      { key: 'structure', title: 'Structure & Navigation' },
      { key: 'media', title: 'Images & Media' },
      { key: 'contrast', title: 'Color Contrast' },
      { key: 'forms', title: 'Forms & Interactivity' },
      { key: 'focus', title: 'Focus & Keyboard' },
    ];

    for (const s of sections) {
      const checks = a11y.checks.filter((c) => c.section === s.key);
      if (checks.length === 0) continue;
      html += `<div class="section"><div class="section-title">${s.title}</div><div class="check-list">`;
      html += renderCheckListExpandable(checks);
      html += '</div></div>';
    }

    const lm = a11y.summary.landmarks;
    if (lm) {
      html += '<div class="section"><div class="section-title">Landmarks</div><div class="stat-grid">';
      html += statCard(lm.main || 0, 'Main');
      html += statCard(lm.navigation || 0, 'Nav');
      html += statCard(lm.banner || 0, 'Banner');
      html += statCard(lm.contentinfo || 0, 'Footer');
      html += statCard(lm.complementary || 0, 'Aside');
      html += statCard(lm.search || 0, 'Search');
      html += '</div></div>';
    }

    html += '<div class="section"><div class="section-title">ARIA Usage</div><div class="stat-grid">';
    html += statCard(a11y.summary.ariaRoleCount || 0, 'ARIA Roles');
    html += statCard(a11y.summary.totalInputs || 0, 'Form Inputs');
    html += statCard(a11y.summary.totalImages || 0, 'Images');
    html += '</div></div>';

    container.innerHTML = html;
    bindExpandable(container);
  }

  function renderKeywords(kw) {
    const container = document.getElementById('keywords-results');
    if (!container || !kw.keywords || kw.keywords.length === 0) return;

    let html = '';
    html += '<div class="section"><div class="section-title">Top Keywords</div>';
    html += '<table class="data-table"><tr><th>Keyword</th><th>Count</th><th>Density</th></tr>';
    for (const k of kw.keywords) {
      html += `<tr><td>${escapeHtml(k.word)}</td><td>${k.count}</td><td>${k.density}%</td></tr>`;
    }
    html += '</table></div>';

    if (kw.bigrams && kw.bigrams.length > 0) {
      html += '<div class="section"><div class="section-title">Top Phrases (2-word)</div>';
      html += '<table class="data-table"><tr><th>Phrase</th><th>Count</th></tr>';
      for (const b of kw.bigrams) {
        html += `<tr><td>${escapeHtml(b.phrase)}</td><td>${b.count}</td></tr>`;
      }
      html += '</table></div>';
    }

    container.innerHTML = html;
  }

  // ═══════════════════════════════════════════
  // DARK MODE
  // ═══════════════════════════════════════════

  function initDarkMode() {
    chrome.storage.local.get(['darkMode'], (result) => {
      if (result.darkMode) document.body.classList.add('dark');
    });
    const btn = document.getElementById('dark-mode-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        document.body.classList.toggle('dark');
        chrome.storage.local.set({ darkMode: document.body.classList.contains('dark') });
      });
    }
  }

  // ═══════════════════════════════════════════
  // PDF REPORT
  // ═══════════════════════════════════════════

  function openPdfReport() {
    if (!analysisResults.security) return;
    try {
      const html = generateReport(analysisResults, analyzedUrl);
      // Use data URI since blob URLs may be blocked in extensions
      const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
      chrome.tabs.create({ url: dataUrl });
    } catch (e) { console.error('PDF report error:', e); }
  }

  // ═══════════════════════════════════════════
  // OUTREACH EMAIL
  // ═══════════════════════════════════════════

  function showEmailModal() {
    if (!analysisResults.security) return;
    try {
      const email = generateOutreachEmail(analysisResults, analyzedUrl);
      document.getElementById('email-content').value = email;
      document.getElementById('email-modal').classList.remove('hidden');
    } catch (e) { console.error('Email generator error:', e); }
  }

  function copyEmail() {
    const textarea = document.getElementById('email-content');
    textarea.select();
    navigator.clipboard.writeText(textarea.value).then(() => {
      const btn = document.getElementById('email-copy');
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy to clipboard'; }, 2000);
    });
  }

  // ═══════════════════════════════════════════
  // CSV EXPORT
  // ═══════════════════════════════════════════

  function exportCsv() {
    const r = analysisResults;
    const perf = r.perf;

    // Uniform 6-column layout: all rows padded to same width for clean spreadsheet rendering
    const C = 6; // column count
    const pad = (arr) => { while (arr.length < C) arr.push(''); return arr; };
    const blank = () => pad([]);
    const header = (text) => pad([text, '', '', '', '', '']);

    const rows = [];

    // ─── Report header ───
    rows.push(pad(['Site Inspector Report', '', '', '', '', '']));
    rows.push(pad(['URL', analyzedUrl]));
    rows.push(pad(['Date', new Date().toISOString().slice(0, 19).replace('T', ' ')]));
    rows.push(pad(['Generated by', 'Bright Interaction', '', 'https://brightinteraction.com']));
    rows.push(blank());

    // ─── Summary grades ───
    rows.push(pad(['SUMMARY', '', '', '', '', '']));
    rows.push(pad(['Category', 'Grade', 'Score', 'Max Score', 'Percentage', '']));
    const cats = [
      ['Security', r.security],
      ['Performance', r.perf],
      ['SEO', r.seo],
      ['Privacy', r.privacy],
      ['Accessibility', r.a11y],
    ];
    for (const [name, data] of cats) {
      const pctVal = data.maxScore > 0 ? Math.round((data.score / data.maxScore) * 100) + '%' : 'N/A';
      rows.push(pad([name, data.grade, data.score, data.maxScore, pctVal]));
    }
    rows.push(blank());

    // ─── All checks ───
    rows.push(pad(['DETAILED CHECKS', '', '', '', '', '']));
    rows.push(pad(['Category', 'Section', 'Check', 'Status', 'Detail', 'Recommendation']));

    const addChecks = (category, checks) => {
      for (const c of checks) {
        const status = c.passed === null ? 'Info' : c.passed ? 'Pass' : 'Fail';
        const section = c.section || c.category || '';
        rows.push([
          category,
          section,
          c.name,
          status,
          String(c.detail || c.value || ''),
          String(c.recommendation || ''),
        ]);
      }
    };

    addChecks('Security', r.security.checks);
    addChecks('Performance', perf.issues.map((i) => ({
      name: i.message,
      passed: i.severity === 'info' ? null : false,
      detail: '',
      recommendation: '',
      section: i.severity,
    })));
    addChecks('SEO', r.seo.checks);
    addChecks('Privacy', r.privacy.checks);
    addChecks('Accessibility', r.a11y.checks);
    rows.push(blank());

    // ─── Performance metrics ───
    rows.push(pad(['PERFORMANCE METRICS', '', '', '', '', '']));
    rows.push(pad(['Metric', 'Value', 'Unit', 'Rating', '', '']));
    const t = perf.timing;
    const cwv = perf.coreWebVitals;
    const pw = perf.pageWeight;
    const addMetric = (name, value, unit, good, ok) => {
      if (value == null) return;
      const rating = value < good ? 'Good' : value < ok ? 'Needs Work' : 'Poor';
      rows.push(pad([name, value, unit, rating]));
    };
    addMetric('TTFB', t.ttfb, 'ms', 200, 500);
    addMetric('First Contentful Paint', t.fcp || cwv.fcp, 'ms', 1800, 3000);
    if (cwv.lcp != null) addMetric('Largest Contentful Paint', cwv.lcp, 'ms', 2500, 4000);
    if (cwv.inp != null) addMetric('Interaction to Next Paint', cwv.inp, 'ms', 200, 500);
    if (cwv.cls != null) addMetric('Cumulative Layout Shift', cwv.cls, '', 0.1, 0.25);
    addMetric('DOM Ready', t.domContentLoaded, 'ms', 2000, 3500);
    addMetric('Full Load', t.loadComplete, 'ms', 3000, 5000);
    rows.push(pad(['Total Size', pw.totalTransferKB > 0 ? pw.totalTransferKB : 'N/A', pw.totalTransferKB > 0 ? 'KB' : '', pw.totalTransferKB > 0 ? (pw.totalTransferKB < 1000 ? 'Good' : pw.totalTransferKB < 3000 ? 'Needs Work' : 'Poor') : 'N/A']));
    rows.push(pad(['Total Requests', pw.totalRequests, '', pw.totalRequests < 50 ? 'Good' : pw.totalRequests < 100 ? 'Needs Work' : 'Poor']));
    rows.push(pad(['Render-Blocking Scripts', perf.resourceBreakdown.renderBlockingScripts || 0, '', (perf.resourceBreakdown.renderBlockingScripts || 0) === 0 ? 'Good' : 'Needs Work']));
    if (perf.resourceBreakdown.protocol) rows.push(pad(['Protocol', perf.resourceBreakdown.protocol, '', perf.resourceBreakdown.protocol === 'h2' || perf.resourceBreakdown.protocol === 'h3' ? 'Good' : 'Needs Work']));
    rows.push(blank());

    // ─── Tech stack ───
    rows.push(pad(['TECH STACK', '', '', '', '', '']));
    rows.push(pad(['Category', 'Technology', 'Confidence', '', '', '']));
    const techLabels = {
      frameworks: 'Framework', cms: 'CMS', hosting: 'Hosting', buildTools: 'Build Tool',
      cssFrameworks: 'CSS Framework', analytics: 'Analytics', libraries: 'Library',
    };
    for (const [key, label] of Object.entries(techLabels)) {
      for (const item of r.tech[key] || []) {
        rows.push(pad([label, item.name, item.confidence + '%']));
      }
    }
    rows.push(blank());

    // ─── Trackers & third-party ───
    if (r.privacy.trackers.length > 0 || r.privacy.thirdPartyDomains.length > 0 || r.privacy.cookies.length > 0) {
      rows.push(pad(['PRIVACY DETAILS', '', '', '', '', '']));
    }
    if (r.privacy.trackers.length > 0) {
      rows.push(pad(['Trackers Detected', '', '', '', '', '']));
      for (const t of r.privacy.trackers) rows.push(pad([t]));
      rows.push(blank());
    }
    if (r.privacy.thirdPartyDomains.length > 0) {
      rows.push(pad(['Third-Party Domain', 'Category', '', '', '', '']));
      for (const d of r.privacy.thirdPartyDomains) rows.push(pad([d.domain, d.category]));
      rows.push(blank());
    }
    if (r.privacy.cookies.length > 0) {
      rows.push(pad(['Cookie Name', 'Category', '', '', '', '']));
      for (const c of r.privacy.cookies) rows.push(pad([c.name, c.category]));
      rows.push(blank());
    }

    // ─── Keywords ───
    const kw = r.keywords || {};
    if (kw.keywords && kw.keywords.length > 0) {
      rows.push(pad(['KEYWORD ANALYSIS', '', '', '', '', '']));
      rows.push(pad(['Keyword', 'Count', 'Density', '', '', '']));
      for (const k of kw.keywords) {
        rows.push(pad([k.word, k.count, k.density + '%']));
      }
      if (kw.bigrams && kw.bigrams.length > 0) {
        rows.push(blank());
        rows.push(pad(['Top Phrases', 'Count', '', '', '', '']));
        for (const b of kw.bigrams) {
          rows.push(pad([b.phrase, b.count]));
        }
      }
      rows.push(blank());
    }

    // ─── Footer ───
    rows.push(pad(['']));
    rows.push(pad(['Need help improving your scores? Visit https://brightinteraction.com']));

    // Build CSV
    const csv = rows.map((row) =>
      row.map((cell) => {
        const str = String(cell ?? '');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(',')
    ).join('\n');

    // Download
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const hostname = new URL(analyzedUrl).hostname.replace(/\./g, '-');
    const date = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = url;
    a.download = `site-inspector-${hostname}-${date}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ─── Helpers ───

  function statCard(value, label) {
    return `<div class="stat-card">
      <div class="stat-value">${value}</div>
      <div class="stat-label">${label}</div>
    </div>`;
  }

  function colorStatCard(value, label, colorClass) {
    return `<div class="stat-card">
      <div class="stat-value ${colorClass || ''}">${value}</div>
      <div class="stat-label">${label}</div>
    </div>`;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  init();
})();
