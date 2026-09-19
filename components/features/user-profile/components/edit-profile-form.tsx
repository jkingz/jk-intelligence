"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { SlidingWindowLimiter } from "@/lib/rate-limit";
import { finishStatusToast, startStatusToast } from "@/lib/toast-status";
import { updateProfileAction } from "../lib/update-profile-action";

export function EditProfileForm({
  currentName,
  onSaved,
}: {
  currentName: string | null;
  onSaved?: () => void;
}) {
  const id = "profile-name";
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(currentName ?? "");
  const limiter = useRef(new SlidingWindowLimiter({ max: 5, windowMs: 60_000 })).current;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!limiter.trySubmit()) {
      toast.add({
        type: "error",
        title: "Too many attempts",
        description: "Please wait a moment before trying again.",
      });
      return;
    }
    const statusId = startStatusToast("Saving profile", "Saving your changes…");
    startTransition(async () => {
      const result = await updateProfileAction({ name });
      if (result.status === "success") {
        finishStatusToast(statusId, {
          status: "success",
          title: "Profile saved",
          description: "Profile updated.",
        });
        setName("");
        onSaved?.();
      } else {
        finishStatusToast(statusId, {
          status: "error",
          title: "Could not save changes",
          description: result.message,
        });
      }
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
    </form>
  );
}
