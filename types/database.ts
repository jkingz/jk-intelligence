import type { Client, Source, SyncLogInput } from "@/types/metrics";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Table<Row, Required extends keyof Row> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>;
  Update: Partial<Row>;
  Relationships: [];
};

type SnapshotRow = {
  id: string;
  client_id: string;
  source: Source;
  run_id: string;
  metrics: Json;
  synced_at: string;
  created_at: string;
};

type CurrentRow = {
  client_id: string;
  source: Source;
  snapshot_id: string;
  run_id: string;
  metrics: Json;
  synced_at: string;
  is_stale: boolean;
};

export type Database = {
  public: {
    Tables: {
      clients: Table<Client & { created_at: string }, "name" | "domain">;
      api_credentials: Table<
        {
          id: string;
          client_id: string;
          source: Source;
          credential_reference: string;
          created_at: string;
        },
        "client_id" | "source" | "credential_reference"
      >;
      metrics_snapshots: Table<
        SnapshotRow,
        "client_id" | "source" | "run_id" | "metrics" | "synced_at"
      >;
      keyword_rankings: Table<
        {
          snapshot_id: string;
          metric_index: number;
          client_id: string;
          source: Source;
          keyword: string;
          rank: number;
          synced_at: string;
        },
        "snapshot_id" | "metric_index" | "client_id" | "source" | "keyword" | "rank" | "synced_at"
      >;
      current_metrics: Table<CurrentRow, Exclude<keyof CurrentRow, "is_stale">>;
      sync_logs: Table<
        {
          id: string;
          client_id: string;
          source: Source | null;
          stage: SyncLogInput["stage"];
          status: SyncLogInput["status"];
          message: string;
          job_id: string | null;
          created_at: string;
        },
        "client_id" | "stage" | "status" | "message"
      >;
      users: Table<
        {
          id: string;
          role: "admin" | "client";
          client_id: string | null;
          created_at: string;
        },
        "id"
      >;
    };
    Views: { [_ in never]: never };
    Functions: {
      persist_metrics: {
        Args: {
          p_client_id: string;
          p_source: Source;
          p_metrics: Json;
          p_synced_at: string;
          p_run_id: string;
        };
        Returns: undefined;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
