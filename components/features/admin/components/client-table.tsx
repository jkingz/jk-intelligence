import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PanelClient } from "@/lib/admin/provisioning";

export function ClientTable({ clients }: { clients: PanelClient[] }) {
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
                  <Button variant="ghost" size="sm" disabled>
                    Rename
                  </Button>
                  <Button variant="outline" size="sm" disabled>
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
