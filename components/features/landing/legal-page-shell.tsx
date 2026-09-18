import Link from "next/link";
import { LandingFooter } from "@/components/features/landing/landing-footer";
import { SiteHeader } from "@/components/features/landing/site-header";

interface LegalPageProps {
  title: string;
  updated: string;
  children: React.ReactNode;
}

export function LegalPageShell({ title, updated, children }: LegalPageProps) {
  return (
    <div className="min-h-full bg-landing-bg text-landing-text">
      <SiteHeader tone="landing" />
      <main className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
        <Link
          href="/"
          className="text-sm text-landing-muted transition-colors hover:text-landing-text"
        >
          &larr; Back to home
        </Link>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-xs text-landing-faint">Last updated: {updated}</p>
        <div className="mt-8 space-y-6 text-sm leading-relaxed text-landing-muted">
          {children}
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}