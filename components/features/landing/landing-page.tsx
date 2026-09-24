import Link from "next/link";
import {
  BarChart3,
  TrendingUp,
  FileDown,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import { Reveal } from "@/components/features/landing/reveal";
import { StaggerReveal } from "@/components/features/landing/stagger-reveal";
import { LandingFooter } from "@/components/features/landing/landing-footer";
import { LandingHero } from "@/components/features/landing/landing-hero";
import { SiteHeader } from "@/components/features/landing/site-header";

const features = [
  {
    name: "Unified organic metrics",
    description:
      "Search Console, GA4 and Semrush share one normalized metric shape behind a single client switcher — traffic, clicks, impressions, CTR and average position for one client, in one place.",
    icon: BarChart3,
    tone: "accent",
  },
  {
    name: "Keyword ranking trends",
    description:
      "Time-series rank history for tracked keywords with the biggest movers, so you can see which rankings gained and which slipped over 7, 30 or 90 days.",
    icon: TrendingUp,
    tone: "sky",
  },
  {
    name: "CSV and PDF exports",
    description:
      "The same numbers behind the dashboard, on demand. CSV is spreadsheet-safe (UTF-8 BOM, formula-injection guarded); the PDF embeds a Unicode font so non-Latin client names and keywords survive.",
    icon: FileDown,
    tone: "lilac",
  },
  {
    name: "Isolation enforced in the database",
    description:
      "Three roles, one tenant gate, and row-level security in Postgres deciding visibility — covered by integration tests that run against a live database, not a mock.",
    icon: ShieldCheck,
    tone: "blue",
  },
];

const tintChips: Record<string, string> = {
  accent: "bg-landing-accent/10 text-landing-accent",
  sky: "bg-landing-sky/10 text-landing-sky",
  lilac: "bg-landing-lilac/10 text-landing-lilac",
  blue: "bg-landing-blue/10 text-landing-blue",
};

const steps = [
  {
    number: "01",
    title: "Every client is its own tenant",
    description:
      "A client is a row with its own source set and role assignments. The app never asks 'is this account mine?' in application code — Postgres answers that.",
  },
  {
    number: "02",
    title: "A daily sweep, per client",
    description:
      "A 2 AM cron enqueues one sync job for every active client, and a completed run revalidates the dashboard cache. Fetching live from the source APIs is the piece being built next.",
  },
  {
    number: "03",
    title: "Read it, then hand it over",
    description:
      "Clients and staff sign in to current numbers and rank history, then export the same figures as CSV or PDF — built from the same code path, so the report can't disagree with the screen.",
  },
];

export function LandingPage() {
  return (
    <div className="min-h-full bg-landing-bg text-landing-text">
      <SiteHeader tone="landing" />

      <main>
        <LandingHero />

        <section
          className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6"
          aria-labelledby="features-heading"
        >
          <Reveal>
            <h2 id="features-heading" className="text-2xl font-semibold tracking-tight">
              What it does
            </h2>
          </Reveal>
          <Reveal delay={80} className="mt-8">
            <StaggerReveal stagger={70} className="grid gap-3 sm:grid-cols-2">
              {features.map((feature) => (
                <div
                  key={feature.name}
                  className="rounded-2xl border border-landing-border bg-landing-surface p-5 transition-colors duration-200 ease-out hover:border-landing-border/60 hover:bg-landing-surface-2"
                >
                  <span
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${tintChips[feature.tone]}`}
                  >
                    <feature.icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-sm font-semibold">{feature.name}</h3>
                  <p className="mt-2 text-sm text-landing-muted">{feature.description}</p>
                </div>
              ))}
            </StaggerReveal>
          </Reveal>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6" aria-labelledby="how-heading">
          <Reveal>
            <h2 id="how-heading" className="text-2xl font-semibold tracking-tight">
              How it works
            </h2>
          </Reveal>
          <Reveal delay={80} className="mt-8">
            <StaggerReveal stagger={80} className="grid gap-3 sm:grid-cols-3">
              {steps.map((step) => (
                <div
                  key={step.number}
                  className="rounded-2xl border border-landing-border bg-landing-surface p-5 transition-colors duration-200 ease-out hover:border-landing-border/60 hover:bg-landing-surface-2"
                >
                  <span className="font-mono text-xs text-landing-accent">{step.number}</span>
                  <h3 className="mt-3 text-sm font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm text-landing-muted">{step.description}</p>
                </div>
              ))}
            </StaggerReveal>
          </Reveal>
        </section>

        <Reveal>
          <section
            className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6"
            aria-labelledby="trust-heading"
          >
            <div className="rounded-2xl border border-landing-border bg-landing-surface p-8 sm:p-12">
              <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
                <ShieldCheck className="size-8 text-landing-sky" aria-hidden="true" />
                <h2 id="trust-heading" className="mt-4 text-2xl font-semibold tracking-tight">
                  Built for agencies that report
                </h2>
                <p className="mt-4 text-sm text-landing-muted">
                  Role-based access keeps each client seeing only their own numbers, enforced by
                  row-level security in Postgres. Dashboards read from a cache rather than a vendor
                  API, so page speed never depends on someone else&apos;s uptime.
                </p>
                <Link
                  href="/auth/sign-up"
                  className="mt-8 inline-flex items-center gap-2 rounded-full bg-landing-accent px-6 py-3 text-sm font-medium text-white transition-all duration-150 ease-out hover:bg-landing-sky hover:text-landing-bg active:scale-[0.97]"
                >
                  Get started free
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </section>
        </Reveal>
      </main>

      <LandingFooter />
    </div>
  );
}