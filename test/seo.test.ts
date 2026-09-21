import { describe, expect, it } from "vitest";
import { FORM_TEMPLATES } from "../src/shared/form-templates";
import {
  FAQS,
  SITE_TITLE,
  SITE_URL,
  exampleHead,
  homepageHead,
  homepageJsonLd,
  replaceMarkedHead,
  robotsTxt,
  sitemapXml,
} from "../src/shared/seo";

describe("seo", () => {
  it("homepage JSON-LD includes SoftwareApplication, WebSite, and every FAQ", () => {
    const ld = homepageJsonLd() as {
      "@graph": Array<{ "@type": string; mainEntity?: Array<{ name: string }> }>;
    };
    const types = ld["@graph"].map((n) => n["@type"]);
    expect(types).toEqual(["SoftwareApplication", "WebSite", "FAQPage"]);
    const faq = ld["@graph"].find((n) => n["@type"] === "FAQPage");
    expect(faq?.mainEntity?.map((q) => q.name)).toEqual(FAQS.map((f) => f.q));
  });

  it("sitemap lists the home page and every template example", () => {
    const xml = sitemapXml(FORM_TEMPLATES.map((t) => t.id));
    expect(xml).toContain(`${SITE_URL}/`);
    for (const t of FORM_TEMPLATES) {
      expect(xml).toContain(`${SITE_URL}/examples/${t.id}`);
    }
  });

  it("head HTML and robots.txt point crawlers at the canonical site", () => {
    const home = homepageHead();
    expect(home).toContain(`<title>${SITE_TITLE}</title>`);
    expect(home).toContain(`rel="canonical"`);
    expect(home).toContain("application/ld+json");
    expect(exampleHead({ id: "contact", name: "Contact us", description: "Name and email." })).toContain(
      "/examples/contact",
    );
    expect(robotsTxt()).toContain(`${SITE_URL}/sitemap.xml`);
    const html = replaceMarkedHead("x<!--app-head-start-->old<!--app-head-end-->y", "NEW");
    expect(html).toContain("NEW");
    expect(html).not.toContain("old");
  });
});
