"use client";

import React from "react";
import {
  Building2,
  RefreshCw,
  Sun,
  Moon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
} from "@/components/ui/select";
import { Client, Overview, clients } from "./dashboard-data";
import { cn } from "@/lib/utils";

interface DashboardHeaderProps {
  selectedClient: Client;
  overview: Overview;
  onSelectClient: (client: Client) => void;
  syncing: boolean;
  onSync: () => void;
  mounted: boolean;
  theme: string | undefined;
  onToggleTheme: () => void;
}

export function DashboardHeader({
  selectedClient,
  overview,
  onSelectClient,
  syncing,
  onSync,
  mounted,
  theme,
  onToggleTheme,
}: DashboardHeaderProps) {
  return (
    <header className="border-b border-default bg-surface sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-6 min-w-0">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-serif text-lg font-bold">
              A
            </div>
            <span className="font-serif text-base sm:text-lg tracking-tight font-medium text-foreground truncate">
              JK Intelligence
            </span>
          </div>

          <div className="hidden sm:block h-4 w-px bg-border-subtle shrink-0" />

          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="w-3.5 h-3.5 text-text-muted shrink-0 hidden sm:inline-block" />
            <Select
              value={selectedClient.id}
              onValueChange={(value) => {
                if (value) {
                  const found = clients.find((c) => c.id === value);
                  if (found) onSelectClient(found);
                }
              }}
            >
              <SelectTrigger aria-label="Select reporting client" className="w-36 sm:w-56 text-xs h-8">
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className={cn("hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", overview.staleSource ? "bg-state-warning/10 text-state-warning" : "bg-secondary text-primary")}>
            <span className={cn("h-1.5 w-1.5 rounded-full animate-pulse", overview.staleSource ? "bg-state-warning" : "bg-primary")} />
            <span>{overview.syncStatus}</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onSync}
            disabled={syncing}
            className="text-xs"
          >
            <RefreshCw className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{syncing ? "Refreshing..." : "Trigger Sync"}</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleTheme}
            className="h-8 w-8"
            aria-label="Toggle theme"
          >
            {mounted ? (
              theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />
            ) : (
              <span className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
