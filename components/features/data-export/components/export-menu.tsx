"use client";

import { useRef, useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";
import { SlidingWindowLimiter } from "@/lib/rate-limit";
import { finishStatusToast, startStatusToast } from "@/lib/toast-status";
import type { ExportKind } from "@/types/exports";
import type { DashboardClient, DashboardRange } from "@/types/dashboard";

const KINDS: Record<ExportKind, { path: string; label: string; description: string }> = {
  metrics: {
    path: "csv",
    label: "Download CSV",
    description: "Raw metrics for the selected range",
  },
  report: {
    path: "pdf",
    label: "Download PDF report",
    description: "Branded summary for the selected range",
  },
};

function fallbackFilename(kind: ExportKind, clientId: string, days: DashboardRange): string {
  return `client-${kind === "report" ? "report" : "metrics"}-${days}d-${clientId.slice(0, 8)}.${
    kind === "report" ? "pdf" : "csv"
  }`;
}

function filenameFrom(header: string | null): string | null {
  const match = /filename="?([^";]+)"?/.exec(header ?? "");
  return match?.[1] ?? null;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function ExportMenu({
  client,
  days,
}: {
  client: DashboardClient;
  days: DashboardRange;
}) {
  const [busyKind, setBusyKind] = useState<ExportKind | null>(null);
  const limiter = useRef(new SlidingWindowLimiter({ max: 6, windowMs: 60_000 })).current;

  async function download(kind: ExportKind) {
    if (busyKind) return;
    if (!limiter.trySubmit()) {
      toast.add({
        type: "error",
        title: "Too many attempts",
        description: "Please wait a moment before exporting again.",
      });
      return;
    }
    setBusyKind(kind);
    const statusId = startStatusToast(KINDS[kind].label, "Building the export…");
    try {
      const response = await fetch(
        `/api/exports/${client.id}/${KINDS[kind].path}?days=${days}`,
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        const reason =
          response.status === 401
            ? "Your session expired — sign in again."
            : body?.error ?? `Export failed (${response.status}).`;
        throw new Error(reason);
      }
      const blob = await response.blob();
      triggerDownload(
        blob,
        filenameFrom(response.headers.get("Content-Disposition")) ??
          fallbackFilename(kind, client.id, days),
      );
      finishStatusToast(statusId, {
        status: "success",
        title: "Export ready",
        description: `${client.name} · Last ${days} days.`,
      });
    } catch (error) {
      finishStatusToast(statusId, {
        status: "error",
        title: "Export failed",
        description: error instanceof Error ? error.message : "Something went wrong.",
      });
    } finally {
      setBusyKind(null);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            aria-label="Export data"
            disabled={busyKind !== null}
            aria-busy={busyKind !== null}
          />
        }
      >
        {busyKind ? (
          <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
        ) : (
          <Download className="w-3 h-3" aria-hidden="true" />
        )}
        <span className="hidden sm:inline">{busyKind ? "Exporting…" : "Export"}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-1.5 py-1.5 text-xs font-normal text-muted-foreground">
            Export {client.name} · last {days} days
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={busyKind !== null}
            onClick={() => void download("metrics")}
            closeOnClick={false}
          >
            <FileSpreadsheet aria-hidden="true" />
            {KINDS.metrics.label}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={busyKind !== null}
            onClick={() => void download("report")}
            closeOnClick={false}
          >
            <FileText aria-hidden="true" />
            {KINDS.report.label}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
