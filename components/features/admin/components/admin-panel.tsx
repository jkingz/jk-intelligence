import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AdminView } from "@/lib/admin/provisioning";
import { AttachMemberDialog } from "./attach-member-dialog";
import { ClientDialog } from "./client-dialog";
import { ClientTable } from "./client-table";
import { MemberTable } from "./member-table";

export function AdminPanel({ view }: { view: AdminView }) {
  const { clients, members } = view;
  return (
    <main className="max-w-7xl w-full min-w-0 mx-auto px-4 sm:px-6 py-6 sm:py-8 flex-1 flex flex-col">
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-2xl sm:text-3xl tracking-tight font-medium">
          Provisioning
        </h1>
        <p className="max-w-prose text-sm text-text-muted">
          Clients and the accounts that belong to them.
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Clients</CardTitle>
            <CardAction>
              <ClientDialog mode="create" />
            </CardAction>
          </CardHeader>
          {clients.length === 0 ? (
            <CardContent className="py-12 text-center text-sm text-text-muted">
              No clients yet. Create one to start assigning accounts.
            </CardContent>
          ) : (
            <CardContent className="px-0">
              <ClientTable clients={clients} />
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
            {members.pending.length > 0 && (
              <CardAction>
                <AttachMemberDialog accounts={members.pending} />
              </CardAction>
            )}
          </CardHeader>
          {members.provisioned.length === 0 ? (
            <CardContent className="py-12 text-center text-sm text-text-muted">
              Accounts that signed up but were never provisioned appear here.
            </CardContent>
          ) : (
            <CardContent className="px-0">
              <MemberTable members={members.provisioned} />
            </CardContent>
          )}
        </Card>

        {members.pending.length === 0 && members.provisioned.length > 0 && (
          <p className="text-sm text-text-muted">
            Every account is already provisioned.
          </p>
        )}
      </div>
    </main>
  );
}
