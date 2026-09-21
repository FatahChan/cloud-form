/** Canonical marketing site (GitHub Pages). Worker instances should noindex their copy of this landing. */
export const SITE_URL = "https://fatahchan.github.io/cloud-form";
export const SITE_NAME = "Cloud Form";
export const SITE_TITLE = "Cloud Form — Open source Typeform alternative";
export const SITE_DESCRIPTION =
  "Self-hosted conversational forms like Typeform. Build contact forms, surveys, and job applications on Cloudflare Workers. Free and open source — try templates in the browser.";
export const REPO_URL = "https://github.com/FatahChan/cloud-form";

export type Faq = { q: string; a: string };

export const FAQS: Faq[] = [
  {
    q: "Is Cloud Form a Typeform alternative?",
    a: "Yes. Cloud Form is an open source form builder with a Typeform-style one-question-at-a-time player, multi-page flows, and branching. You deploy it on your Cloudflare account instead of paying Typeform per response.",
  },
  {
    q: "Can I use Cloud Form instead of Google Forms?",
    a: "If you want a conversational layout rather than a spreadsheet-like Google Form, yes. Cloud Form is closer to Typeform or Tally: welcome screens, branching, file uploads, and a branded player. Answers are stored in your Cloudflare D1 database, not a Google Sheet.",
  },
  {
    q: "Is Cloud Form free?",
    a: "The software is free and open source. You host it yourself on Cloudflare; the free Workers, D1, and R2 tiers are enough to try it. There is no Cloud Form subscription.",
  },
  {
    q: "What kinds of forms can I build?",
    a: "Contact forms, job applications, NPS surveys, event registration, newsletter signups, support tickets, and appointment requests. Each has a starter template you can try on this page.",
  },
  {
    q: "Where are responses and file uploads stored?",
    a: "On your Worker. Fields go to D1 (SQLite). Uploads go to your R2 bucket. Nothing is sent to a Cloud Form cloud — there isn't one.",
  },
  {
    q: "Do I need to know how to code?",
    a: "You need GitHub and Cloudflare accounts for one-click deploy. After that, the visual builder is point-and-click. No Typeform or Google account required.",
  },
];

export function exampleTitle(name: string): string {
  return `${name} template — Typeform-style form | Cloud Form`;
}

export function exampleDescription(name: string, description: string): string {
  return `${description} Preview this ${name} form in the browser. A free, open source Typeform alternative — answers stay in this tab.`;
}

export function examplePath(id: string): string {
  return `${SITE_URL}/examples/${id}`;
}

export const HEAD_MARK_START = "<!--app-head-start-->";
export const HEAD_MARK_END = "<!--app-head-end-->";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

function jsonLdScript(data: unknown): string {
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

function softwareApplicationLd() {
  return {
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    isAccessibleForFree: true,
    license: REPO_URL,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    featureList: [
      "Typeform-style conversational forms",
      "Branching multi-page flows",
      "Contact, survey, and job application templates",
      "Self-hosted on Cloudflare Workers",
      "File uploads to R2",
    ],
  };
}

export function homepageJsonLd(): unknown {
  return {
    "@context": "https://schema.org",
    "@graph": [
      softwareApplicationLd(),
      {
        "@type": "WebSite",
        name: SITE_NAME,
        url: SITE_URL,
        description: SITE_DESCRIPTION,
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQS.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      },
    ],
  };
}

export function exampleJsonLd(opts: { id: string; name: string; description: string }): unknown {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: exampleTitle(opts.name),
    description: exampleDescription(opts.name, opts.description),
    url: examplePath(opts.id),
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
  };
}

export function metaTags(opts: { title: string; description: string; url: string; jsonLd: unknown }): string {
  const t = esc(opts.title);
  const d = esc(opts.description);
  const url = esc(opts.url);
  return [
    `<title>${t}</title>`,
    `<meta name="description" content="${d}" />`,
    `<meta name="robots" content="index, follow" />`,
    `<link rel="canonical" href="${url}" />`,
    `<link rel="icon" href="${SITE_URL}/favicon.svg" type="image/svg+xml" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${esc(SITE_NAME)}" />`,
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta name="twitter:card" content="summary" />`,
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
    jsonLdScript(opts.jsonLd),
  ].join("\n    ");
}

export function homepageHead(): string {
  return metaTags({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: `${SITE_URL}/`,
    jsonLd: homepageJsonLd(),
  });
}

export function exampleHead(opts: { id: string; name: string; description: string }): string {
  return metaTags({
    title: exampleTitle(opts.name),
    description: exampleDescription(opts.name, opts.description),
    url: examplePath(opts.id),
    jsonLd: exampleJsonLd(opts),
  });
}

export function markedHead(inner: string): string {
  return `${HEAD_MARK_START}\n    ${inner}\n    ${HEAD_MARK_END}`;
}

export function replaceMarkedHead(html: string, inner: string): string {
  const re = /<!--app-head-start-->[\s\S]*?<!--app-head-end-->/;
  if (!re.test(html)) throw new Error("index.html missing app-head markers");
  return html.replace(re, markedHead(inner));
}

export function sitemapXml(exampleIds: string[]): string {
  const urls = [`${SITE_URL}/`, ...exampleIds.map((id) => examplePath(id))];
  const body = urls
    .map(
      (loc, i) => `  <url>
    <loc>${esc(loc)}</loc>
    <changefreq>weekly</changefreq>
    <priority>${i === 0 ? "1.0" : "0.8"}</priority>
  </url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

export function robotsTxt(): string {
  return `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;
}
