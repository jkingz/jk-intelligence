import { z } from "zod";

// Four handlers repeating fifteen header lines is how one of them drifts, so the
// response shape lives here. Mirrors app/api/metrics/[clientId]/overview/route.ts.
const HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  Vary: "Cookie",
} as const;

export function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

/** Body, the zod issue's own message, or a shape error — in that order. */
export async function readJsonBody(
  request: Request,
): Promise<{ ok: true; value: unknown } | { ok: false; message: string }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, message: "Send a JSON body." };
  }
  return { ok: true, value: raw };
}

export function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check that value.";
}

export function badRequest(message: string): Response {
  return jsonResponse({ error: message }, 400);
}
