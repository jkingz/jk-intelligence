import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { safeNext } from "@/lib/auth/routing";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const callbackParamsSchema = z.object({
  code: z.string().min(1),
  next: z.string().optional(),
  flowId: z.string().min(1).optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;

  const parsed = callbackParamsSchema.safeParse({
    code: url.searchParams.get("code"),
    next: url.searchParams.get("next") ?? undefined,
    flowId: url.searchParams.get("sb_flow_id") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.redirect(new URL("/auth/login?error=code", origin));
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(
      parsed.data.code,
      parsed.data.flowId ? { flowId: parsed.data.flowId } : undefined,
    );
    if (!error && data.session) {
      const destination = "redirectType" in data && data.redirectType === "recovery"
        ? "/auth/reset-password"
        : safeNext(parsed.data.next) ?? "/dashboard";
      const response = NextResponse.redirect(new URL(destination, origin));
      const cookieStore = await cookies();
      for (const cookie of cookieStore.getAll()) {
        response.cookies.set(cookie);
      }
      return response;
    }
  } catch {
    return NextResponse.redirect(new URL("/auth/login?error=code", origin));
  }

  return NextResponse.redirect(new URL("/auth/login?error=code", origin));
}