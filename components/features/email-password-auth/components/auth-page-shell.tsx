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
  if (!chrome) {
    return (
      <main className="flex min-h-svh w-full items-center justify-center bg-background px-4 py-10">
        {children}
      </main>
    );
  }

  return (
    <div className="flex min-h-svh flex-col items-center bg-background">
      <SiteHeader />
      <main className="flex w-full flex-1 items-center justify-center px-4 py-10">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}