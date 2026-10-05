import "server-only";

import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { callAdminRpc } from "@/lib/admin/rpc";
import { MEMBER_ROLES, type MemberRole } from "@/types/metrics";

const clientRow = z.object({
  id: z.uuid(),
  name: z.string(),
  domain: z.string(),
  is_active: z.boolean(),
});

const userRow = z.object({
  id: z.uuid(),
  role: z.enum(MEMBER_ROLES),
  client_id: z.uuid().nullable(),
  created_at: z.iso.datetime({ offset: true }),
});

const directoryRow = z.object({
  id: z.uuid(),
  email: z.string().nullable(),
  name: z.string().nullable(),
  created_at: z.iso.datetime({ offset: true }),
});

type ClientRow = z.infer<typeof clientRow>;
type UserRow = z.infer<typeof userRow>;
type DirectoryRow = z.infer<typeof directoryRow>;

export type PanelClient = {
  id: string;
  name: string;
  domain: string;
  isActive: boolean;
  memberCount: number;
};

export type ProvisionedMember = {
  userId: string;
  email: string | null;
  name: string | null;
  role: MemberRole;
  clientId: string | null;
  clientName: string | null;
  createdAt: string;
  unlisted: boolean;
};

export type PendingAccount = {
  userId: string;
  email: string | null;
  name: string | null;
  createdAt: string;
};

export type MemberViews = {
  provisioned: ProvisionedMember[];
  pending: PendingAccount[];
};

export type AdminView = {
  clients: PanelClient[];
  members: MemberViews;
};

const byCreatedAt = (a: { createdAt: string }, b: { createdAt: string }) =>
  a.createdAt.localeCompare(b.createdAt);

/**
 * public.users stores neither an email nor a display name, so every identity
 * string the panel renders comes from the directory. `unlisted` covers a member
 * the directory did not return — the 1000-row cap makes it reachable.
 */
export function buildMemberViews(
  users: UserRow[],
  directory: DirectoryRow[],
): MemberViews {
  const byAuthId = new Map(directory.map((row) => [row.id, row]));
  const provisioned: ProvisionedMember[] = [];
  const seen = new Set<string>();

  for (const user of users) {
    const identity = byAuthId.get(user.id);
    seen.add(user.id);
    provisioned.push({
      userId: user.id,
      email: identity?.email ?? null,
      name: identity?.name ?? null,
      role: user.role,
      clientId: user.client_id,
      clientName: null,
      createdAt: user.created_at,
      unlisted: identity === undefined,
    });
  }
  provisioned.sort(byCreatedAt);

  const pending = directory
    .filter((row) => !seen.has(row.id))
    .map((row) => ({
      userId: row.id,
      email: row.email,
      name: row.name,
      createdAt: row.created_at,
    }))
    .sort(byCreatedAt);

  return { provisioned, pending };
}

export function withMemberCounts(
  clients: ClientRow[],
  provisioned: ProvisionedMember[],
): PanelClient[] {
  const counts = new Map<string, number>();
  for (const member of provisioned) {
    if (member.clientId) {
      counts.set(member.clientId, (counts.get(member.clientId) ?? 0) + 1);
    }
  }
  return clients.map((client) => ({
    id: client.id,
    name: client.name,
    domain: client.domain,
    isActive: client.is_active,
    memberCount: counts.get(client.id) ?? 0,
  }));
}

function attachClientNames(
  provisioned: ProvisionedMember[],
  clients: ClientRow[],
): ProvisionedMember[] {
  const nameById = new Map(clients.map((client) => [client.id, client.name]));
  return provisioned.map((member) =>
    member.clientId
      ? { ...member, clientName: nameById.get(member.clientId) ?? null }
      : member,
  );
}

/**
 * Reads are RLS-gated table selects; nothing here decides visibility.
 * `clients` is selected with no is_active filter on purpose — deactivating a
 * client has to leave it visible, or Pause is irreversible.
 */
export async function getAdminView(): Promise<AdminView> {
  const db = await createServerSupabaseClient();
  const [clientsResult, usersResult, directory] = await Promise.all([
    db.from("clients").select("id,name,domain,is_active").order("name"),
    db.from("users").select("id,role,client_id,created_at").order("created_at"),
    callAdminRpc("admin_directory", {}),
  ]);

  if (clientsResult.error) throw new Error("Admin read failed: clients");
  if (usersResult.error) throw new Error("Admin read failed: users");

  const clients = z.array(clientRow).parse(clientsResult.data);
  const users = z.array(userRow).parse(usersResult.data);
  const listed = z.array(directoryRow).parse(directory);

  const members = buildMemberViews(users, listed);
  return {
    clients: withMemberCounts(clients, members.provisioned),
    members: { ...members, provisioned: attachClientNames(members.provisioned, clients) },
  };
}
