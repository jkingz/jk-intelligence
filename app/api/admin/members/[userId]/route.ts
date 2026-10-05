import { z } from "zod";

import {
  adminErrorMessage,
  adminErrorStatus,
  type AdminWriteRpc,
} from "@/lib/admin/errors";
import {
  badRequest,
  firstIssueMessage,
  jsonResponse,
  readJsonBody,
} from "@/lib/admin/http";
import { AdminRpcError, callAdminRpc } from "@/lib/admin/rpc";
import { attachMemberBody } from "@/lib/admin/schemas";
import { requireAdmin } from "@/lib/agents/authAgent";

const userIdSchema = z.uuid();

// Both verbs share these two; the single-verb route files keep the same five
// lines inline.
async function gate(): Promise<Response | null> {
  const decision = await requireAdmin();
  if (decision.allow) return null;
  return jsonResponse(
    {
      error: decision.reason === "unauthenticated" ? "Unauthorized" : "Forbidden",
    },
    decision.reason === "unauthenticated" ? 401 : 403,
  );
}

// Each verb names its own RPC: that is how the two §7 23503 sentences stay
// switchable without reading Postgres' message text.
function rpcFailure(rpc: AdminWriteRpc, error: unknown): Response {
  const code = error instanceof AdminRpcError ? error.code : undefined;
  return jsonResponse(
    { error: adminErrorMessage(rpc, code) },
    adminErrorStatus(code),
  );
}

export async function PUT(
  request: Request,
  ctx: RouteContext<"/api/admin/members/[userId]">,
) {
  const denied = await gate();
  if (denied) return denied;

  const { userId: rawUserId } = await ctx.params;
  const userId = userIdSchema.safeParse(rawUserId);
  if (!userId.success) return badRequest("Invalid user id");

  const body = await readJsonBody(request);
  if (!body.ok) return badRequest(body.message);

  const parsed = attachMemberBody.safeParse(body.value);
  if (!parsed.success) return badRequest(firstIssueMessage(parsed.error));

  try {
    const member = await callAdminRpc("admin_attach_member", {
      p_user_id: userId.data,
      p_role: parsed.data.role,
      // Attach writes role and client_id as one statement, so an omitted key and
      // an explicit null both mean "no tenant" (p_client_id defaults to null in
      // the DDL). Contrast admin_update_client, where the absence of a key is
      // what leaves a column alone.
      p_client_id: parsed.data.clientId,
    });
    return jsonResponse({ member }, 200);
  } catch (error) {
    return rpcFailure("admin_attach_member", error);
  }
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/admin/members/[userId]">,
) {
  const denied = await gate();
  if (denied) return denied;

  const { userId: rawUserId } = await ctx.params;
  const userId = userIdSchema.safeParse(rawUserId);
  if (!userId.success) return badRequest("Invalid user id");

  try {
    const member = await callAdminRpc("admin_detach_member", {
      p_user_id: userId.data,
    });
    return jsonResponse({ member }, 200);
  } catch (error) {
    return rpcFailure("admin_detach_member", error);
  }
}
