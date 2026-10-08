import { z } from "zod";

import { adminErrorMessage, adminErrorStatus } from "@/lib/admin/errors";
import {
  badRequest,
  firstIssueMessage,
  jsonResponse,
  readJsonBody,
} from "@/lib/admin/http";
import { AdminRpcError, callAdminRpc } from "@/lib/admin/rpc";
import { updateClientBody } from "@/lib/admin/schemas";
import { requireAdmin } from "@/lib/agents/authAgent";

const clientIdSchema = z.uuid();

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/admin/clients/[clientId]">,
) {
  const gate = await requireAdmin();
  if (!gate.allow) {
    return jsonResponse(
      { error: gate.reason === "unauthenticated" ? "Unauthorized" : "Forbidden" },
      gate.reason === "unauthenticated" ? 401 : 403,
    );
  }

  const { clientId: rawClientId } = await ctx.params;
  const clientId = clientIdSchema.safeParse(rawClientId);
  if (!clientId.success) return badRequest("Invalid client id");

  const body = await readJsonBody(request);
  if (!body.ok) return badRequest(body.message);

  const parsed = updateClientBody.safeParse(body.value);
  if (!parsed.success) return badRequest(firstIssueMessage(parsed.error));

  try {
    const client = await callAdminRpc("admin_update_client", {
      p_id: clientId.data,
      // undefined, not null: JSON.stringify drops the key, the parameter then takes
      // its declared default (null), and the body's coalesce turns that into "leave
      // this column alone". Both p_name and p_is_active use that mechanism, which is
      // why a partial PATCH needs no second round trip to read the row.
      p_name: parsed.data.name,
      p_is_active: parsed.data.isActive,
    });
    return jsonResponse({ client }, 200);
  } catch (error) {
    const code = error instanceof AdminRpcError ? error.code : undefined;
    return jsonResponse(
      { error: adminErrorMessage("admin_update_client", code) },
      adminErrorStatus(code),
    );
  }
}
