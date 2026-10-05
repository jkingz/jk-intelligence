import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Functions = Database["public"]["Functions"];

/** Every RPC the admin panel can reach, including the read. */
export type AdminFunctionName = keyof Functions & string;

type AdminRpcArgs<TName extends AdminFunctionName> = Functions[TName]["Args"];
type AdminRpcReturns<TName extends AdminFunctionName> =
  Functions[TName]["Returns"];

/**
 * Postgres' own message is dropped on purpose: lib/admin/errors.ts owns every string
 * this feature emits, and forwarding message text would leak constraint and column
 * names into a response body.
 */
export class AdminRpcError extends Error {
  readonly code: string | undefined;
  readonly functionName: string;

  constructor(functionName: string, code: string | undefined) {
    super(`admin rpc ${functionName} failed (${code ?? "unknown"})`);
    this.name = "AdminRpcError";
    this.code = code;
    this.functionName = functionName;
  }
}

/**
 * The only admin read and write path. The client is the cookie-bound one, so the
 * definer functions' role guard sees the caller's role and RLS still decides which
 * rows are visible — getAdminDb() is not reachable from here.
 */
export async function callAdminRpc<TName extends AdminFunctionName>(
  functionName: TName,
  args: AdminRpcArgs<TName>,
): Promise<AdminRpcReturns<TName>> {
  const db = await createServerSupabaseClient();
  const { data, error } = await db.rpc(functionName, args);
  if (error) {
    // PostgrestError types `code` as required, but a transport-level failure carries
    // none; the code-less case is what maps a dead Postgres to 502 rather than a guess.
    const code = (error as { code?: string }).code;
    console.error("[admin] rpc failed", { functionName, code });
    throw new AdminRpcError(functionName, code);
  }
  // supabase-js resolves rpc() overloads from a *literal* function name, so passing a
  // generic TName hands back its "couldn't infer the definition" union rather than the
  // row type. Callers pass literals, so AdminRpcArgs/AdminRpcReturns are the checked
  // contract; this is the one place it is re-attached by hand.
  return data as unknown as AdminRpcReturns<TName>;
}
