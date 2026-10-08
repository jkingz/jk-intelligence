/**
 * The one place a Postgres sqlstate becomes a status code and a sentence. Nothing else
 * in the admin layer may parse `error.message` to work out what went wrong.
 */
export type AdminWriteRpc =
  | "admin_create_client"
  | "admin_update_client"
  | "admin_attach_member"
  | "admin_detach_member";

const STATUS_BY_CODE: Record<string, number | undefined> = {
  "23505": 409,
  "23503": 409,
  "45001": 409,
  "45002": 409,
  "42501": 403,
  // 23514 is a constraint the functions themselves should have prevented: loud on
  // purpose, because a polite message here would hide a function bug.
  "23514": 500,
};

export function adminErrorStatus(code: string | undefined): number {
  return (code && STATUS_BY_CODE[code]) || 502;
}

const ANY_RPC: Record<string, string | undefined> = {
  "42501": "You no longer have admin access.",
  "23514": "The server rejected that change.",
};

const BY_RPC: Record<AdminWriteRpc, Record<string, string | undefined>> = {
  admin_create_client: {
    "23505": "Another client already owns that domain.",
    "23503": "That client no longer exists.",
    "45001": "Assign another admin before removing this one.",
  },
  admin_update_client: {
    "23505": "Another client already owns that domain.",
    "23503": "That client no longer exists.",
    "45002": "That client no longer exists.",
    "45001": "Assign another admin before removing this one.",
  },
  admin_attach_member: {
    "23503": "That account or client no longer exists.",
    "45001": "Assign another admin before removing this one.",
    "45002": "That account is not provisioned.",
  },
  admin_detach_member: {
    "45001": "Assign another admin before removing this one.",
    "45002": "That account is not provisioned.",
    "23503": "That account or client no longer exists.",
  },
};

export function adminErrorMessage(
  rpc: AdminWriteRpc,
  code: string | undefined,
): string {
  const specific = code ? BY_RPC[rpc][code] : undefined;
  if (specific) return specific;
  const shared = code ? ANY_RPC[code] : undefined;
  if (shared) return shared;
  return "Could not reach the database.";
}
