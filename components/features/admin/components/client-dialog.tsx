"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { finishStatusToast, startStatusToast } from "@/lib/toast-status";
import { createClient, updateClient } from "../lib/mutations";

export function ClientDialog({
  mode,
  clientId,
  name = "",
}: {
  mode: "create" | "rename";
  clientId?: string;
  name?: string;
}) {
  // A rename dialog is rendered once per row, so a static field id would give
  // every label the same `for` and point them all at the first row's input.
  const key = clientId ?? "new";
  const nameId = `client-name-${key}`;
  const domainId = `client-domain-${key}`;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(name);
  const [domain, setDomain] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function changeOpen(next: boolean) {
    // Re-read from the server's row on every open: a refresh elsewhere in the
    // panel can move the name under a draft that is still held from last time.
    if (next) {
      setDraft(name);
      setDomain("");
    }
    setOpen(next);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const toastId = startStatusToast(
      mode === "create" ? "Create client" : "Rename client",
    );
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createClient(draft, domain)
          : await updateClient(clientId!, { name: draft });
      if (!result.ok) {
        finishStatusToast(toastId, {
          status: "error",
          title: mode === "create" ? "Could not create the client" : "Could not rename it",
          description: result.message,
        });
        // Stay open with the draft intact: the fix is in the field, not in
        // retyping the whole form.
        return;
      }
      finishStatusToast(toastId, {
        status: "success",
        title: mode === "create" ? "Client created" : "Client renamed",
        description: mode === "create" ? `${draft} is in the registry.` : `${draft}.`,
      });
      changeOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger
        render={
          <Button variant={mode === "create" ? "default" : "ghost"} size="sm" />
        }
      >
        {mode === "create" ? "Create client" : "Rename"}
      </DialogTrigger>
      <DialogContent overlayClassName="bg-black/50 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New client" : "Rename client"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "The domain is fixed once the client exists. Seed scripts key on it."
              : "The domain cannot be changed after creation."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={submit}
          aria-label={mode === "create" ? "Create client" : "Rename client"}
        >
          <fieldset disabled={pending} className="flex min-w-0 flex-col gap-3" aria-busy={pending}>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor={nameId}>
                Name
              </label>
              <Input
                id={nameId}
                name="name"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={120}
                required
              />
            </div>
            {mode === "create" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" htmlFor={domainId}>
                  Domain
                </label>
                <Input
                  id={domainId}
                  name="domain"
                  value={domain}
                  onChange={(event) => setDomain(event.target.value)}
                  placeholder="atlas.example"
                  required
                />
              </div>
            )}
            <DialogFooter>
              <Button type="submit" disabled={pending} aria-busy={pending}>
                {pending ? "Saving…" : mode === "create" ? "Create" : "Save"}
              </Button>
            </DialogFooter>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
