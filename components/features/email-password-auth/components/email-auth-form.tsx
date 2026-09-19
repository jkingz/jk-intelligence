"use client";

import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { SlidingWindowLimiter } from "@/lib/rate-limit";
import { finishStatusToast, startStatusToast } from "@/lib/toast-status";
import { submitEmailAuth, type EmailAuthMode } from "../lib/email-password";

interface EmailAuthFormProps {
  mode: EmailAuthMode;
  next?: string;
  switchButton?: ReactNode;
}

const labels: Record<EmailAuthMode, string> = {
  "sign-in": "Sign in",
  "sign-up": "Create account",
  "forgot-password": "Send reset email",
  "reset-password": "Update password",
};

export function EmailAuthForm({ mode, next, switchButton }: EmailAuthFormProps) {
  const id = useId();
  const [pending, setPending] = useState(false);
  const limiter = useRef(new SlidingWindowLimiter({ max: 5, windowMs: 60_000 })).current;
  const hasEmail = mode !== "reset-password";
  const hasPassword = mode !== "forgot-password";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (!limiter.trySubmit()) {
      toast.add({
        type: "error",
        title: "Too many attempts",
        description: "Please wait a moment before trying again.",
      });
      return;
    }
    const form = event.currentTarget;
    const data = new FormData(form);
    const statusId = startStatusToast(labels[mode]);
    setPending(true);

    try {
      const result = await submitEmailAuth(
        mode,
        {
          email: String(data.get("email") ?? ""),
          password: String(data.get("password") ?? ""),
        },
        window.location.origin,
        next,
      );
      if (result.status === "redirect") {
        finishStatusToast(statusId, {
          status: "success",
          title: "Signed in",
          description: "Welcome back.",
        });
        window.location.assign(result.destination);
        return;
      }
      if (result.status === "success") {
        finishStatusToast(statusId, {
          status: "success",
          title: "Success",
          description: result.message,
          timeout: 0,
        });
        form.reset();
      } else {
        finishStatusToast(statusId, {
          status: "error",
          title: "Could not complete",
          description: result.message,
        });
      }
      setPending(false);
    } catch {
      finishStatusToast(statusId, {
        status: "error",
        title: "Something went wrong",
        description: "Unable to complete your request. Please try again.",
      });
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" aria-label={labels[mode]}>
      <fieldset disabled={pending} className="flex min-w-0 flex-col gap-3" aria-busy={pending}>
        {hasEmail && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-email`} className="text-sm font-medium">
              Email
            </label>
            <Input
              id={`${id}-email`}
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </div>
        )}
        {hasPassword && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-password`} className="text-sm font-medium">
              {mode === "reset-password" ? "New password" : "Password"}
            </label>
            <Input
              id={`${id}-password`}
              name="password"
              type="password"
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              minLength={8}
              required
              aria-describedby={`${id}-password-hint`}
            />
            <p id={`${id}-password-hint`} className="text-xs text-muted-foreground">
              Use at least 8 characters.
            </p>
          </div>
        )}
        {switchButton ? (
          <div className="grid grid-cols-2 gap-2">
            <Button type="submit" size="lg" className="h-10 w-full" disabled={pending}>
              <span className="truncate">{pending ? "Please wait…" : labels[mode]}</span>
              <LogIn className="size-4" data-icon="inline-end" aria-hidden="true" />
            </Button>
            {switchButton}
          </div>
        ) : (
          <Button type="submit" size="lg" className="h-10 w-full" disabled={pending}>
            {pending ? "Please wait…" : labels[mode]}
            <LogIn className="size-4" data-icon="inline-end" aria-hidden="true" />
          </Button>
        )}
      </fieldset>
    </form>
  );
}
