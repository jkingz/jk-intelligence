import { z } from "zod";

import { adminErrorMessage, adminErrorStatus } from "@/lib/admin/errors";
import { AdminRpcError, callAdminRpc } from "@/lib/admin/rpc";
import { updateClientBody } from "@/lib/admin/schemas";
import {
  badRequest,
  firstIssueMessage,
  gateAdmin,
  json,
  readJsonBody,
} from "@/lib/api/guard";

const clientIdSchema = z.uuid();

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/admin/clients/[clientId]">,
) {
  const gate = await gateAdmin();
  if (!gate.allow) return gate.response;

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
    return json({ client }, 200);
  } catch (error) {
    const code = error instanceof AdminRpcError ? error.code : undefined;
    return json(
      { error: adminErrorMessage("admin_update_client", code) },
      adminErrorStatus(code),
    );
  }
}
