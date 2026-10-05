import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ProvisionedMember } from "@/lib/admin/provisioning";

export function MemberTable({ members }: { members: ProvisionedMember[] }) {
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
                  <Badge variant="outline">{member.role}</Badge>
                </td>
                <td className="hidden py-3 px-3 text-text-muted sm:table-cell sm:px-4">
                  {member.clientName ?? "Unassigned"}
                </td>
                <td className="py-3 px-4 sm:px-5">
                  <div className="flex justify-end">
                    <Button variant="ghost" size="sm" disabled>
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
