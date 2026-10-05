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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { finishStatusToast, startStatusToast } from "@/lib/toast-status";
import type { PanelClient, PendingAccount } from "@/lib/admin/provisioning";
import { MEMBER_ROLES } from "@/types/metrics";
import { attachMember } from "../lib/mutations";
import {
  ACCOUNT_ITEMS,
  CLIENT_ITEMS,
  MEMBER_ROLE_ITEMS,
  UNASSIGNED,
} from "../lib/select-items";

export function AttachMemberDialog({
  accounts,
  clients,
}: {
  accounts: PendingAccount[];
  clients: PanelClient[];
}) {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState(accounts[0]?.userId ?? "");
  const [role, setRole] = useState<string>("client");
  const [clientId, setClientId] = useState<string>(UNASSIGNED);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const items = ACCOUNT_ITEMS(accounts);
  const clientItems = CLIENT_ITEMS(clients);
  const chosen = accounts.find((account) => account.userId === userId);

  function changeOpen(next: boolean) {
    // A refresh replaces the pending list, so the field that was chosen may no
    // longer be in it. Start each attempt from the first account still pending.
    if (next) {
      setUserId(accounts[0]?.userId ?? "");
      setRole("client");
      setClientId(UNASSIGNED);
    }
    setOpen(next);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const toastId = startStatusToast("Attach account");
    startTransition(async () => {
      const result = await attachMember(userId, {
        role,
        clientId: role === "admin" || clientId === UNASSIGNED ? null : clientId,
      });
      if (!result.ok) {
        finishStatusToast(toastId, {
          status: "error",
          title: "Could not attach that account",
          description: result.message,
        });
        return;
      }
      finishStatusToast(toastId, {
        status: "success",
        title: "Account attached",
        description: `${chosen?.email ?? "The account"} is now a ${role}.`,
      });
      changeOpen(false);
      router.refresh();
    });
  }

  if (accounts.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger render={<Button size="sm" />}>Attach account</DialogTrigger>
      <DialogContent overlayClassName="bg-black/50 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle>Attach account</DialogTitle>
          <DialogDescription>
            {`${accounts.length} ${
              accounts.length === 1 ? "account has" : "accounts have"
            } signed up without a role. Attaching one gives it a place in the app.`}
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={submit}
          aria-label="Attach account"
        >
          <fieldset disabled={pending} className="flex min-w-0 flex-col gap-3" aria-busy={pending}>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="attach-account">
                Account
              </label>
              <Select
                items={items}
                value={userId}
                onValueChange={(next) => {
                  if (next) setUserId(next);
                }}
              >
                <SelectTrigger id="attach-account" className="w-full">
                  <SelectValue placeholder="Choose an account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {accounts.map((account) => (
                      <SelectItem key={account.userId} value={account.userId}>
                        {account.name
                          ? `${account.name} · ${account.email ?? "no email"}`
                          : (account.email ?? account.userId)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="attach-role">
                Role
              </label>
              <Select
                items={MEMBER_ROLE_ITEMS}
                value={role}
                onValueChange={(next) => {
                  if (!next) return;
                  setRole(next);
                  // The submit sends null for an admin either way; clearing the
                  // field keeps the disabled select from displaying a tenant the
                  // write will not use.
                  if (next === "admin") setClientId(UNASSIGNED);
                }}
              >
                <SelectTrigger id="attach-role" className="w-full">
                  <SelectValue placeholder="Choose a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {MEMBER_ROLES.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="attach-client">
                Client
              </label>
              <Select
                items={clientItems}
                value={clientId}
                onValueChange={(next) => {
                  if (next) setClientId(next);
                }}
                disabled={role === "admin"}
              >
                <SelectTrigger id="attach-client" className="w-full">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                    <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              {role === "admin" && (
                <p className="text-xs text-text-muted">
                  An admin belongs to no client.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending || userId === ""}>
                {pending ? "Attaching…" : "Attach"}
              </Button>
            </DialogFooter>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
