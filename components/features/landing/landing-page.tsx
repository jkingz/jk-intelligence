import {
  BarChart3,
  TrendingUp,
  Sparkles,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Reveal } from "@/components/features/landing/reveal";
import { SiteHeader } from "@/components/features/landing/site-header";

const features = [
  {
    name: "Unified organic metrics",
    description:
      "Google Search Console, GA4, and SEO platform data merged into one dashboard per client — traffic, conversions, clicks, impressions, CTR, and average position.",
    icon: BarChart3,
  },
  {
    name: "Keyword ranking trends",
    description:
      "Time-series tracking of top 3 / top 10 / top 20 keywords with the biggest movers, so you can see which rankings gained and which slipped — over any date range.",
    icon: TrendingUp,
  },
  {
    name: "AI performance briefs",
    description:
      "A plain-English summary generated for every client: top wins, biggest declines, and recommended focus areas — cached daily to keep costs predictable.",
    icon: Sparkles,
  },
  {
    name: "Automated daily sync",
    description:
      "A daily job pulls every client's data with per-source retries and partial-failure safety. Dashboards read from cache, so they stay fast even when an API is down.",
    icon: RefreshCw,
  },
];

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

const sampleMetrics = [
  { label: "Organic traffic", value: "12,460", delta: "+4.2%", tone: "accent" },
  { label: "Avg. position", value: "14.8", delta: "+1.6", tone: "sky" },
  { label: "Top-3 keywords", value: "24", delta: "+9", tone: "lilac" },
  { label: "CTR", value: "3.7%", delta: "−0.2", tone: "blue" },
] as const;

export function LandingPage() {
  return (
    <div className="min-h-full bg-landing-bg text-landing-text">
      <SiteHeader tone="landing" />

      <main>
        <section className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(173,215,255,0.14),transparent_70%)]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-40 h-80 bg-[radial-gradient(40%_50%_at_20%_0%,rgba(93,228,199,0.1),transparent_70%)]"
          />
          <div className="relative mx-auto w-full max-w-6xl px-4 pb-20 pt-20 sm:px-6 sm:pt-28">
            <Reveal>
              <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
                <span className="motion-safe:animate-landing-fade-in rounded-lg bg-landing-accent/10 px-2.5 py-1 text-xs font-medium text-landing-accent">
                  Multi-client SEO reporting
                </span>
                <h1 className="mt-6 motion-safe:animate-landing-fade-down text-4xl font-semibold tracking-tight sm:text-6xl">
                  Every client&apos;s organic performance, in one dashboard.
                </h1>
                <p className="mt-5 max-w-2xl motion-safe:animate-landing-fade-in text-base text-landing-muted sm:text-lg">
                  JK Intelligence pulls Google Search Console, GA4, and SEO platforms into live
                  dashboards for every client — automated daily, with plain-English AI summaries of
                  what changed.
                </p>
              </div>
            </Reveal>

            <Reveal delay={120} className="mt-16">
              <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {sampleMetrics.map((metric, index) => (
                  <div
                    key={metric.label}
                    className="motion-safe:animate-landing-scale-in rounded-2xl border border-landing-border bg-landing-surface p-5"
                    style={{ animationDelay: `${index * 60}ms` }}
                  >
                    <dt className="text-xs uppercase tracking-wide text-landing-faint">
                      {metric.label}
                    </dt>
                    <dd className="mt-2 flex items-baseline justify-between gap-2">
                      <span className="font-mono text-2xl font-semibold">{metric.value}</span>
                      <span
                        className={
                          metric.tone === "accent"
                            ? "text-sm text-landing-accent"
                            : metric.tone === "sky"
                              ? "text-sm text-landing-sky"
                              : metric.tone === "lilac"
                                ? "text-sm text-landing-lilac"
                                : "text-sm text-landing-blue"
                        }
                      >
                        {metric.delta}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6" aria-labelledby="features-heading">
          <Reveal>
            <h2 id="features-heading" className="text-2xl font-semibold tracking-tight">
              What it does
            </h2>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {features.map((feature) => (
                <div
                  key={feature.name}
                  className="rounded-2xl border border-landing-border bg-landing-surface p-5"
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-landing-accent/10 text-landing-accent">
                    <feature.icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-sm font-semibold">{feature.name}</h3>
                  <p className="mt-2 text-sm text-landing-muted">{feature.description}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6" aria-labelledby="how-heading">
          <Reveal>
            <h2 id="how-heading" className="text-2xl font-semibold tracking-tight">
              How it works
            </h2>
            <ol className="mt-8 grid gap-3 sm:grid-cols-3">
              {steps.map((step) => (
                <li key={step.number} className="rounded-2xl border border-landing-border bg-landing-surface p-5">
                  <span className="font-mono text-xs text-landing-accent">{step.number}</span>
                  <h3 className="mt-3 text-sm font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm text-landing-muted">{step.description}</p>
                </li>
              ))}
            </ol>
          </Reveal>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6" aria-labelledby="trust-heading">
          <Reveal>
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
              </div>
            </div>
          </Reveal>
        </section>
      </main>
    </div>
  );
}