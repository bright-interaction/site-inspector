// Accessibility Analyzer

const AccessibilityAnalyzer = {
  analyze(data) {
    const a11y = data.domData?.accessibility || {};
    const seo = data.domData?.seo || {};
    const meta = data.domData?.meta || {};
    const contrast = data.domData?.contrast || {};

    const results = {
      score: 0,
      maxScore: 0,
      grade: '',
      checks: [],
      summary: {},
    };

    // Structure & Navigation
    this.checkLandmarks(a11y, results);
    this.checkSkipLink(a11y, results);
    this.checkHeadingStructure(seo, results);
    this.checkLanguage(a11y, results);
    this.checkTitle(a11y, results);

    // Images & Media
    this.checkImageAlt(a11y, results);
    this.checkVideoCaptions(a11y, results);

    // Forms & Interactivity
    this.checkFormLabels(a11y, results);
    this.checkEmptyButtons(a11y, results);
    this.checkEmptyLinks(a11y, results);
    this.checkAutocomplete(a11y, results);

    // Color Contrast
    this.checkColorContrast(contrast, results);

    // Focus & Keyboard
    this.checkTabindex(a11y, results);
    this.checkFocusOutline(a11y, results);
    this.checkAriaHiddenFocusable(a11y, results);

    // Tables
    this.checkTables(a11y, results);

    // Summary
    results.summary = {
      landmarks: a11y.landmarks || {},
      ariaRoleCount: a11y.ariaRoleCount || 0,
      totalInputs: a11y.totalInputs || 0,
      totalImages: a11y.totalImages || 0,
    };

    results.grade = this.calculateGrade(results.score, results.maxScore);
    return results;
  },

  addCheck(results, name, passed, weight, detail, recommendation, section) {
    results.maxScore += weight;
    if (passed) results.score += weight;
    results.checks.push({
      name,
      passed,
      weight,
      detail,
      recommendation: passed ? null : recommendation,
      section: section || 'structure',
    });
  },

  // ─── Structure & Navigation ───

  checkLandmarks(a11y, results) {
    this.addCheck(results, 'Main Landmark', a11y.hasMain, 2,
      a11y.hasMain ? '<main> or role="main" found' : 'Missing',
      'Add a <main> element to identify the primary content region', 'structure');

    this.addCheck(results, 'Navigation Landmark', a11y.hasNav, 2,
      a11y.hasNav ? `${a11y.landmarks?.navigation || 0} navigation region(s)` : 'Missing',
      'Add a <nav> element for navigation menus', 'structure');

    this.addCheck(results, 'Banner Landmark', a11y.hasBanner, 1,
      a11y.hasBanner ? '<header> or role="banner" found' : 'Missing',
      'Add a <header> element for the page banner', 'structure');

    this.addCheck(results, 'Contentinfo Landmark', a11y.hasContentinfo, 1,
      a11y.hasContentinfo ? '<footer> or role="contentinfo" found' : 'Missing',
      'Add a <footer> element for copyright and site-wide info', 'structure');
  },

  checkSkipLink(a11y, results) {
    this.addCheck(results, 'Skip Navigation Link', a11y.hasSkipLink, 2,
      a11y.hasSkipLink ? 'Skip link found' : 'Missing',
      'Add a "Skip to main content" link as the first focusable element for keyboard users', 'structure');
  },

  checkHeadingStructure(seo, results) {
    const h1Count = seo.h1Count || 0;
    this.addCheck(results, 'Page Has H1', h1Count > 0, 2,
      h1Count > 0 ? seo.h1Text?.[0] || 'Present' : 'Missing',
      'Add an H1 heading — screen readers use it to identify the page', 'structure');

    const issues = seo.headingHierarchyIssues || [];
    this.addCheck(results, 'Heading Order', issues.length === 0, 2,
      issues.length === 0 ? 'Proper nesting' : issues.join('; '),
      'Maintain sequential heading levels (H1 > H2 > H3) — don\'t skip levels', 'structure');

    const emptyHeadings = seo.emptyHeadings || 0;
    if (emptyHeadings > 0) {
      this.addCheck(results, 'No Empty Headings', false, 1,
        `${emptyHeadings} empty heading(s)`,
        'Screen readers announce empty headings, confusing users — remove or fill them', 'structure');
    }
  },

  checkLanguage(a11y, results) {
    this.addCheck(results, 'Page Language', a11y.hasLangAttr, 2,
      a11y.hasLangAttr ? `lang="${a11y.langValue}"` : 'Missing',
      'Add lang attribute to <html> — screen readers need it for correct pronunciation', 'structure');
  },

  checkTitle(a11y, results) {
    this.addCheck(results, 'Page Title', a11y.hasTitle, 2,
      a11y.hasTitle ? 'Present' : 'Missing',
      'Add a <title> — screen readers announce it when the page loads', 'structure');
  },

  // ─── Images & Media ───

  checkImageAlt(a11y, results) {
    const total = a11y.totalImages || 0;
    const missing = a11y.imagesWithoutAlt || 0;
    const decorative = a11y.imagesWithEmptyAlt || 0;

    if (total > 0) {
      this.addCheck(results, 'Images Have Alt Text', missing === 0, 3,
        missing === 0
          ? `${total} image(s), all have alt attributes${decorative > 0 ? ` (${decorative} decorative)` : ''}`
          : `${missing}/${total} missing alt attribute entirely`,
        'Add alt="" to decorative images and descriptive alt text to meaningful images', 'media');
    }
  },

  checkVideoCaptions(a11y, results) {
    if (a11y.totalVideos > 0) {
      const missing = a11y.videosWithoutCaptions || 0;
      this.addCheck(results, 'Videos Have Captions', missing === 0, 2,
        missing === 0 ? `${a11y.totalVideos} video(s) with captions` : `${missing}/${a11y.totalVideos} missing captions`,
        'Add <track kind="captions"> to video elements for deaf/hard-of-hearing users', 'media');
    }
  },

  // ─── Forms & Interactivity ───

  checkFormLabels(a11y, results) {
    const total = a11y.totalInputs || 0;
    const missing = a11y.inputsWithoutLabels || 0;

    if (total > 0) {
      this.addCheck(results, 'Form Inputs Have Labels', missing === 0, 3,
        missing === 0
          ? `${total} input(s), all labeled`
          : `${missing}/${total} inputs missing labels`,
        'Associate each input with a <label for="...">, aria-label, or aria-labelledby', 'forms');
    }
  },

  checkEmptyButtons(a11y, results) {
    const count = a11y.emptyButtons || 0;
    if (count > 0) {
      this.addCheck(results, 'Buttons Have Labels', false, 2,
        `${count} button(s) without accessible name`,
        'Add text content, aria-label, or title to all buttons', 'forms');
    }
  },

  checkEmptyLinks(a11y, results) {
    const count = a11y.emptyLinks || 0;
    if (count > 0) {
      this.addCheck(results, 'Links Have Labels', false, 2,
        `${count} link(s) without accessible name`,
        'Add text content, aria-label, or title to all links', 'forms');
    }
  },

  checkAutocomplete(a11y, results) {
    const pwMissing = a11y.passwordInputsWithoutAutocomplete || 0;
    const emailMissing = a11y.emailInputsWithoutAutocomplete || 0;
    if (pwMissing > 0 || emailMissing > 0) {
      const parts = [];
      if (pwMissing) parts.push(`${pwMissing} password`);
      if (emailMissing) parts.push(`${emailMissing} email`);
      this.addCheck(results, 'Autocomplete Attributes', false, 1,
        `${parts.join(', ')} input(s) missing autocomplete`,
        'Add autocomplete="email" / autocomplete="current-password" for assistive technology and password managers', 'forms');
    }
  },

  // ─── Color Contrast ───

  checkColorContrast(contrast, results) {
    const issues = contrast.issues || [];
    const sampled = contrast.totalSampled || 0;

    if (sampled > 0) {
      this.addCheck(results, 'Color Contrast (WCAG AA)', issues.length === 0, 3,
        issues.length === 0
          ? `${sampled} elements sampled, all pass WCAG AA`
          : `${issues.length} contrast issue(s) found: ${issues.slice(0, 3).map((i) => `"${i.text}" (${i.ratio}:1, needs ${i.required}:1)`).join('; ')}`,
        'Ensure text has at least 4.5:1 contrast ratio (3:1 for large text) against its background', 'contrast');
    }
  },

  // ─── Focus & Keyboard ───

  checkTabindex(a11y, results) {
    const count = a11y.positiveTabindex || 0;
    if (count > 0) {
      this.addCheck(results, 'No Positive Tabindex', false, 2,
        `${count} element(s) with tabindex > 0`,
        'Avoid positive tabindex values — they override natural DOM order and confuse keyboard navigation', 'focus');
    }
  },

  checkFocusOutline(a11y, results) {
    this.addCheck(results, 'Focus Indicators', !a11y.focusOutlineRemoved, 2,
      a11y.focusOutlineRemoved
        ? `Focus outline removed: ${(a11y.focusOutlineSelectors || []).join(', ')}`
        : 'No outline:none on :focus detected',
      'Never remove :focus outlines without providing an alternative — use :focus-visible instead', 'focus');
  },

  checkAriaHiddenFocusable(a11y, results) {
    const count = a11y.ariaHiddenFocusable || 0;
    if (count > 0) {
      this.addCheck(results, 'No Focusable in aria-hidden', false, 2,
        `${count} aria-hidden container(s) with focusable children`,
        'Focusable elements inside aria-hidden="true" create keyboard traps — remove them or the aria-hidden', 'focus');
    }
  },

  // ─── Tables ───

  checkTables(a11y, results) {
    if (a11y.totalTables > 0) {
      const missing = a11y.tablesWithoutHeaders || 0;
      this.addCheck(results, 'Tables Have Headers', missing === 0, 2,
        missing === 0
          ? `${a11y.totalTables} table(s) with headers`
          : `${missing}/${a11y.totalTables} table(s) without <th> or scope`,
        'Add <th> elements or scope attributes so screen readers can associate data cells with headers', 'structure');
    }
  },

  calculateGrade(score, maxScore) {
    return calculateGradePlusMinus(score, maxScore);
  },
};
