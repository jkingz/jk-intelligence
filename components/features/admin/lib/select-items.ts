import { MEMBER_ROLES } from "@/types/metrics";
import type { PanelClient, PendingAccount } from "@/lib/admin/provisioning";

/**
 * base-ui `Select` cannot hold `null` as an item value, so an unassigned member
 * is addressed by this sentinel and `attachMember` turns it back into `null`.
 */
export const UNASSIGNED = "__unassigned__";

export const MEMBER_ROLE_ITEMS: Record<string, string> = Object.fromEntries(
  MEMBER_ROLES.map((role) => [role, role]),
);

export const CLIENT_ITEMS = (clients: PanelClient[]): Record<string, string> => ({
  [UNASSIGNED]: "Unassigned",
  ...Object.fromEntries(clients.map((client) => [client.id, client.name])),
});

export const ACCOUNT_ITEMS = (
  accounts: PendingAccount[],
): Record<string, string> =>
  Object.fromEntries(
    accounts.map((account) => [
      account.userId,
      account.name
        ? `${account.name} · ${account.email ?? "no email"}`
        : (account.email ?? account.userId),
    ]),
  );
