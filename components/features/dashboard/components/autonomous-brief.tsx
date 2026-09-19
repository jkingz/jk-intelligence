"use client";

import React from "react";
import { Sparkles, ArrowUpRight } from "lucide-react";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DashboardOverview } from "@/types/dashboard";

interface AutonomousBriefProps {
  overview: DashboardOverview;
}

export function AutonomousBrief({ overview }: AutonomousBriefProps) {
  return (
    <Card className="p-4 sm:p-6 flex flex-col justify-between">
      <div className="flex flex-col gap-4">
        <CardHeader className="p-0 flex flex-row items-center gap-2 text-primary">
          <Sparkles className="size-4" />
          <span className="font-serif text-lg font-medium text-text-primary">Autonomous Brief</span>
        </CardHeader>
        <CardContent className="p-0 flex flex-col gap-3">
          <p className="text-xs text-text-muted leading-relaxed">
            Summary for {overview.client.name} · {overview.days} days. Based on synced keyword rankings.
          </p>
          <div className="flex flex-col gap-3 pt-1">
            {overview.brief.map((item) => (
              <div key={item.title} className="p-3 bg-surface border border-default rounded-md flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-text-primary">{item.title}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary text-primary shrink-0">{item.impact}</span>
                </div>
                <p className="text-xs text-text-muted">{item.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </div>
      <CardFooter className="p-0 pt-4 border-t border-default mt-4 bg-transparent">
        <Button className="w-full text-xs" disabled>
          <span>PDF Export Unavailable</span>
          <ArrowUpRight data-icon="inline-end" />
        </Button>
      </CardFooter>
    </Card>
  );
}
