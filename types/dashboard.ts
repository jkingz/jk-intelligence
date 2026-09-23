import type { Source } from "@/types/metrics";

export const DASHBOARD_RANGES = [7, 30, 90] as const;

export type DashboardRange = (typeof DASHBOARD_RANGES)[number];

export function isDashboardRange(value: unknown): value is DashboardRange {
  return DASHBOARD_RANGES.includes(value as DashboardRange);
}

export const DASHBOARD_TABS = ["overview", "queries", "ai_visibility"] as const;

export type DashboardTab = (typeof DASHBOARD_TABS)[number];

export const DEFAULT_DASHBOARD_TAB: DashboardTab = DASHBOARD_TABS[0];

export function isDashboardTab(value: unknown): value is DashboardTab {
  return DASHBOARD_TABS.includes(value as DashboardTab);
}

export interface DashboardClient {
  id: string;
  name: string;
  domain: string;
  initials: string;
}

export interface TrafficPoint {
  date: string;
  clicks: number;
  previous: number;
  impressions: number;
  conversions: number;
  aiReferrals: number;
  previousAiReferrals: number;
  previousImpressions: number;
}

export interface KeywordRow {
  keyword: string;
  rank: number;
  change: number | null;
  volume: number | null;
  clicks: number;
}

export interface RankPoint {
  date: string;
  rank: number;
}

export interface KeywordRankSeries {
  keyword: string;
  currentRank: number;
  points: RankPoint[];
}

export interface AICitation {
  engine: string;
  count: number;
  citationShare: string;
  topSourceUrl: string;
  sentiment: string;
}

export interface BriefItem {
  title: string;
  impact: string;
  description: string;
}

export interface DashboardOverview {
  client: DashboardClient;
  days: DashboardRange;
  source: Source;
  clicks: number;
  previous: number;
  impressions: number;
  previousImpressions: number;
  conversions: number;
  ctr: number;
  growth: number;
  impressionsGrowth: number;
  averagePosition: number;
  positionChange: number;
  topThreeCount: number;
  gainedTopThree: number;
  aiReferrals: number;
  previousAiReferrals: number;
  aiGrowth: number | null;
  aiCitations: AICitation[];
  brief: BriefItem[];
  traffic: TrafficPoint[];
  keywords: KeywordRow[];
  lastUpdated: string;
  dateRange: string;
  staleSource: boolean;
  syncStatus: string;
  freshness: string;
}
