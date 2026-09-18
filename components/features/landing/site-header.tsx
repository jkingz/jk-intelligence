import Link from "next/link";
import { cn } from "@/lib/utils";

export function SiteHeader({ tone = "default" }: { tone?: "default" | "landing" }) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b backdrop-blur",
        tone === "landing"
          ? "border-landing-border bg-landing-bg/80 text-landing-text"
          : "border-default bg-background/80 text-foreground"
      )}
    >
      <nav
        className={cn(
          "mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6",
          tone === "landing" ? "text-landing-muted" : "text-muted-foreground"
        )}
        aria-label="Main"
      >
        <Link href="/" className="flex items-center gap-2.5">
          <span
            className={cn(
              "h-6 w-6 rounded-lg",
              tone === "landing" ? "bg-landing-accent" : "bg-primary"
            )}
            aria-hidden="true"
          />
          <span
            className={cn(
              "text-sm font-semibold tracking-tight",
              tone === "landing" ? "text-landing-text" : "text-foreground"
            )}
          >
            JK Intelligence
          </span>
        </Link>
        <Link
          href="/auth/login"
          className={cn(
            "text-sm transition-colors",
            tone === "landing" ? "hover:text-landing-text" : "hover:text-foreground"
          )}
        >
          Sign in
        </Link>
      </nav>
    </header>
  );
}