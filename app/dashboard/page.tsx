'use client';

import { useEffect, useState } from 'react';
import { Dashboard, DashboardSkeleton } from '@/components/features/dashboard';
import { AccountMenu } from '@/components/features/user-profile';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

interface DashboardClient {
  id: string;
  name: string;
}

interface DashboardOverview {
  // This should match the actual type from getDashboardOverview
  // For now, we keep it generic.
  [key: string]: any;
}

interface KeywordRankSeries {
  // This should match the actual type from getKeywordRankingHistory
  [key: string]: any;
}

export default function DashboardPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [profile, setProfile] = useState<any>(null);
  const [clients, setClients] = useState<DashboardClient[]>([]);
  const [selectedClient, setSelectedClient] = useState<DashboardClient | null>(null);
  const [overview, setOverview] = useState<any>(null);
  const [history, setHistory] = useState<KeywordRankSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Default values
  const DEFAULT_DAYS = 30;
  const urlClientId = searchParams.get('client') || '';
  const urlDays = parseInt(searchParams.get('days') || String(DEFAULT_DAYS), 10);

  // Fetch profile
  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch('/api/me');
        if (!res.ok) throw new Error('Failed to fetch profile');
        const data = await res.json();
        setProfile(data);
      } catch (err) {
        setError('Failed to load profile');
        console.error(err);
      }
    }
    fetchProfile();
  }, []);

  // Fetch accessible clients (depends on profile)
  useEffect(() => {
    if (!profile) return;
    async function fetchClients() {
      try {
        const res = await fetch('/api/clients');
        if (!res.ok) throw new Error('Failed to fetch clients');
        const data: DashboardClient[] = await res.json();
        setClients(data);
        // Determine selected client
        if (urlClientId) {
          const found = data.find(c => c.id === urlClientId);
          if (found) setSelectedClient(found);
        }
        // Fallback to first client if none selected yet
        if (!selectedClient && data.length > 0) {
          setSelectedClient(data[0]);
        }
      } catch (err) {
        setError('Failed to load clients');
        console.error(err);
      }
    }
    fetchClients();
  }, [profile, urlClientId, selectedClient]);

  // Fetch overview and history (depends on selected client and days)
  useEffect(() => {
    if (!selectedClient) return;
    setLoading(true);
    async function fetchData() {
      try {
        // Fetch overview
        const overviewRes = await fetch(`/api/metrics/${selectedClient.id}/overview?days=${urlDays}`);
        if (!overviewRes.ok) throw new Error('Failed to fetch overview');
        const overviewData = await overviewRes.json();
        setOverview(overviewData);

        // Fetch keyword history (we'll use the same source as before, e.g., gsc)
        const historyRes = await fetch(`/api/metrics/${selectedClient.id}/keywords?source=gsc`);
        if (!historyRes.ok) throw new Error('Failed to fetch keyword history');
        const historyData = await historyRes.json();
        setHistory(historyData.meta ? historyData.data : historyData); // adjust based on actual response shape
      } catch (err) {
        setError('Failed to load dashboard data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [selectedClient, urlDays]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return <div className="p-4 text-red-500">{error}</div>;
  }

  if (!profile) {
    // Not authenticated
    return null; // or redirect
  }

  return (
    <div>
      <Dashboard
        accountMenu={<AccountMenu profile={profile} />}
        clients={clients}
        selectedClient={selectedClient}
        days={urlDays}
        overview={overview}
        history={history}
      />
    </div>
  );
}