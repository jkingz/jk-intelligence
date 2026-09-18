"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateProfileAction } from "../lib/update-profile-action";

export function EditProfileForm({ currentName }: { currentName: string | null }) {
  const id = "profile-name";
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(currentName ?? "");
  const [feedback, setFeedback] = useState<{ status: "success" | "error"; message: string } | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const result = await updateProfileAction({ name });
      setFeedback(
        result.status === "success"
          ? { status: "success", message: "Profile updated." }
          : result,
      );
      if (result.status === "success") setName(result.name);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2" aria-label="Edit profile">
      <fieldset disabled={pending} className="flex min-w-0 flex-col gap-2" aria-busy={pending}>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={id} className="text-sm font-medium">Display name</label>
          <Input
            id={id}
            name="name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            autoComplete="name"
          />
        </div>
        <Button type="submit" size="sm" className="h-9 w-full" disabled={pending} aria-busy={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </fieldset>
      <div role="status" aria-live="polite">
        {feedback?.status === "success" && (
          <p className="rounded-lg border border-default bg-state-success/10 px-3 py-2 text-xs text-state-success">
            Profile updated.
          </p>
        )}
        {feedback?.status === "error" && (
          <p role="alert" className="rounded-lg border border-default bg-state-warning/10 px-3 py-2 text-xs text-state-warning">
            {feedback.message}
          </p>
        )}
      </div>
    </form>
  );
}
