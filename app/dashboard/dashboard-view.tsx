"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Dashboard, DashboardSkeleton } from "@/components/features/dashboard";
import { ExportMenu } from "@/components/features/data-export";
import { AccountMenu } from "@/components/features/user-profile/components/account-menu";
import type { ProfileView } from "@/components/features/user-profile/lib/profile";
import {
  DASHBOARD_RANGES,
  isDashboardRange,
  type DashboardClient,
  type DashboardOverview,
  type DashboardRange,
  type KeywordRankSeries,
} from "@/types/dashboard";

const DEFAULT_DAYS: DashboardRange = DASHBOARD_RANGES[0];
const CACHE_TTL_MS = 5 * 60_000;
const REFRESH_INTERVAL_MS = 60_000;

interface OverviewPayload {
  overview: DashboardOverview | null;
  history: KeywordRankSeries[];
}

interface CachedPayload {
  payload: OverviewPayload;
  fetchedAt: number;
}

interface Selection {
  client: DashboardClient;
  days: DashboardRange;
  payload: OverviewPayload;
}

interface BootResponse {
  profile: ProfileView;
  clients: DashboardClient[];
  selection: {
    clientId: string;
    days: DashboardRange;
    payload: OverviewPayload;
  } | null;
}

const cacheKey = (clientId: string, days: DashboardRange) => `${clientId}:${days}`;

/** Forward a deep link's client/range to the boot request so it loads that selection. */
function bootQuery(): string {
  const params = new URLSearchParams(window.location.search);
  const query = new URLSearchParams();
  for (const key of ["client", "days"] as const) {
    const value = params.get(key);
    if (value) query.set(key, value);
  }
  const search = query.toString();
  return search ? `?${search}` : "";
}

export function DashboardView() {
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [clients, setClients] = useState<DashboardClient[]>([]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const payloadsRef = useRef(new Map<string, CachedPayload>());
  const inflightRef = useRef(new Map<string, Promise<OverviewPayload>>());
  const prefetchedClientsRef = useRef(new Set<string>());
  const currentRef = useRef<{ clientId: string; days: DashboardRange } | null>(null);

  const getPayload = useCallback(
    async (clientId: string, days: DashboardRange, signal?: AbortSignal) => {
      const key = cacheKey(clientId, days);
      const cached = payloadsRef.current.get(key);
      if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.payload;
      const pending = inflightRef.current.get(key);
      if (pending) return pending;
      const request = (async () => {
        try {
          const res = await fetch(`/api/metrics/${clientId}/overview?days=${days}`, { signal });
          if (!res.ok) throw new Error(`overview ${res.status}`);
          const payload = (await res.json()) as OverviewPayload;
          payloadsRef.current.set(key, { payload, fetchedAt: Date.now() });
          return payload;
        } finally {
          inflightRef.current.delete(key);
        }
      })();
      inflightRef.current.set(key, request);
      return request;
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const res = await fetch(`/api/dashboard/boot${bootQuery()}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`boot ${res.status}`);
        const boot = (await res.json()) as BootResponse;
        if (controller.signal.aborted) return;
        if (boot.selection) {
          // Prime the range cache so the selection effect renders without another fetch.
          payloadsRef.current.set(
            cacheKey(boot.selection.clientId, boot.selection.days),
            { payload: boot.selection.payload, fetchedAt: Date.now() },
          );
        }
        setProfile(boot.profile);
        setClients(boot.clients);
        setError(boot.selection ? null : "No client data available for this account");
      } catch {
        if (controller.signal.aborted) return;
        setError("Failed to load dashboard data");
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  const rawDays = Number(searchParams.get("days") ?? DEFAULT_DAYS);
  const targetDays: DashboardRange = isDashboardRange(rawDays) ? rawDays : DEFAULT_DAYS;
  const rawClientId = searchParams.get("client") ?? "";
  const targetClient = clients.find((client) => client.id === rawClientId) ?? clients[0] ?? null;

  useEffect(() => {
    if (!targetClient) return;

    const prefetchClientRanges = (clientId: string, currentDays: DashboardRange) => {
      if (prefetchedClientsRef.current.has(clientId)) return;
      prefetchedClientsRef.current.add(clientId);
      void Promise.allSettled(
        DASHBOARD_RANGES.filter((range) => range !== currentDays).map((range) =>
          getPayload(clientId, range),
        ),
      );
    };

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const clientId = targetClient.id;
    currentRef.current = { clientId, days: targetDays };
    const cached = payloadsRef.current.get(cacheKey(clientId, targetDays));
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      setSelection({ client: targetClient, days: targetDays, payload: cached.payload });
      window.history.replaceState({}, "", `/dashboard?client=${clientId}&days=${targetDays}`);
      setError(null);
      // The boot payload lands here, so this — not `loadOverview` — is the path
      // that first sees a client; prefetching it keeps range switches instant.
      prefetchClientRanges(clientId, targetDays);
      return;
    }

    async function loadOverview() {
      try {
        const payload = await getPayload(clientId, targetDays, controller.signal);
        if (controller.signal.aborted) return;
        setSelection({ client: targetClient, days: targetDays, payload });
        window.history.replaceState({}, "", `/dashboard?client=${clientId}&days=${targetDays}`);
        setError(null);
        prefetchClientRanges(clientId, targetDays);
      } catch {
        if (controller.signal.aborted) return;
        setError("Failed to load dashboard data");
      }
    }

    void loadOverview();
    return () => controller.abort();
  }, [targetClient?.id, targetDays, targetClient, getPayload]);

  useEffect(() => {
    for (const [key, entry] of payloadsRef.current) {
      if (Date.now() - entry.fetchedAt >= CACHE_TTL_MS) payloadsRef.current.delete(key);
    }
  }, [selection]);

  useEffect(() => {
    const refreshCurrent = async () => {
      const current = currentRef.current;
      if (!current) return;
      const cached = payloadsRef.current.get(cacheKey(current.clientId, current.days));
      if (!cached || Date.now() - cached.fetchedAt < CACHE_TTL_MS) return;
      const payload = await getPayload(current.clientId, current.days);
      const stillCurrent =
        currentRef.current?.clientId === current.clientId &&
        currentRef.current?.days === current.days;
      if (stillCurrent) {
        setSelection((prev) => (prev ? { ...prev, payload } : prev));
      }
    };

    const scheduleRefresh = () => {
      if (document.visibilityState === "visible") void refreshCurrent().catch(() => {});
    };

    document.addEventListener("visibilitychange", scheduleRefresh);
    window.addEventListener("focus", scheduleRefresh);
    const interval = setInterval(() => scheduleRefresh(), REFRESH_INTERVAL_MS);
    return () => {
      document.removeEventListener("visibilitychange", scheduleRefresh);
      window.removeEventListener("focus", scheduleRefresh);
      clearInterval(interval);
    };
  }, [getPayload]);

  if (!profile || !selection) {
    // Keep the static shell's skeleton on screen while boot data is in flight —
    // rendering nothing here replaced it with a blank page for the whole fetch.
    return error ? (
      <div className="p-4 text-error">{error}</div>
    ) : (
      <DashboardSkeleton />
    );
  }

  return (
    <Dashboard
      accountMenu={<AccountMenu profile={profile} />}
      exportMenu={<ExportMenu client={selection.client} days={selection.days} />}
      clients={clients}
      selectedClient={selection.client}
      days={selection.days}
      overview={selection.payload.overview}
      history={selection.payload.history}
    />
  );
}