import Link from "next/link";

const productLinks = [
  { href: "#features-heading", label: "Features" },
  { href: "#how-heading", label: "How it works" },
  { href: "#pipeline-overview", label: "Pipeline" },
];

const legalLinks = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms & Conditions" },
];

export function LandingFooter() {
  return (
    <footer className="border-t border-landing-border">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5">
              <span className="h-4 w-4 rounded bg-landing-accent" aria-hidden="true" />
              <span className="text-sm font-semibold tracking-tight text-landing-text">
                JK Intelligence
              </span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-landing-muted">
              Unified organic performance reporting for agencies — synced daily, with plain-English
              AI briefs per client.
            </p>
          </div>

          <nav aria-label="Product">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-landing-faint">
              Product
            </h2>
            <ul className="mt-3 space-y-2">
              {productLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-landing-muted transition-colors hover:text-landing-text"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Legal">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-landing-faint">
              Company
            </h2>
            <ul className="mt-3 space-y-2">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-landing-muted transition-colors hover:text-landing-text"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-10 border-t border-landing-border pt-6">
          <p className="text-xs text-landing-faint">
            &copy; {new Date().getFullYear()} JK Intelligence. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}