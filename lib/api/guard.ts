import "server-only";

import { type ZodError } from "zod";

import { getAuthUser, requireAdmin, type AuthUser } from "@/lib/agents/authAgent";
import { canAccessClient, listAccessibleClients } from "@/lib/db/repository";
import type { DashboardClient } from "@/types/dashboard";

/**
 * The cache pair every authenticated response carries, and nothing else. No
 * shared-cache freshness belongs here: a session-decided payload cannot be
 * CDN-cached, because Vary cannot name Cookie on Vercel (vary_key_denied:cookie).
 * Both export routes spread this into their own attachment response.
 */
export const NO_STORE = {
  "Cache-Control": "no-store",
  Vary: "Cookie",
} as const;

/** `extra` exists for the one header that is not a cache decision: `Retry-After`. */
export function json(body: unknown, status: number, extra?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...NO_STORE, ...extra },
  });
}

export function badRequest(message: string): Response {
  return json({ error: message }, 400);
}

export function unauthorized(): Response {
  return json({ error: "Unauthorized" }, 401);
}

export function forbidden(): Response {
  return json({ error: "Forbidden" }, 403);
}

export function databaseFailure(): Response {
  return json({ error: "Database operation failed" }, 503);
}

/**
 * A gate returns either the thing the route needs or a finished Response, so the
 * route keeps its own ordering and the denial shape lives in one place.
 */
export type Gate<T> =
  | { allow: true; value: T }
  | { allow: false; response: Response };

/**
 * One read, three outcomes: value → allow, null → 401, throw → 503. An identity
 * outage must never be reported as "you are logged out", which is why the catch
 * is per-gate rather than left to the handler.
 */
export async function gateNullable<T>(read: () => Promise<T | null>): Promise<Gate<T>> {
  try {
    const value = await read();
    if (value === null) return { allow: false, response: unauthorized() };
    return { allow: true, value };
  } catch {
    return { allow: false, response: databaseFailure() };
  }
}

export async function gateSession(): Promise<Gate<AuthUser>> {
  return gateNullable(getAuthUser);
}

/**
 * Role only, and `requireAdmin`'s reasons only — its decision carries no user, so
 * there is nothing to hand back. Deviation 2 in the plan.
 */
export async function gateAdmin(): Promise<Gate<null>> {
  try {
    const decision = await requireAdmin();
    if (decision.allow) return { allow: true, value: null };
    return {
      allow: false,
      response: decision.reason === "unauthenticated" ? unauthorized() : forbidden(),
    };
  } catch {
    return { allow: false, response: databaseFailure() };
  }
}

/** Ownership is Postgres' call. This forwards; it does not decide. */
export async function gateClientAccess(clientId: string): Promise<Gate<true>> {
  try {
    if (!(await canAccessClient(clientId))) {
      return { allow: false, response: forbidden() };
    }
    return { allow: true, value: true };
  } catch {
    return { allow: false, response: databaseFailure() };
  }
}

/**
 * The other tenant gate: routes that need the row, not just a yes. Same RLS path,
 * and the row it returns is the one the caller is allowed to see.
 */
export async function resolveAccessibleClient(clientId: string): Promise<Gate<DashboardClient>> {
  try {
    const client = (await listAccessibleClients()).find((entry) => entry.id === clientId) ?? null;
    if (!client) return { allow: false, response: forbidden() };
    return { allow: true, value: client };
  } catch {
    return { allow: false, response: databaseFailure() };
  }
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

export function firstIssueMessage(error: ZodError): string {
  return error.issues[0]?.message ?? "Check that value.";
}
