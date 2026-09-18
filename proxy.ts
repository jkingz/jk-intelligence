import { NextResponse, type NextRequest } from "next/server";
import { resolveProxyAction } from "@/lib/auth/routing";
import { updateSession } from "@/lib/supabase/proxy";

export default async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const action = resolveProxyAction(request.nextUrl.pathname, Boolean(user));

  if (action.type === "pass") {
    return response;
  }

  const url = request.nextUrl.clone();

  if (action.type === "redirect-home") {
    url.pathname = "/";
    url.search = "";
  } else {
    url.pathname = "/auth/login";
    url.search = "";
    url.searchParams.set("next", action.next ?? "/");
  }

  const redirect = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)",
  ],
};