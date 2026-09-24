import type { ReactNode } from "react";
import { SiteFooter } from "@/components/features/landing/site-footer";
import { SiteHeader } from "@/components/features/landing/site-header";

export function AuthPageShell({
  children,
  chrome = true,
}: {
  children: ReactNode;
  chrome?: boolean;
}) {
  // No theme toggle exists on any auth route, so the subtree pins the dark tokens
  // (see the `[data-theme="dark"]` block in globals.css) whatever <html> resolves to.
  // `text-foreground` is re-declared here because `color` inherits as a resolved
  // value: body's light text would otherwise leak into unstyled descendants.
  if (!chrome) {
    return (
      <main
        data-theme="dark"
        className="flex min-h-svh w-full items-center justify-center bg-background px-4 py-10 text-foreground"
      >
        {children}
      </main>
    );
  }

  return (
    <div
      data-theme="dark"
      className="flex min-h-svh flex-col items-center bg-background text-foreground"
    >
      <SiteHeader />
      <main className="flex w-full flex-1 items-center justify-center px-4 py-10">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}