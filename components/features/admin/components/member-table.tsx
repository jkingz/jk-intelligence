"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { finishStatusToast, startStatusToast } from "@/lib/toast-status";
import type { PanelClient, ProvisionedMember } from "@/lib/admin/provisioning";
import { MEMBER_ROLES } from "@/types/metrics";
import { attachMember, detachMember } from "../lib/mutations";
import { CLIENT_ITEMS, MEMBER_ROLE_ITEMS, UNASSIGNED } from "../lib/select-items";

export function MemberTable({
  members,
  clients,
}: {
  members: ProvisionedMember[];
  clients: PanelClient[];
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const clientItems = CLIENT_ITEMS(clients);

  function patch(
    member: ProvisionedMember,
    body: { role: string; clientId?: string | null },
  ) {
    setBusyId(member.userId);
    const toastId = startStatusToast("Update member");
    startTransition(async () => {
      const result = await attachMember(member.userId, body);
      setBusyId(null);
      if (!result.ok) {
        finishStatusToast(toastId, {
          status: "error",
          title: "Change declined",
          description: result.message,
        });
        return;
      }
      finishStatusToast(toastId, {
        status: "success",
        title: "Member updated",
        description: "Saved.",
      });
      // Nothing above flips a select locally: the row re-reads the server, so a
      // declined write leaves the table telling the truth.
      router.refresh();
    });
  }

  function changeRole(member: ProvisionedMember, role: string) {
    if (role === member.role) return;
    // users_admin_has_no_tenant would answer 23514 for an admin with a client,
    // and admin_attach_member forces the null anyway — this just keeps the row's
    // own client select from showing a tenant the account no longer has.
    patch(member, { role, clientId: role === "admin" ? null : member.clientId });
  }

  function changeClient(member: ProvisionedMember, clientId: string) {
    const next = clientId === UNASSIGNED ? null : clientId;
    if (next === member.clientId) return;
    patch(member, { role: member.role, clientId: next });
  }

  function detach(member: ProvisionedMember) {
    setBusyId(member.userId);
    const toastId = startStatusToast("Detach account");
    startTransition(async () => {
      const result = await detachMember(member.userId);
      setBusyId(null);
      if (!result.ok) {
        finishStatusToast(toastId, {
          status: "error",
          title: "Could not detach it",
          description: result.message,
        });
        return;
      }
      finishStatusToast(toastId, {
        status: "success",
        title: "Account detached",
        description: `${member.email ?? "The account"} is no longer provisioned.`,
      });
      router.refresh();
    });
  }

  return (
    <div className="relative overflow-x-auto">
      <table className="w-full text-left text-xs">
        <caption className="sr-only">
          Provisioned accounts, the role each one holds and the client it belongs to
        </caption>
        <thead className="bg-surface border-b border-default text-text-muted font-medium font-mono text-[11px]">
          <tr>
            <th scope="col" className="py-3 px-4 sm:px-5">
              Account
            </th>
            <th scope="col" className="py-3 px-3 sm:px-4">
              Role
            </th>
            <th scope="col" className="hidden py-3 px-3 sm:table-cell sm:px-4">
              Client
            </th>
            <th scope="col" className="py-3 px-4 sm:px-5">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-default">
          {members.map((member) => {
            const primary = member.name ?? member.email ?? "Unnamed account";
            // The email is also the fallback primary, so repeating it would print
            // the same string twice for every account that has no display name.
            const secondary =
              member.email && member.email !== primary
                ? member.email
                : member.unlisted
                  ? "Not in the directory"
                  : null;
            const busy = busyId === member.userId;
            const label = member.email ?? member.userId;
            return (
              <tr key={member.userId} className="hover:bg-secondary/30 transition-colors">
                <td className="py-3 px-4 sm:px-5">
                  <span className="block font-medium text-text-primary">
                    {primary}
                  </span>
                  {secondary && (
                    <span className="block font-mono text-[11px] text-text-muted">
                      {secondary}
                    </span>
                  )}
                </td>
                <td className="py-3 px-3 sm:px-4">
                  <Select
                    items={MEMBER_ROLE_ITEMS}
                    value={member.role}
                    onValueChange={(next) => {
                      if (next) changeRole(member, next);
                    }}
                    disabled={busy}
                  >
                    <SelectTrigger
                      size="sm"
                      className="w-28"
                      aria-label={`Role for ${label}`}
                      loading={busy}
                    >
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {MEMBER_ROLES.map((role) => (
                          <SelectItem key={role} value={role}>
                            {role}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </td>
                <td className="hidden py-3 px-3 sm:table-cell sm:px-4">
                  <Select
                    items={clientItems}
                    value={member.clientId ?? UNASSIGNED}
                    onValueChange={(next) => {
                      if (next) changeClient(member, next);
                    }}
                    // An admin has no tenant to choose: the DDL refuses it, so the
                    // control that would only ever produce a refusal is not offered.
                    disabled={busy || member.role === "admin"}
                  >
                    <SelectTrigger
                      size="sm"
                      className="w-40"
                      aria-label={`Client for ${label}`}
                      loading={busy}
                    >
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
                </td>
                <td className="py-3 px-4 sm:px-5">
                  <div className="flex justify-end">
                    <Button variant="ghost" size="sm" disabled={busy} onClick={() => detach(member)}>
                      Detach
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
