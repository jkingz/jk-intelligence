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

  useEffect(() => {
    if (!targetClient) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    async function loadOverview() {
      try {
        const res = await fetch(
          `/api/metrics/${targetClient.id}/overview?days=${targetDays}`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error(`overview ${res.status}`);
        const payload = (await res.json()) as OverviewPayload;
        if (controller.signal.aborted) return;
        setSelection({ client: targetClient, days: targetDays, payload });
        window.history.replaceState(
          {},
          "",
          `/dashboard?client=${targetClient.id}&days=${targetDays}`,
        );
        setError(null);
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