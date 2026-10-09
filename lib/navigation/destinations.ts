/**
 * The rail's destination list. Icons are string keys, not components, so this
 * module stays importable from a node-tier unit test; `app-nav.tsx` owns the
 * key -> Lucide mapping.
 */
export const DESTINATION_ICONS = ["dashboard", "connections"] as const;

export type DestinationIcon = (typeof DESTINATION_ICONS)[number];

export interface AppDestination {
  href: string;
  label: string;
  icon: DestinationIcon;
}

export const APP_DESTINATIONS: readonly AppDestination[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/connections", label: "Connections", icon: "connections" },
];

/** The destination whose href claims `pathname`, longest href winning. */
export function activeDestination(pathname: string): string | null {
  let best: string | null = null;
  for (const { href } of APP_DESTINATIONS) {
    const claims = pathname === href || pathname.startsWith(`${href}/`);
    if (claims && (best === null || href.length > best.length)) best = href;
  }
  return best;
}
