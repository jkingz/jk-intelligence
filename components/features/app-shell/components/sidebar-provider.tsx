"use client";

import { useSyncExternalStore } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

const STORAGE_KEY = "app-shell:sidebar-open";
const CHANGE_EVENT = "app-shell:sidebar-open-changed";

/**
 * The primitive persists its state through a cookie it expects the server to read on the
 * next render. Nothing in this shell may read a cookie — that is what keeps `/dashboard`
 * prerendered — so the preference lives in localStorage and is replayed after hydration.
 * A collapsed user therefore sees the expanded rail for one frame on a full page load.
 */
function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

function getSnapshot() {
  return window.localStorage.getItem(STORAGE_KEY) !== "false";
}

/** Matches the prerendered shell, so the store never disagrees with hydration. */
function getServerSnapshot() {
  return true;
}

export function PersistentSidebarProvider({ children }: { children: React.ReactNode }) {
  const open = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function persist(value: boolean) {
    window.localStorage.setItem(STORAGE_KEY, String(value));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return (
    <TooltipProvider>
      <SidebarProvider
        open={open}
        onOpenChange={persist}
        // The primitive's own 16rem is wider than the `w-60` rail ui-context.md
        // documents; 15rem restores it. Its 3rem icon width already matches.
        style={{ "--sidebar-width": "15rem" } as React.CSSProperties}
      >
        {children}
      </SidebarProvider>
    </TooltipProvider>
  );
}
