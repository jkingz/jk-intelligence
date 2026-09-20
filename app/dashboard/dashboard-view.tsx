"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Dashboard } from "@/components/features/dashboard";
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

interface OverviewPayload {
  overview: DashboardOverview | null;
  history: KeywordRankSeries[];
}

interface Selection {
  client: DashboardClient;
  days: DashboardRange;
  payload: OverviewPayload;
}

export function DashboardView() {
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [clients, setClients] = useState<DashboardClient[]>([]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const payloadsRef = useRef(new Map<string, OverviewPayload>());
  const inflightRef = useRef(new Map<string, Promise<OverviewPayload>>());
  const prefetchedClientsRef = useRef(new Set<string>());

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const [me, all] = await Promise.allSettled([
        fetch("/api/me", { signal: controller.signal }).then((res) =>
          res.ok ? res.json() : Promise.reject(new Error(`me ${res.status}`)),
        ),
        fetch("/api/clients", { signal: controller.signal }).then((res) =>
          res.ok ? res.json() : Promise.reject(new Error(`clients ${res.status}`)),
        ),
      ]);
      if (controller.signal.aborted) return;
      if (me.status === "fulfilled") setProfile(me.value as ProfileView);
      else setError("Failed to load profile");
      if (all.status === "fulfilled") setClients(all.value as DashboardClient[]);
      else setError("Failed to load clients");
    }
    void load();
    return () => controller.abort();
  }, []);

  const rawDays = Number(searchParams.get("days") ?? DEFAULT_DAYS);
  const targetDays: DashboardRange = isDashboardRange(rawDays) ? rawDays : DEFAULT_DAYS;
  const rawClientId = searchParams.get("client") ?? "";
  const targetClient = clients.find((client) => client.id === rawClientId) ?? clients[0] ?? null;

  const cacheKey = (clientId: string, days: DashboardRange) => `${clientId}:${days}`;

  useEffect(() => {
    if (!targetClient) return;

    const getPayload = async (
      clientId: string,
      days: DashboardRange,
      signal?: AbortSignal,
    ): Promise<OverviewPayload> => {
      const key = cacheKey(clientId, days);
      const cached = payloadsRef.current.get(key);
      if (cached) return cached;
      const pending = inflightRef.current.get(key);
      if (pending) return pending;
      const request = (async () => {
        try {
          const res = await fetch(`/api/metrics/${clientId}/overview?days=${days}`, { signal });
          if (!res.ok) throw new Error(`overview ${res.status}`);
          const payload = (await res.json()) as OverviewPayload;
          payloadsRef.current.set(key, payload);
          return payload;
        } finally {
          inflightRef.current.delete(key);
        }
      })();
      inflightRef.current.set(key, request);
      return request;
    };

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
    const cached = payloadsRef.current.get(cacheKey(clientId, targetDays));
    if (cached) {
      setSelection({ client: targetClient, days: targetDays, payload: cached });
      setError(null);
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
  }, [targetClient?.id, targetDays, targetClient]);

  if (!profile || !selection) {
    return error ? (
      <div className="p-4 text-error">{error}</div>
    ) : null;
  }

  return (
    <Dashboard
      accountMenu={<AccountMenu profile={profile} />}
      clients={clients}
      selectedClient={selection.client}
      days={selection.days}
      overview={selection.payload.overview}
      history={selection.payload.history}
    />
  );
}