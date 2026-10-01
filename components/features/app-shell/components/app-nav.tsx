"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Plug, UserRound } from "lucide-react";
import {
  APP_DESTINATIONS,
  activeDestination,
  type DestinationIcon,
} from "@/lib/navigation/destinations";
import { cn } from "@/lib/utils";

const ICONS: Record<DestinationIcon, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  connections: Plug,
  profile: UserRound,
};

export function AppNav() {
  const pathname = usePathname();
  const active = activeDestination(pathname);

  return (
    <>
      {/* lg+: the persistent rail ui-context.md's Layout Patterns already calls for. */}
      <nav
        aria-label="Sections"
        className="hidden lg:flex lg:sticky lg:top-0 lg:h-svh lg:w-60 lg:shrink-0 lg:flex-col border-r border-default bg-surface"
      >
        <div className="flex h-16 items-center gap-2.5 px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-serif text-lg font-bold text-primary-foreground">
            J
          </div>
          <span className="truncate font-serif text-lg font-medium tracking-tight">
            JK Intelligence
          </span>
        </div>
        <ul className="flex flex-col gap-1 px-3">
          {APP_DESTINATIONS.map((destination) => {
            const Icon = ICONS[destination.icon];
            const isSelected = destination.href === active;
            return (
              <li key={destination.href}>
                <Link
                  href={destination.href}
                  aria-current={isSelected ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors motion-reduce:transition-none",
                    isSelected
                      ? "bg-accent-primary-dim text-foreground"
                      : "text-text-muted hover:bg-subtle hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {destination.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Below lg: a horizontal strip. `relative` is load-bearing — this is the
          positioned clipper, so an abspos/sr-only descendant cannot escape it and
          reserve dead horizontal scroll (2026-09-25 dashboard mobile defect). */}
      <nav
        aria-label="Sections"
        className="relative flex items-center gap-1 overflow-x-auto border-b border-default bg-surface px-3 py-2 lg:hidden"
      >
        {APP_DESTINATIONS.map((destination) => {
          const isSelected = destination.href === active;
          return (
            <Link
              key={destination.href}
              href={destination.href}
              aria-current={isSelected ? "page" : undefined}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap",
                isSelected
                  ? "bg-accent-primary-dim text-foreground"
                  : "text-text-muted",
              )}
            >
              {destination.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
