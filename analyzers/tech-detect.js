// Tech Stack Detection Analyzer

const TechDetect = {
  analyze(data) {
    const results = {
      frameworks: [],
      cms: [],
      hosting: [],
      buildTools: [],
      cssFrameworks: [],
      analytics: [],
      libraries: [],
    };

    if (data.headers) this.analyzeHeaders(data.headers, results);
    if (data.domData) {
      this.analyzeDomSignals(data.domData.dom, results);
      this.analyzeScripts(data.domData.scripts, results);
      this.analyzeStyles(data.domData.styles, results);
      this.analyzeMeta(data.domData.meta, results);
    }

    return results;
  },

  analyzeHeaders(headerData, results) {
    const h = headerData.headers || {};

    // Hosting / Server
    const server = h['server'] || '';
    const via = h['via'] || '';
    const powered = h['x-powered-by'] || '';

    if (server.match(/netlify/i)) results.hosting.push({ name: 'Netlify', confidence: 100, icon: '▲' });
    if (server.match(/vercel/i) || h['x-vercel-id']) results.hosting.push({ name: 'Vercel', confidence: 100, icon: '▲' });
    if (h['cf-ray'] || server.match(/cloudflare/i)) results.hosting.push({ name: 'Cloudflare', confidence: 100, icon: '☁' });
    if (server.match(/nginx/i)) results.hosting.push({ name: 'Nginx', confidence: 90, icon: '⚙' });
    if (server.match(/apache/i)) results.hosting.push({ name: 'Apache', confidence: 90, icon: '⚙' });
    if (server.match(/github/i)) results.hosting.push({ name: 'GitHub Pages', confidence: 100, icon: '⚙' });
    if (h['x-amz-cf-id'] || via.match(/cloudfront/i)) results.hosting.push({ name: 'AWS CloudFront', confidence: 95, icon: '☁' });
    if (h['x-azure-ref']) results.hosting.push({ name: 'Azure', confidence: 95, icon: '☁' });
    if (h['x-goog-meta'] || server.match(/gws/i)) results.hosting.push({ name: 'Google Cloud', confidence: 90, icon: '☁' });
    if (h['fly-request-id']) results.hosting.push({ name: 'Fly.io', confidence: 100, icon: '▲' });
    if (h['x-render-origin-server']) results.hosting.push({ name: 'Render', confidence: 100, icon: '▲' });
    if (via.match(/caddy/i) || server.match(/caddy/i)) results.hosting.push({ name: 'Caddy', confidence: 95, icon: '⚙' });
    if (server.match(/openresty/i)) results.hosting.push({ name: 'OpenResty', confidence: 95, icon: '⚙' });
    if (h['x-coolify-id'] || (via.match(/caddy/i) && server.match(/openresty/i))) {
      results.hosting.push({ name: 'Coolify', confidence: 80, icon: '☁' });
    }
    if (h['x-railway-id'] || server.match(/railway/i)) results.hosting.push({ name: 'Railway', confidence: 95, icon: '🚂' });
    if (h['x-powered-by']?.match(/hono/i)) results.frameworks.push({ name: 'Hono', confidence: 95, icon: '🔥', category: 'backend' });

    // Server-side tech
    if (powered.match(/express/i)) results.frameworks.push({ name: 'Express.js', confidence: 95, icon: '🟢', category: 'backend' });
    if (powered.match(/php/i)) results.frameworks.push({ name: 'PHP', confidence: 90, icon: '🐘', category: 'backend' });
    if (powered.match(/asp\.net/i)) results.frameworks.push({ name: 'ASP.NET', confidence: 95, icon: '🔵', category: 'backend' });
    if (powered.match(/next/i)) results.frameworks.push({ name: 'Next.js', confidence: 80, icon: '▲', category: 'fullstack' });
  },

  analyzeDomSignals(dom, results) {
    if (!dom) return;

    // Frontend frameworks
    if (dom.hasReactRoot) results.frameworks.push({ name: 'React', confidence: 90, icon: '⚛', category: 'frontend' });
    if (dom.hasVueApp) results.frameworks.push({ name: 'Vue.js', confidence: 85, icon: '💚', category: 'frontend' });
    if (dom.hasSvelteKit) results.frameworks.push({ name: 'SvelteKit', confidence: 95, icon: '🔶', category: 'frontend' });
    if (dom.hasAngular) results.frameworks.push({ name: 'Angular', confidence: 90, icon: '🔴', category: 'frontend' });
    if (dom.hasAstro) results.frameworks.push({ name: 'Astro', confidence: 95, icon: '🚀', category: 'frontend' });

    // PWA
    if (dom.hasPwaManifest) results.libraries.push({ name: 'PWA Manifest', confidence: 90, icon: '📱' });

    // CMS
    if (dom.hasWordPress) results.cms.push({ name: 'WordPress', confidence: 95, icon: 'W' });
    if (dom.hasShopify) results.cms.push({ name: 'Shopify', confidence: 95, icon: '🛒' });
    if (dom.hasWebflow) results.cms.push({ name: 'Webflow', confidence: 95, icon: '🌊' });
    if (dom.hasSquarespace) results.cms.push({ name: 'Squarespace', confidence: 95, icon: '◼' });
    if (dom.hasWix) results.cms.push({ name: 'Wix', confidence: 95, icon: '✨' });
    if (dom.hasDrupal) results.cms.push({ name: 'Drupal', confidence: 95, icon: '💧' });
    if (dom.hasJoomla) results.cms.push({ name: 'Joomla', confidence: 95, icon: 'J' });
    if (dom.hasGhost) results.cms.push({ name: 'Ghost', confidence: 95, icon: '👻' });
  },

  analyzeScripts(scripts, results) {
    if (!scripts) return;

    for (const s of scripts) {
      const src = (s.src || '').toLowerCase();
      const inline = (s.inlineSnippet || '').toLowerCase();

      // Frameworks from script paths
      if (src.includes('/_next/')) results.frameworks.push({ name: 'Next.js', confidence: 95, icon: '▲', category: 'fullstack' });
      if (src.includes('/_nuxt/')) results.frameworks.push({ name: 'Nuxt', confidence: 95, icon: '💚', category: 'fullstack' });
      if (src.includes('/remix/') || inline.includes('__remixContext')) results.frameworks.push({ name: 'Remix', confidence: 90, icon: '💿', category: 'fullstack' });
      if (src.includes('gatsby')) results.frameworks.push({ name: 'Gatsby', confidence: 90, icon: '💜', category: 'frontend' });
      if (src.includes('/_astro/') || src.includes('.astro_astro_type_script')) {
        results.frameworks.push({ name: 'Astro', confidence: 95, icon: '🚀', category: 'frontend' });
      }

      // Build tools from asset patterns
      if (src.match(/\/assets\/.*-[a-zA-Z0-9]{8}\.(js|mjs)/) && s.type === 'module') {
        results.buildTools.push({ name: 'Vite', confidence: 80, icon: '⚡' });
      }
      if (src.match(/\/_astro\/.*\.[A-Za-z0-9]{8}\.(js|css)/)) {
        results.buildTools.push({ name: 'Vite', confidence: 85, icon: '⚡' });
      }
      if (src.match(/\/static\/js\/.*\.chunk\.js/)) {
        results.buildTools.push({ name: 'Webpack (CRA)', confidence: 75, icon: '📦' });
      }
      if (src.match(/webpack/i)) results.buildTools.push({ name: 'Webpack', confidence: 70, icon: '📦' });

      // Analytics & tracking
      if (src.includes('google-analytics.com') || src.includes('googletagmanager.com') || inline.includes('gtag(')) {
        results.analytics.push({ name: 'Google Analytics', confidence: 95, icon: '📊' });
      }
      if (src.includes('googletagmanager.com/gtm')) results.analytics.push({ name: 'Google Tag Manager', confidence: 95, icon: '🏷' });
      if (src.includes('connect.facebook.net') || inline.includes('fbq(')) results.analytics.push({ name: 'Meta Pixel', confidence: 95, icon: '📘' });
      if (src.includes('hotjar.com') || inline.includes('hotjar')) results.analytics.push({ name: 'Hotjar', confidence: 95, icon: '🔥' });
      if (src.includes('plausible.io')) results.analytics.push({ name: 'Plausible', confidence: 95, icon: '📈' });
      // Umami: self-hosted instances use data-website-id on a /script.js endpoint
      if (src.includes('umami') || s.dataWebsiteId) {
        results.analytics.push({ name: 'Umami', confidence: s.dataWebsiteId ? 95 : 90, icon: '📈' });
      }
      if (src.includes('matomo') || src.includes('piwik')) results.analytics.push({ name: 'Matomo', confidence: 95, icon: '📈' });
      if (src.includes('segment.com') || inline.includes('analytics.identify')) results.analytics.push({ name: 'Segment', confidence: 90, icon: '📊' });
      if (src.includes('mixpanel.com')) results.analytics.push({ name: 'Mixpanel', confidence: 95, icon: '📊' });
      if (src.includes('clarity.ms')) results.analytics.push({ name: 'Microsoft Clarity', confidence: 95, icon: '🔍' });
      if (src.includes('snap.licdn.com') || inline.includes('_linkedin_partner_id')) results.analytics.push({ name: 'LinkedIn Insight', confidence: 95, icon: '💼' });
      if (src.includes('posthog')) results.analytics.push({ name: 'PostHog', confidence: 95, icon: '🦔' });

      // Consent management
      if (src.includes('cookiebot')) results.libraries.push({ name: 'Cookiebot', confidence: 95, icon: '🍪' });
      if (src.includes('onetrust')) results.libraries.push({ name: 'OneTrust', confidence: 95, icon: '🍪' });
      if (src.includes('cookieproof') || (src.includes('/loader.js') && s.dataDomain)) {
        results.libraries.push({ name: 'CookieProof', confidence: 95, icon: '🍪' });
      }
      if (src.includes('cookieconsent')) results.libraries.push({ name: 'CookieConsent', confidence: 90, icon: '🍪' });
      if (src.includes('usercentrics')) results.libraries.push({ name: 'Usercentrics', confidence: 95, icon: '🍪' });

      // Email / Marketing platforms
      if (src.includes('mailchimp') || src.includes('chimpstatic') || inline.includes('mc_validate')) results.libraries.push({ name: 'Mailchimp', confidence: 95, icon: '📧' });
      if (src.includes('hubspot') || src.includes('hs-scripts') || src.includes('hbspt')) results.libraries.push({ name: 'HubSpot', confidence: 95, icon: '📧' });
      if (src.includes('marketo') || src.includes('mktoresp')) results.libraries.push({ name: 'Marketo', confidence: 95, icon: '📧' });
      if (src.includes('activecampaign')) results.libraries.push({ name: 'ActiveCampaign', confidence: 95, icon: '📧' });
      if (src.includes('brevo') || src.includes('sendinblue') || src.includes('sibforms')) results.libraries.push({ name: 'Brevo', confidence: 95, icon: '📧' });
      if (src.includes('klaviyo')) results.libraries.push({ name: 'Klaviyo', confidence: 95, icon: '📧' });
      if (src.includes('convertkit')) results.libraries.push({ name: 'ConvertKit', confidence: 95, icon: '📧' });

      // Booking / scheduling
      if (src.includes('cal.com') || src.includes('/embed/embed.js') || inline.includes('Cal(')) {
        results.libraries.push({ name: 'Cal.com', confidence: 90, icon: '📅' });
      }
      if (src.includes('calendly')) results.libraries.push({ name: 'Calendly', confidence: 95, icon: '📅' });

      // A/B testing
      if (src.includes('optimizely')) results.libraries.push({ name: 'Optimizely', confidence: 95, icon: '🧪' });
      if (src.includes('vwo.com') || inline.includes('_vwo_code')) results.libraries.push({ name: 'VWO', confidence: 95, icon: '🧪' });
      if (src.includes('launchdarkly')) results.libraries.push({ name: 'LaunchDarkly', confidence: 95, icon: '🧪' });

      // Chat widgets
      if (src.includes('intercom')) results.libraries.push({ name: 'Intercom', confidence: 95, icon: '💬' });
      if (src.includes('drift')) results.libraries.push({ name: 'Drift', confidence: 95, icon: '💬' });
      if (src.includes('crisp')) results.libraries.push({ name: 'Crisp', confidence: 95, icon: '💬' });
      if (src.includes('tawk.to')) results.libraries.push({ name: 'Tawk.to', confidence: 95, icon: '💬' });
      if (src.includes('livechat')) results.libraries.push({ name: 'LiveChat', confidence: 90, icon: '💬' });

      // Libraries
      if (src.includes('jquery') || inline.includes('jquery')) results.libraries.push({ name: 'jQuery', confidence: 90, icon: '📜' });
      if (src.includes('lodash')) results.libraries.push({ name: 'Lodash', confidence: 90, icon: '📜' });
      if (src.includes('gsap') || inline.includes('gsap')) results.libraries.push({ name: 'GSAP', confidence: 90, icon: '✨' });
      if (src.includes('three.js') || src.includes('three.min')) results.libraries.push({ name: 'Three.js', confidence: 90, icon: '🎮' });
      if (src.includes('alpine') || inline.includes('x-data')) results.libraries.push({ name: 'Alpine.js', confidence: 85, icon: '🏔' });
      if (src.includes('htmx')) results.libraries.push({ name: 'HTMX', confidence: 95, icon: '🔄' });
      if (src.includes('stimulus')) results.libraries.push({ name: 'Stimulus', confidence: 90, icon: '⚡' });
      if (src.includes('turbo')) results.libraries.push({ name: 'Turbo', confidence: 85, icon: '🚀' });
    }
  },

  analyzeStyles(styles, results) {
    if (!styles) return;

    const classes = styles.sampleClasses || [];
    const classStr = classes.join(' ');
    const links = styles.links || [];

    // Tailwind — look for utility class patterns
    const tailwindPatterns = /\b(flex|grid|p-\d|m-\d|text-(sm|lg|xl|2xl)|bg-(white|black|gray)|rounded|shadow|hover:|md:|lg:)/;
    if (tailwindPatterns.test(classStr)) {
      results.cssFrameworks.push({ name: 'Tailwind CSS', confidence: 85, icon: '🌊' });
    }

    // Bootstrap
    // Bootstrap — require multiple specific classes to avoid false positives with Tailwind
    const bootstrapHits = [
      /\bcol-(sm|md|lg|xl)-\d+\b/.test(classStr),
      /\bbtn btn-(primary|secondary|success|danger|warning|info)\b/.test(classStr),
      /\b(card-body|card-header|card-footer)\b/.test(classStr),
      /\b(navbar-expand|navbar-toggler|navbar-brand)\b/.test(classStr),
      /\bmodal-dialog\b/.test(classStr),
      /\bform-control\b/.test(classStr),
    ].filter(Boolean).length;
    if (bootstrapHits >= 2) {
      results.cssFrameworks.push({ name: 'Bootstrap', confidence: 85, icon: '🅱' });
    }
    for (const l of links) {
      if ((l.href || '').includes('bootstrap')) results.cssFrameworks.push({ name: 'Bootstrap', confidence: 95, icon: '🅱' });
    }

    // Bulma
    if (classStr.match(/\b(is-primary|is-large|columns|column is-)\b/)) {
      results.cssFrameworks.push({ name: 'Bulma', confidence: 80, icon: '🎨' });
    }

    // Material UI
    if (classStr.match(/\bMui[A-Z]|makeStyles|css-[a-z0-9]{6}/)) {
      results.cssFrameworks.push({ name: 'Material UI', confidence: 80, icon: '🎨' });
    }

    // Chakra UI
    if (classStr.match(/\bchakra-/)) {
      results.cssFrameworks.push({ name: 'Chakra UI', confidence: 85, icon: '⚡' });
    }

    // Foundation
    for (const l of links) {
      if ((l.href || '').includes('foundation')) results.cssFrameworks.push({ name: 'Foundation', confidence: 90, icon: '🏗' });
    }
  },

  analyzeMeta(meta, results) {
    if (!meta) return;

    const generator = meta['generator'] || '';
    if (generator.match(/hugo/i)) results.frameworks.push({ name: 'Hugo', confidence: 95, icon: '🏗', category: 'ssg' });
    if (generator.match(/jekyll/i)) results.frameworks.push({ name: 'Jekyll', confidence: 95, icon: '💎', category: 'ssg' });
    if (generator.match(/eleventy/i)) results.frameworks.push({ name: 'Eleventy', confidence: 95, icon: '🎈', category: 'ssg' });
    if (generator.match(/hexo/i)) results.frameworks.push({ name: 'Hexo', confidence: 95, icon: '📝', category: 'ssg' });
    if (generator.match(/astro/i)) results.frameworks.push({ name: 'Astro', confidence: 100, icon: '🚀', category: 'frontend' });
    if (generator.match(/gatsby/i)) results.frameworks.push({ name: 'Gatsby', confidence: 100, icon: '💜', category: 'frontend' });
    if (generator.match(/docusaurus/i)) results.frameworks.push({ name: 'Docusaurus', confidence: 95, icon: '🦖', category: 'ssg' });
  },

  // Deduplicate results
  dedupe(results) {
    for (const key of Object.keys(results)) {
      const seen = new Set();
      results[key] = results[key].filter((item) => {
        if (seen.has(item.name)) return false;
        seen.add(item.name);
        return true;
      });
    }
    return results;
  },
};
