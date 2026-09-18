import Link from "next/link";
import { cn } from "@/lib/utils";

export function SiteFooter({ tone = "default" }: { tone?: "default" | "landing" }) {
  return (
    <footer
      className={cn(
        "border-t",
        tone === "landing" ? "border-landing-border" : "border-default"
      )}
    >
      <div
        className={cn(
          "mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6",
          tone === "landing" ? "text-landing-muted" : "text-muted-foreground"
        )}
      >
        <div className="flex items-center gap-2.5">
          <span
            className={cn("h-4 w-4 rounded", tone === "landing" ? "bg-landing-accent" : "bg-primary")}
            aria-hidden="true"
          />
          <span className="text-xs">JK Intelligence</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/auth/login"
            className={cn(
              "text-xs underline-offset-4 transition-colors",
              tone === "landing" ? "hover:text-landing-text" : "hover:text-foreground"
            )}
          >
            Sign in
          </Link>
          <Link
            href="/auth/sign-up"
            className={cn(
              "text-xs underline-offset-4 transition-colors",
              tone === "landing" ? "hover:text-landing-text" : "hover:text-foreground"
            )}
          >
            Sign up
          </Link>
        </div>
        <p
          className={cn("text-xs", tone === "landing" ? "text-landing-faint" : "text-muted-foreground")}
        >
          &copy; 2026 JK Intelligence
        </p>
      </div>
    </footer>
  );
}