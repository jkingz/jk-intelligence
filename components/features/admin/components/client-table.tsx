"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { finishStatusToast, startStatusToast } from "@/lib/toast-status";
import type { PanelClient } from "@/lib/admin/provisioning";
import { updateClient } from "../lib/mutations";
import { ClientDialog } from "./client-dialog";

export function ClientTable({ clients }: { clients: PanelClient[] }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function toggle(client: PanelClient) {
    setBusyId(client.id);
    const toastId = startStatusToast(
      client.isActive ? "Pause client" : "Resume client",
    );
    startTransition(async () => {
      const result = await updateClient(client.id, { isActive: !client.isActive });
      setBusyId(null);
      if (!result.ok) {
        finishStatusToast(toastId, {
          status: "error",
          title: client.isActive ? "Could not pause it" : "Could not resume it",
          description: result.message,
        });
        return;
      }
      finishStatusToast(toastId, {
        status: "success",
        title: client.isActive ? "Client paused" : "Client resumed",
        description: `${client.name} is ${client.isActive ? "paused" : "active"}.`,
      });
      // The badge keeps its server-side value until this lands, so a refusal
      // from Postgres never leaves the table claiming a state it did not get.
      router.refresh();
    });
  }

  return (
    <div className="relative overflow-x-auto">
      <table className="w-full text-left text-xs">
        <caption className="sr-only">
          Every registered client, paused ones included, with its member count
        </caption>
        <thead className="bg-surface border-b border-default text-text-muted font-medium font-mono text-[11px]">
          <tr>
            <th scope="col" className="py-3 px-4 sm:px-5">
              Client
            </th>
            <th scope="col" className="hidden py-3 px-3 sm:table-cell sm:px-4">
              Domain
            </th>
            <th scope="col" className="py-3 px-3 sm:px-4">
              Status
            </th>
            <th scope="col" className="py-3 px-3 sm:px-4">
              Members
            </th>
            <th scope="col" className="py-3 px-4 sm:px-5">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-default">
          {clients.map((client) => (
            <tr key={client.id} className="hover:bg-secondary/30 transition-colors">
              <td className="py-3 px-4 sm:px-5 font-medium text-text-primary">
                {client.name}
              </td>
              <td className="hidden py-3 px-3 font-mono text-text-muted sm:table-cell sm:px-4">
                {client.domain}
              </td>
              <td className="py-3 px-3 sm:px-4">
                <Badge variant={client.isActive ? "secondary" : "outline"}>
                  {client.isActive ? "Active" : "Paused"}
                </Badge>
              </td>
              <td className="py-3 px-3 font-mono tabular-nums sm:px-4">
                {client.memberCount}
              </td>
              <td className="py-3 px-4 sm:px-5">
                <div className="flex justify-end gap-2">
                  <ClientDialog
                    mode="rename"
                    clientId={client.id}
                    name={client.name}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busyId === client.id}
                    onClick={() => toggle(client)}
                  >
                    {client.isActive ? "Pause" : "Resume"}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
