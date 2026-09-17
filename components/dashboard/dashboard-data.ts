import { demoClients, getMockOverview } from "@/lib/mock-dashboard";

export type Client = (typeof demoClients)[number];
export type Overview = ReturnType<typeof getMockOverview>;
export type HistoricalTrendPoint = Overview["traffic"][number];
export type TopQuery = Overview["keywords"][number];

export type AICitation = Overview["aiCitations"][number];

export const clients = demoClients;
