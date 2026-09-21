import { Link } from "@tanstack/react-router";
import { PageMeta } from "@/components/page-meta";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FORM_TEMPLATES } from "~/shared/form-templates";
import { FAQS, REPO_URL, SITE_DESCRIPTION, SITE_TITLE } from "~/shared/seo";

const DEPLOY = "https://deploy.workers.cloudflare.com/?url=https://github.com/FatahChan/cloud-form";

export function LandingPage({ showAdmin = false }: { showAdmin?: boolean }) {
  return (
    <div className="min-h-svh bg-background">
      {!showAdmin && <PageMeta title={SITE_TITLE} description={SITE_DESCRIPTION} />}
      <SiteHeader showAdmin={showAdmin} />
      <main>
        <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <p className="text-sm text-muted-foreground">Open source Typeform alternative · Cloudflare Workers</p>
          <h1 className="mt-3 max-w-3xl font-heading text-4xl font-medium tracking-tight sm:text-5xl">
            Forms that feel like Typeform, deploy like a single Worker.
          </h1>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            A free, self-hosted form builder for contact forms, surveys, job applications, and quizzes. Branching
            multi-page flows, starter templates, searchable inbox, and file uploads — one Worker, your D1 and R2. Try
            the templates below in this browser; nothing is saved.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button size="lg" asChild>
              <a href="#examples">Try examples</a>
            </Button>
            <a href={DEPLOY} title="Deploy to Cloudflare">
              <img
                src="https://deploy.workers.cloudflare.com/button"
                alt="Deploy to Cloudflare"
                width={166}
                height={36}
              />
            </a>
            <Button variant="outline" size="lg" asChild>
              <a href={`${REPO_URL}#run`}>Manual install</a>
            </Button>
          </div>
        </section>

        <section id="examples" className="border-y bg-muted/30">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="font-heading text-2xl font-medium tracking-tight">Try a form template</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Contact forms, surveys, job applications, event RSVPs, and more — the same kinds of forms people build in
              Typeform or Google Forms. Each example uses the live player. Answers stay in this tab.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FORM_TEMPLATES.map((template) => (
                <Card key={template.id} className="h-full">
                  <CardHeader>
                    <CardTitle>{template.name}</CardTitle>
                    <CardDescription>{template.description}</CardDescription>
                  </CardHeader>
                  <CardFooter className="mt-auto">
                    <Button asChild>
                      <Link to="/examples/$slug" params={{ slug: template.id }}>
                        Open form
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="font-heading text-2xl font-medium tracking-tight">Key features</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Design, publish, and operate forms — from first template to growing submission volume.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Feature title="Typeform-style flows">
              Welcome and thank-you screens, multiple questions per step, and branching so later pages skip or change based
              on answers.
            </Feature>
            <Feature title="Starter templates">
              Contact, job application, NPS, events, and more. Preview the full flow, then create a draft in one click.
            </Feature>
            <Feature title="Visual builder">
              Drag-and-drop questions, then switch to the Flow map to draw branches — if Gender is Female, ask if they are
              married.
            </Feature>
            <Feature title="Inbox & attachments">
              Searchable submission tables with cursor pagination. File uploads land in R2 and download from the admin
              inbox.
            </Feature>
          </div>
        </section>

        <section id="compare" className="border-t">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="font-heading text-2xl font-medium tracking-tight">Typeform, Google Forms, or Cloud Form</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Cloud Form is for teams who want conversational forms without Typeform pricing, Google Forms' spreadsheet
              look, or storing answers on someone else's servers.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <article className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
                <h3 className="font-heading text-base font-medium">Typeform</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Polished hosted product. You pay per response, and data lives in Typeform's cloud.
                </p>
              </article>
              <article className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
                <h3 className="font-heading text-base font-medium">Google Forms</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Free and familiar. Layout is a list of fields, and responses go to Google.
                </p>
              </article>
              <article className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
                <h3 className="font-heading text-base font-medium">Cloud Form</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Typeform-style player you host. Open source, no per-response fee. Answers stay in your D1 and R2.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section id="faq" className="border-t bg-muted/30">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="font-heading text-2xl font-medium tracking-tight">FAQ</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Open source form builder questions — Typeform alternatives, Google Forms, hosting, and pricing.
            </p>
            <div className="mt-8 grid gap-3">
              {FAQS.map((item) => (
                <details key={item.q} className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
                  <summary className="cursor-pointer font-heading text-base font-medium">{item.q}</summary>
                  <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="font-heading text-2xl font-medium tracking-tight">Get started</h2>
            <ol className="mt-6 grid gap-4 sm:grid-cols-2">
              <li className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                <strong className="text-sm">Deploy to Cloudflare</strong>
                <p className="mt-1 text-sm text-muted-foreground">
                  Use the{" "}
                  <a className="underline" href={DEPLOY}>
                    Deploy to Cloudflare
                  </a>{" "}
                  button, or run <code>npm run deploy</code> after <code>wrangler login</code>.
                </p>
              </li>
              <li className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                <strong className="text-sm">Create the owner</strong>
                <p className="mt-1 text-sm text-muted-foreground">
                  Visit <code>/admin/setup</code> on your deployment to register the first account.
                </p>
              </li>
              <li className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                <strong className="text-sm">Pick a template</strong>
                <p className="mt-1 text-sm text-muted-foreground">
                  Open <code>/admin/templates</code>, or start from the examples on this page.
                </p>
              </li>
              <li className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                <strong className="text-sm">Build & publish</strong>
                <p className="mt-1 text-sm text-muted-foreground">
                  Customize in the builder, publish, and share <code>/f/&lt;slug&gt;</code>.
                </p>
              </li>
            </ol>
          </div>
        </section>
      </main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground">
          <span>Cloud Form — open source Typeform alternative. Deploy your own instance on Cloudflare.</span>
          <a className="underline" href={REPO_URL}>
            github.com/FatahChan/cloud-form
          </a>
        </div>
      </footer>
    </div>
  );
}

function Feature({ title, children }: { title: string; children: string }) {
  return (
    <article className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <h3 className="font-heading text-base font-medium">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{children}</p>
    </article>
  );
}
