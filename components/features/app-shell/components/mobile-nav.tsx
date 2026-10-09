"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";

/**
 * Below `md` the rail renders inside a drawer, so this bar carries the only way to open it.
 * It also puts the brand mark back on `/connections` and `/profile`, which show none today.
 */
export function MobileNav() {
  return (
    <div className="sticky top-0 z-40 flex h-12 items-center gap-2.5 border-b border-default bg-surface px-3 md:hidden">
      <SidebarTrigger />
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary font-serif text-lg font-bold text-primary-foreground">
        J
      </div>
      <span className="truncate font-serif text-lg font-medium tracking-tight">
        JK Intelligence
      </span>
    </div>
  );
}
