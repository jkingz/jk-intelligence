"use client";

import React from "react";
import { Bot } from "lucide-react";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { AICitation, DashboardClient } from "@/types/dashboard";

interface AICitationGridProps {
  selectedClient: DashboardClient;
  citations: AICitation[];
}

export function AICitationGrid({ selectedClient, citations }: AICitationGridProps) {
  return (
    <section className="bg-surface rounded-xl border border-default p-4 sm:p-6 space-y-4 sm:space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="font-serif text-lg font-medium">Synthetic & LLM Visibility Breakdown</h3>
          <p className="text-xs text-text-muted">
            Citation distribution for {selectedClient.domain}.
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-text-muted font-medium bg-secondary px-2.5 py-1 rounded-md self-start sm:self-auto">
          <Bot className="size-3.5 shrink-0" />
          <span>No AI source connected</span>
        </div>
      </div>

      {citations.length === 0 ? (
        <p className="py-8 text-center text-xs text-text-muted">
          AI citation data is not available yet. Connect an AI visibility source to populate this view.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {citations.map((cite) => (
          <Card key={cite.engine} className="p-4 space-y-2">
            <CardHeader className="p-0 flex flex-row items-center justify-between">
              <span className="text-xs font-semibold text-text-primary">{cite.engine}</span>
              <span className="text-xs font-mono font-bold text-primary">{cite.citationShare}</span>
            </CardHeader>
            <CardContent className="p-0 space-y-1">
              <p className="text-[11px] text-text-muted">
                Citations: <span className="font-mono font-semibold text-text-primary">{cite.count.toLocaleString("en-US")}</span>
              </p>
              <p className="text-[11px] text-text-muted">Top Cited Resource:</p>
              <p className="text-xs font-mono text-text-primary truncate">{cite.topSourceUrl}</p>
            </CardContent>
            <CardFooter className="p-0 pt-2 border-t border-default flex items-center justify-between text-[11px] text-text-muted bg-transparent">
              <span>Status:</span>
              <span className="font-medium text-foreground">
                {cite.sentiment}
              </span>
            </CardFooter>
          </Card>
        ))}
        </div>
      )}
    </section>
  );
}
