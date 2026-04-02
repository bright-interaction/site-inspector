// Site Inspector — PDF Report & Outreach Email Generator

function generateReport(results, url) {
  const r = results;
  const hostname = new URL(url).hostname;
  const date = new Date().toISOString().slice(0, 10);
  const overall = calculateGradePlusMinus(
    r.security.score + r.perf.score + r.seo.score + r.privacy.score + r.a11y.score,
    r.security.maxScore + r.perf.maxScore + r.seo.maxScore + r.privacy.maxScore + r.a11y.maxScore
  );

  const gradeColor = (g) => {
    const c = (g || '?').charAt(0);
    if (c === 'A') return '#16a34a';
    if (c === 'B') return '#2563eb';
    if (c === 'C') return '#d97706';
    if (c === 'D') return '#ea580c';
    return '#dc2626';
  };

  const gradeCircle = (label, grade, score, max) => `
    <div class="grade-circle">
      <div class="circle" style="border-color: ${gradeColor(grade)}">${esc(grade)}</div>
      <div class="circle-label">${esc(label)}</div>
      <div class="circle-score">${score}/${max}</div>
    </div>`;

  // Split checks into pass/info vs fail, render differently
  const renderChecks = (title, checks) => {
    if (!checks || checks.length === 0) return '';

    const passing = checks.filter((c) => c.passed === true);
    const failing = checks.filter((c) => c.passed === false);
    const info = checks.filter((c) => c.passed === null);

    let html = `<div class="check-section"><h3>${esc(title)}</h3>`;

    // Failing checks — stacked layout, full width, nothing truncated
    for (const c of failing) {
      const detail = String(c.detail || c.value || '');
      html += `<div class="fail-card">
        <div class="fail-header"><span class="fail-icon">&#10007;</span> <strong>${esc(c.name)}</strong></div>
        ${detail ? `<div class="fail-detail">${esc(detail)}</div>` : ''}
        ${c.recommendation ? `<div class="fail-fix">${esc(c.recommendation)}</div>` : ''}
      </div>`;
    }

    // Passing checks — compact inline list
    if (passing.length > 0) {
      html += '<div class="pass-list">';
      for (const c of passing) {
        const detail = String(c.detail || c.value || '');
        html += `<div class="pass-row"><span class="pass-icon">&#10003;</span> <span class="pass-name">${esc(c.name)}</span>${detail ? ` <span class="pass-detail">— ${esc(detail)}</span>` : ''}</div>`;
      }
      html += '</div>';
    }

    // Info items
    if (info.length > 0) {
      html += '<div class="pass-list">';
      for (const c of info) {
        const detail = String(c.detail || c.value || '');
        html += `<div class="pass-row"><span class="info-icon">&#8505;</span> <span class="pass-name">${esc(c.name)}</span>${detail ? ` <span class="pass-detail">— ${esc(detail)}</span>` : ''}</div>`;
      }
      html += '</div>';
    }

    html += '</div>'; // close .check-section
    return html;
  };

  // Tech stack
  const techItems = [];
  const techLabels = { frameworks: 'Framework', cms: 'CMS', hosting: 'Hosting', buildTools: 'Build Tool', cssFrameworks: 'CSS', analytics: 'Analytics', libraries: 'Library' };
  for (const [key, label] of Object.entries(techLabels)) {
    for (const item of r.tech[key] || []) {
      techItems.push(`<span class="tech-tag">${esc(label)}: ${esc(item.name)}</span>`);
    }
  }

  // Performance metrics
  const t = r.perf.timing || {};
  const cwv = r.perf.coreWebVitals || {};
  const pw = r.perf.pageWeight || {};
  const metricRow = (name, value, unit, good, ok) => {
    if (value == null) return '';
    const rating = value < good ? 'Good' : value < ok ? 'Needs Work' : 'Poor';
    const color = rating === 'Good' ? '#16a34a' : rating === 'Needs Work' ? '#d97706' : '#dc2626';
    return `<tr><td>${esc(name)}</td><td style="font-weight:700">${value}${unit ? ' ' + unit : ''}</td><td style="color:${color};font-weight:600">${rating}</td></tr>`;
  };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Site Inspector Report — ${esc(hostname)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 12px; color: #1e293b; padding: 32px 40px; max-width: 900px; margin: 0 auto; }
  h1 { font-size: 20px; margin-bottom: 2px; }
  h2 { font-size: 15px; margin: 20px 0 10px; padding-bottom: 4px; border-bottom: 2px solid #1e293b; }
  h3 { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin: 14px 0 6px; }
  .meta { color: #64748b; font-size: 11px; margin-bottom: 20px; }
  .grades { display: flex; gap: 12px; justify-content: center; margin: 20px 0; }
  .grade-circle { text-align: center; }
  .circle { width: 52px; height: 52px; border-radius: 50%; border: 3px solid; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 800; margin: 0 auto 3px; }
  .circle-label { font-size: 10px; font-weight: 600; color: #64748b; text-transform: uppercase; }
  .circle-score { font-size: 9px; color: #94a3b8; }
  .overall-box { text-align: center; margin: 16px 0 24px; }
  .overall-grade { font-size: 44px; font-weight: 800; }
  .overall-label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th { text-align: left; font-size: 9px; color: #64748b; text-transform: uppercase; padding: 3px 6px; border-bottom: 1px solid #e2e8f0; }
  td { padding: 4px 6px; border-bottom: 1px solid #f1f5f9; font-size: 11px; vertical-align: top; }
  .fail-card { background: #fef7f5; border: 1px solid #fde8e0; border-radius: 6px; padding: 8px 10px; margin-bottom: 6px; }
  .fail-header { font-size: 12px; color: #1e293b; }
  .fail-icon { color: #dc2626; font-weight: 700; }
  .fail-detail { font-size: 11px; color: #475569; margin-top: 4px; word-break: break-word; }
  .fail-fix { font-size: 11px; color: #ea580c; margin-top: 4px; padding: 4px 8px; background: #fff7ed; border-left: 2px solid #ea580c; border-radius: 2px; }
  .pass-list { margin-bottom: 8px; }
  .pass-row { font-size: 11px; padding: 2px 0; line-height: 1.5; }
  .pass-icon { color: #16a34a; font-weight: 700; }
  .info-icon { color: #64748b; }
  .pass-name { font-weight: 500; color: #1e293b; }
  .pass-detail { color: #94a3b8; word-break: break-word; }
  .tech-tags { display: flex; flex-wrap: wrap; gap: 5px; margin: 6px 0; }
  .tech-tag { padding: 3px 8px; background: #f1f5f9; border-radius: 4px; font-size: 11px; }
  .perf-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 8px 0; }
  .perf-card { padding: 8px 10px; background: #f8fafc; border-radius: 6px; border: 1px solid #f1f5f9; }
  .perf-value { font-size: 16px; font-weight: 700; }
  .perf-label { font-size: 9px; color: #64748b; text-transform: uppercase; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 10px; }
  .footer a { color: #64748b; }
  .check-section { break-inside: avoid; }
  .page-section { padding-top: 0; }
  @page {
    size: A4;
    margin: 1in 1in 1in 1in;
  }
  @media print {
    body { padding: 0; margin: 0; font-size: 11px; }
    .page-section { break-before: page; padding-top: 0; }
    .page-section:first-of-type { break-before: auto; }
    h2 { break-after: avoid; }
    h3 { break-after: avoid; }
    table { break-inside: avoid; }
    .overall-box, .grades { break-inside: avoid; }
    .fail-card { break-inside: avoid; }
    .check-section { break-inside: avoid; }
    .pass-list { break-inside: avoid; }
    .tech-tags { break-inside: avoid; }
    .footer { break-inside: avoid; }
  }
</style>
</head>
<body>
  <h1>Site Inspector Report</h1>
  <div class="meta">${esc(url)} — ${esc(date)}</div>

  <div class="overall-box">
    <div class="overall-grade" style="color:${gradeColor(overall)}">${esc(overall)}</div>
    <div class="overall-label">Overall Grade</div>
  </div>

  <div class="grades">
    ${gradeCircle('Security', r.security.grade, r.security.score, r.security.maxScore)}
    ${gradeCircle('Performance', r.perf.grade, r.perf.score, r.perf.maxScore)}
    ${gradeCircle('SEO', r.seo.grade, r.seo.score, r.seo.maxScore)}
    ${gradeCircle('Privacy', r.privacy.grade, r.privacy.score, r.privacy.maxScore)}
    ${gradeCircle('Accessibility', r.a11y.grade, r.a11y.score, r.a11y.maxScore)}
  </div>

  <h2>Tech Stack</h2>
  <div class="tech-tags">${techItems.length > 0 ? techItems.join('') : '<span class="tech-tag">No technologies detected</span>'}</div>

  <h2>Performance</h2>
  <table><thead><tr><th>Metric</th><th>Value</th><th>Rating</th></tr></thead><tbody>
    ${metricRow('TTFB', t.ttfb, 'ms', 200, 500)}
    ${metricRow('First Contentful Paint', t.fcp || cwv.fcp, 'ms', 1800, 3000)}
    ${cwv.lcp != null ? metricRow('Largest Contentful Paint', cwv.lcp, 'ms', 2500, 4000) : ''}
    ${cwv.inp != null ? metricRow('Interaction to Next Paint', cwv.inp, 'ms', 200, 500) : ''}
    ${cwv.cls != null ? metricRow('Cumulative Layout Shift', cwv.cls, '', 0.1, 0.25) : ''}
    ${metricRow('DOM Ready', t.domContentLoaded, 'ms', 2000, 3500)}
    ${metricRow('Full Load', t.loadComplete, 'ms', 3000, 5000)}
    ${pw.totalTransferKB > 0 ? metricRow('Total Size', pw.totalTransferKB, 'KB', 1000, 3000) : ''}
    ${metricRow('Requests', pw.totalRequests, '', 50, 100)}
  </tbody></table>
  ${r.perf.issues.length > 0 ? '<h3>Issues</h3><table><tbody>' + r.perf.issues.map((i) => `<tr><td class="icon-cell" style="color:${i.severity === 'critical' ? '#dc2626' : i.severity === 'warning' ? '#d97706' : '#64748b'}">&#9679;</td><td>${esc(i.message)}</td></tr>`).join('') + '</tbody></table>' : '<p style="color:#16a34a;margin:8px 0">No performance issues detected.</p>'}

  <div class="page-section">
  <h2>Security</h2>
  ${renderChecks('Header Checks', r.security.checks.filter((c) => c.section === 'headers'))}
  ${renderChecks('Cross-Origin', r.security.checks.filter((c) => c.section === 'cross-origin'))}
  ${renderChecks('CSP Quality', r.security.checks.filter((c) => c.section === 'csp'))}
  ${renderChecks('Subresource Integrity', r.security.checks.filter((c) => c.section === 'sri'))}
  ${renderChecks('Duplicate Headers', r.security.checks.filter((c) => c.section === 'duplicates'))}
  </div>

  <div class="page-section">
  <h2>SEO</h2>
  ${renderChecks('On-Page', r.seo.checks.filter((c) => c.category === 'on-page'))}
  ${renderChecks('Technical', r.seo.checks.filter((c) => c.category === 'technical'))}
  ${renderChecks('Social & Rich Results', r.seo.checks.filter((c) => c.category === 'social'))}
  </div>

  <div class="page-section">
  <h2>Privacy</h2>
  ${renderChecks('Checks', r.privacy.checks)}
  ${r.privacy.trackers.length > 0 ? '<h3>Trackers</h3><div class="tech-tags">' + r.privacy.trackers.map((t) => `<span class="tech-tag" style="background:#fef2f2;color:#dc2626">${esc(t)}</span>`).join('') + '</div>' : ''}
  </div>

  <div class="page-section">
  <h2>Accessibility</h2>
  ${renderChecks('Structure & Navigation', r.a11y.checks.filter((c) => c.section === 'structure'))}
  ${renderChecks('Images & Media', r.a11y.checks.filter((c) => c.section === 'media'))}
  ${renderChecks('Color Contrast', r.a11y.checks.filter((c) => c.section === 'contrast'))}
  ${renderChecks('Forms & Interactivity', r.a11y.checks.filter((c) => c.section === 'forms'))}
  ${renderChecks('Focus & Keyboard', r.a11y.checks.filter((c) => c.section === 'focus'))}
  </div>

  <div class="footer">
    Generated by <a href="https://brightinteraction.com">Site Inspector by Bright Interaction</a><br>
    Need help improving your scores? Visit brightinteraction.com
  </div>
</body>
</html>`;

  return html;
}

function generateOutreachEmail(results, url) {
  const r = results;
  const hostname = new URL(url).hostname;
  const company = hostname.replace(/^www\./, '').split('.')[0];
  const companyName = company.charAt(0).toUpperCase() + company.slice(1);

  // Collect top issues
  const issues = [];
  const addIssues = (category, checks) => {
    for (const c of checks) {
      if (c.passed === false && c.recommendation) {
        issues.push({ category, name: c.name, fix: c.recommendation });
      }
    }
  };
  addIssues('Security', r.security.checks);
  addIssues('Performance', (r.perf.issues || []).map((i) => ({ name: i.message, passed: false, recommendation: i.message })));
  addIssues('SEO', r.seo.checks);
  addIssues('Privacy', r.privacy.checks);
  addIssues('Accessibility', r.a11y.checks);

  const topIssues = issues.slice(0, 5);

  const grades = [
    `Security: ${r.security.grade}`,
    `Performance: ${r.perf.grade}`,
    `SEO: ${r.seo.grade}`,
    `Privacy: ${r.privacy.grade}`,
    `Accessibility: ${r.a11y.grade}`,
  ].join(' | ');

  const issueList = topIssues.map((i, idx) => `${idx + 1}. ${i.name} (${i.category})`).join('\n');

  const email = `Subject: Quick audit of ${hostname} — a few things stood out

Hi ${companyName} team,

I ran a quick technical audit of ${hostname} and wanted to share a few findings:

${grades}

Top issues I noticed:
${issueList}

${topIssues.length > 0 ? `The most impactful fix would be "${topIssues[0].name}" — ${topIssues[0].fix.toLowerCase()}` : 'Your site looks solid across the board.'}

I put together a detailed report with all the specifics. Happy to walk through it if you're interested — just reply and I'll send it over.

Best,
[Your name]
Bright Interaction
https://brightinteraction.com`;

  return email;
}

function esc(str) {
  const div = document.createElement('div');
  div.textContent = String(str ?? '');
  return div.innerHTML;
}
