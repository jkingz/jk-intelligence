import { adminErrorMessage, adminErrorStatus } from "@/lib/admin/errors";
import {
  badRequest,
  firstIssueMessage,
  jsonResponse,
  readJsonBody,
} from "@/lib/admin/http";
import { AdminRpcError, callAdminRpc } from "@/lib/admin/rpc";
import { createClientBody } from "@/lib/admin/schemas";
import { requireAdmin } from "@/lib/agents/authAgent";

export async function POST(request: Request) {
  const gate = await requireAdmin();
  if (!gate.allow) {
    return jsonResponse(
      { error: gate.reason === "unauthenticated" ? "Unauthorized" : "Forbidden" },
      gate.reason === "unauthenticated" ? 401 : 403,
    );
  }

  const body = await readJsonBody(request);
  if (!body.ok) return badRequest(body.message);

  const parsed = createClientBody.safeParse(body.value);
  if (!parsed.success) return badRequest(firstIssueMessage(parsed.error));

  try {
    const client = await callAdminRpc("admin_create_client", {
      p_name: parsed.data.name,
      p_domain: parsed.data.domain,
    });
    return jsonResponse({ client }, 200);
  } catch (error) {
    const code = error instanceof AdminRpcError ? error.code : undefined;
    return jsonResponse(
      { error: adminErrorMessage("admin_create_client", code) },
      adminErrorStatus(code),
    );
  }
}
