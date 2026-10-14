import { afterEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  createServerSupabaseClient: vi.fn(),
  cookiesGetAll: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: boundary.cookiesGetAll }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: boundary.createServerSupabaseClient,
}));

import { GET } from "@/app/auth/callback/route";

const ORIGIN = "http://localhost";

function callback(query: string) {
  return GET(new Request(`${ORIGIN}/auth/callback${query}`));
}

afterEach(() => {
  boundary.exchangeCodeForSession.mockReset();
  boundary.createServerSupabaseClient.mockReset();
  boundary.cookiesGetAll.mockReset();
  boundary.cookiesGetAll.mockReturnValue([]);
  boundary.createServerSupabaseClient.mockResolvedValue({
    auth: { exchangeCodeForSession: boundary.exchangeCodeForSession },
  });
});

describe("GET /auth/callback", () => {
  it("redirects to login with error=code when the code is missing, without touching Supabase", async () => {
    const response = await callback("");
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/auth/login");
    expect(new URL(response.headers.get("location")!).searchParams.get("error")).toBe("code");
    expect(boundary.createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it("redirects to login with error=code when the code exchange returns an error", async () => {
    boundary.exchangeCodeForSession.mockResolvedValue({ data: { session: null }, error: new Error("bad code") });

    const response = await callback("?code=abc");
    expect(new URL(response.headers.get("location")!).searchParams.get("error")).toBe("code");
  });

  it("redirects to login with error=code when the exchange throws", async () => {
    boundary.exchangeCodeForSession.mockRejectedValue(new Error("network"));

    const response = await callback("?code=abc");
    expect(new URL(response.headers.get("location")!).pathname).toBe("/auth/login");
    expect(new URL(response.headers.get("location")!).searchParams.get("error")).toBe("code");
  });

  it("sends a signed-in user to /dashboard by default", async () => {
    boundary.exchangeCodeForSession.mockResolvedValue({ data: { session: { access_token: "t" } }, error: null });

    const response = await callback("?code=abc");
    expect(response.headers.get("location")).toBe(`${ORIGIN}/dashboard`);
  });

  it("honours a same-origin next path", async () => {
    boundary.exchangeCodeForSession.mockResolvedValue({ data: { session: { access_token: "t" } }, error: null });

    const response = await callback("?code=abc&next=/admin");
    expect(response.headers.get("location")).toBe(`${ORIGIN}/admin`);
  });

  it("never redirects to an external next target", async () => {
    boundary.exchangeCodeForSession.mockResolvedValue({ data: { session: { access_token: "t" } }, error: null });

    const response = await callback("?code=abc&next=https://evil.example/steal");
    expect(response.headers.get("location")).toBe(`${ORIGIN}/dashboard`);
  });

  it("passes the flow id to the exchange when sb_flow_id is present", async () => {
    boundary.exchangeCodeForSession.mockResolvedValue({ data: { session: { access_token: "t" } }, error: null });

    await callback("?code=abc&sb_flow_id=flow-1");
    expect(boundary.exchangeCodeForSession).toHaveBeenCalledWith("abc", { flowId: "flow-1" });
  });

  it("copies Supabase session cookies onto the redirect response", async () => {
    boundary.exchangeCodeForSession.mockResolvedValue({ data: { session: { access_token: "t" } }, error: null });
    boundary.cookiesGetAll.mockReturnValue([{ name: "sb-session", value: "opaque" }]);

    const response = await callback("?code=abc");
    expect(response.cookies.get("sb-session")?.value).toBe("opaque");
  });
});
