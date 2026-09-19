"use client";

import { useRef, useState } from "react";
import { MonitorPlay } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { SlidingWindowLimiter } from "@/lib/rate-limit";
import { finishStatusToast, startStatusToast } from "@/lib/toast-status";
import { submitEmailAuth } from "../lib/email-password";

const DEMO_EMAIL = process.env.NEXT_PUBLIC_DEMO_EMAIL;
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD;

export function DemoAccess({ next }: { next?: string }) {
  const [pending, setPending] = useState(false);
  const limiter = useRef(new SlidingWindowLimiter({ max: 5, windowMs: 60_000 })).current;

  if (!DEMO_EMAIL || !DEMO_PASSWORD) return null;
  const email = DEMO_EMAIL;
  const password = DEMO_PASSWORD;

  async function signInAsDemo() {
    if (pending) return;
    if (!limiter.trySubmit()) {
      toast.add({
        type: "error",
        title: "Too many attempts",
        description: "Please wait a moment before trying again.",
      });
      return;
    }
    const statusId = startStatusToast("Opening demo");
    setPending(true);
    try {
      const result = await submitEmailAuth(
        "sign-in",
        { email, password },
        window.location.origin,
        next,
      );
      if (result.status === "redirect") {
        finishStatusToast(statusId, {
          status: "success",
          title: "Signed in",
          description: "Welcome to the demo dashboard.",
        });
        window.location.assign(result.destination);
        return;
      }
      finishStatusToast(statusId, {
        status: "error",
        title: "Could not open demo",
        description: result.message,
      });
    } catch {
      finishStatusToast(statusId, {
        status: "error",
        title: "Something went wrong",
        description: "Unable to sign in to the demo. Please try again.",
      });
    }
    setPending(false);
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-default bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-foreground">No account? Preview the demo</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            One-click read-only access to a sample client dashboard.
          </p>
        </div>
        <MonitorPlay className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </div>
      <dl className="flex flex-col gap-1 font-mono text-[11px] text-muted-foreground">
        <div className="flex justify-between gap-2">
          <dt>Email</dt>
          <dd className="truncate text-foreground">{email}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Password</dt>
          <dd className="truncate text-foreground">{password}</dd>
        </div>
      </dl>
      <Button
        type="button"
        size="lg"
        variant="outline"
        className="h-10 w-full"
        onClick={signInAsDemo}
        disabled={pending}
      >
        {pending ? "Opening…" : "Sign in as demo"}
      </Button>
    </div>
  );
}