"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/features/landing/reveal";
import { StaggerReveal } from "@/components/features/landing/stagger-reveal";

const sampleMetrics = [
  { label: "Organic traffic", value: "12,460", delta: "+4.2%", tone: "accent" },
  { label: "Avg. position", value: "14.8", delta: "+1.6", tone: "sky" },
  { label: "Top-3 keywords", value: "24", delta: "+9", tone: "lilac" },
  { label: "CTR", value: "3.7%", delta: "−0.2", tone: "blue" },
] as const;

export function LandingHero() {
  return (
    <section id="pipeline-overview" className="relative overflow-hidden" aria-labelledby="hero-heading">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(234,88,12,0.14),transparent_70%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-40 h-80 bg-[radial-gradient(40%_50%_at_20%_0%,rgba(255,158,94,0.1),transparent_70%)]"
      />

      <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-end justify-center">
        <Image
          src="/diagrams/landing-pipeline.svg"
          alt=""
          priority
          width={1080}
          height={520}
          className="h-auto w-full max-w-6xl opacity-[0.18] transition-opacity"
        />
        <div className="absolute inset-0 bg-linear-gradient-to-b from-landing-bg via-landing-bg/50 to-landing-bg" />
      </div>

      <div className="relative mx-auto w-full max-w-6xl px-4 pb-20 pt-20 sm:px-6 sm:pt-28">
        <Reveal>
          <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
            <span className="motion-safe:animate-landing-fade-in rounded-lg bg-landing-accent/10 px-2.5 py-1 text-xs font-medium text-landing-accent">
              Multi-client SEO reporting
            </span>
            <h1
              id="hero-heading"
              className="mt-6 motion-safe:animate-landing-fade-down text-4xl font-semibold tracking-tight sm:text-6xl"
            >
              Every client&apos;s organic performance, in one dashboard.
            </h1>
            <p className="mt-5 max-w-2xl motion-safe:animate-landing-fade-in text-base text-landing-muted sm:text-lg">
              JK Intelligence pulls Google Search Console, GA4, and SEO platforms into live dashboards for
              every client — automated daily, with plain-English AI summaries of what changed.
            </p>

            <div className="mt-8 motion-safe:animate-landing-fade-in flex justify-center">
              <Link
                href="/auth/sign-up"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-landing-accent px-6 py-3 text-sm font-medium text-white transition-all duration-150 ease-out hover:bg-landing-sky hover:text-landing-bg active:scale-[0.97]"
              >
                Get started
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </Reveal>

        <Reveal delay={120} className="mt-16">
          <StaggerReveal stagger={70} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {sampleMetrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-2xl border border-landing-border bg-landing-surface p-5 transition-transform duration-200 ease-out hover:-translate-y-0.5 motion-reduce:transform-none"
              >
                <dt className="text-xs uppercase tracking-wide text-landing-faint">{metric.label}</dt>
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
          </StaggerReveal>
        </Reveal>
      </div>
    </section>
  );
}