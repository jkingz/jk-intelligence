import { adminErrorMessage, adminErrorStatus } from "@/lib/admin/errors";
import { AdminRpcError, callAdminRpc } from "@/lib/admin/rpc";
import { createClientBody } from "@/lib/admin/schemas";
import {
  badRequest,
  firstIssueMessage,
  gateAdmin,
  json,
  readJsonBody,
} from "@/lib/api/guard";

export async function POST(request: Request) {
  const gate = await gateAdmin();
  if (!gate.allow) return gate.response;

  const body = await readJsonBody(request);
  if (!body.ok) return badRequest(body.message);

  const parsed = createClientBody.safeParse(body.value);
  if (!parsed.success) return badRequest(firstIssueMessage(parsed.error));

  try {
    const client = await callAdminRpc("admin_create_client", {
      p_name: parsed.data.name,
      p_domain: parsed.data.domain,
    });
    return json({ client }, 200);
  } catch (error) {
    const code = error instanceof AdminRpcError ? error.code : undefined;
    return json(
      { error: adminErrorMessage("admin_create_client", code) },
      adminErrorStatus(code),
    );
  }
}
