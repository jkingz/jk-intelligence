import { SOURCES, type Source } from "@/types/metrics";

export interface SupportedSource {
  source: Source;
  label: string;
  detail: string;
}

/** Copy per source, keyed by `Source`. The key type is the point: widening
 *  `SOURCES` without writing a row here is a typecheck error, so the derived
 *  list below can never render a source with the wrong label. */
const SUPPORTED_COPY: Record<Source, { label: string; detail: string }> = {
  gsc: {
    label: "Search Console",
    detail: "OAuth grant from the property owner.",
  },
  ga4: {
    label: "Analytics (GA4)",
    detail: "OAuth grant from the property owner.",
  },
  semrush: {
    label: "Semrush",
    detail: "Static API token, pasted by an account owner.",
  },
};

/** The three sources `api_credentials_source_check` permits. Widening this is
 *  a migration plus a `SOURCES` change, never a catalog edit. */
export const SUPPORTED_SOURCES: readonly SupportedSource[] = SOURCES.map(
  (source) => ({ source, ...SUPPORTED_COPY[source] }),
);

export interface UpcomingProvider {
  id: "google-ads" | "meta-ads";
  label: string;
  reason: string;
}

/** Displayed as unavailable. Neither is in the credential enum, and Google and
 *  Meta are OAuth-only, so "paste your key" would be false for both. */
export const UPCOMING_PROVIDERS: readonly UpcomingProvider[] = [
  {
    id: "google-ads",
    label: "Google Ads",
    reason: "Needs an OAuth consent flow and a durable refresh-token grant.",
  },
  {
    id: "meta-ads",
    label: "Meta Ads",
    reason: "Needs an OAuth flow plus Meta app review and business verification.",
  },
];

const linkedDate = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

export function connectionStatusLabel(linkedAt: string | null): string {
  return linkedAt === null
    ? "Not connected"
    : `Linked ${linkedDate.format(new Date(linkedAt))}`;
}
