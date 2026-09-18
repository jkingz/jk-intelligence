"use client";

import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { submitEmailAuth, type EmailAuthMode } from "../lib/email-password";

interface EmailAuthFormProps {
  mode: EmailAuthMode;
  next?: string;
}

const labels: Record<EmailAuthMode, string> = {
  "sign-in": "Sign in",
  "sign-up": "Create account",
  "forgot-password": "Send reset email",
  "reset-password": "Update password",
};

export function EmailAuthForm({ mode, next }: EmailAuthFormProps) {
  const id = useId();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{
    status: "success" | "error";
    message: string;
  } | null>(null);
  const hasEmail = mode !== "reset-password";
  const hasPassword = mode !== "forgot-password";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setFeedback(null);

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
        window.location.assign(result.destination);
        return;
      }
      setFeedback(result);
      if (result.status === "success") form.reset();
      setPending(false);
    } catch {
      setFeedback({
        status: "error",
        message: "Unable to complete your request. Please try again.",
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
        <Button type="submit" size="lg" className="h-10 w-full" disabled={pending}>
          {pending ? "Please wait…" : labels[mode]}
        </Button>
      </fieldset>
      <div role="status" aria-live="polite" aria-atomic="true">
        {pending && <p className="text-xs text-muted-foreground">Processing your request…</p>}
        {feedback?.status === "success" && (
          <p className="rounded-lg border border-default bg-state-success/10 px-3 py-2 text-xs text-state-success">
            {feedback.message}
          </p>
        )}
      </div>
      <div role="alert" aria-atomic="true">
        {feedback?.status === "error" && (
          <p className="rounded-lg border border-default bg-state-warning/10 px-3 py-2 text-xs text-state-warning">
            {feedback.message}
          </p>
        )}
      </div>
    </form>
  );
}
