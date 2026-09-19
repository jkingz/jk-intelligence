import Link from "next/link";
import {
  BarChart3,
  TrendingUp,
  Sparkles,
  RefreshCw,
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
      "Google Search Console, GA4, and SEO platform data merged into one dashboard per client — traffic, conversions, clicks, impressions, CTR, and average position.",
    icon: BarChart3,
    tone: "accent",
  },
  {
    name: "Keyword ranking trends",
    description:
      "Time-series tracking of top 3 / top 10 / top 20 keywords with the biggest movers, so you can see which rankings gained and which slipped — over any date range.",
    icon: TrendingUp,
    tone: "sky",
  },
  {
    name: "AI performance briefs",
    description:
      "A plain-English summary generated for every client: top wins, biggest declines, and recommended focus areas — cached daily to keep costs predictable.",
    icon: Sparkles,
    tone: "lilac",
  },
  {
    name: "Automated daily sync",
    description:
      "A daily job pulls every client's data with per-source retries and partial-failure safety. Dashboards read from cache, so they stay fast even when an API is down.",
    icon: RefreshCw,
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
    title: "Connect your client accounts",
    description:
      "Add each client and store their Google Search Console, GA4, and SEO API credentials. Access is isolated per client at the database level.",
  },
  {
    number: "02",
    title: "Sync runs every day",
    description:
      "At 2 AM the platform pulls fresh metrics for every active client. Failures are retried with backoff, logged, and flagged in the dashboard — never a broken page.",
  },
  {
    number: "03",
    title: "Act on the insights",
    description:
      "Clients and staff sign in to see current numbers, trends, and an AI-generated summary of what changed and where to focus next.",
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
                  Role-based access keeps each client seeing only their own numbers. Data is
                  isolated at the database layer, synced daily, and readable even when a source
                  API is down.
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