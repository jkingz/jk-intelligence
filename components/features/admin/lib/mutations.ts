export type MutationResult = { ok: true } | { ok: false; message: string };

type Method = "POST" | "PATCH" | "PUT" | "DELETE";

async function send(
  method: Method,
  path: string,
  body: unknown,
): Promise<MutationResult> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { ok: false, message: "Could not reach the server." };
  }
  if (response.ok) return { ok: true };
  // `error` is the server's own sentence and the only copy the UI shows. A reply
  // that is not JSON — a proxy's 502 page — gets the fixed string below rather
  // than any of its body text.
  const payload = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;
  return { ok: false, message: payload?.error ?? "The change did not save." };
}

export function createClient(name: string, domain: string) {
  return send("POST", "/api/admin/clients", { name, domain });
}

export function updateClient(
  clientId: string,
  patch: { name?: string; isActive?: boolean },
) {
  return send("PATCH", `/api/admin/clients/${clientId}`, patch);
}

export function attachMember(
  userId: string,
  body: { role: string; clientId?: string | null },
) {
  return send("PUT", `/api/admin/members/${userId}`, body);
}

export function detachMember(userId: string) {
  return send("DELETE", `/api/admin/members/${userId}`, undefined);
}
