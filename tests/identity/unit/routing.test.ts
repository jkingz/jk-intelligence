import { describe, expect, it } from "vitest";
import { resolveProxyAction } from "@/lib/auth/routing";

describe("resolveProxyAction", () => {
  it("passes public auth pages without a session", () => {
    expect(resolveProxyAction("/auth/login", false)).toEqual({ type: "pass" });
    expect(resolveProxyAction("/auth/callback", false)).toEqual({ type: "pass" });
    expect(resolveProxyAction("/auth/other", false)).toEqual({ type: "pass" });
  });

  it("allows the OAuth callback even with a session", () => {
    expect(resolveProxyAction("/auth/callback", true)).toEqual({ type: "pass" });
  });

  it("redirects authenticated users away from login", () => {
    expect(resolveProxyAction("/auth/login", true)).toEqual({
      type: "redirect-home",
    });
  });

  it("passes the public landing route to anonymous users", () => {
    expect(resolveProxyAction("/", false)).toEqual({ type: "pass" });
  });

  it("redirects authenticated users away from the landing route", () => {
    expect(resolveProxyAction("/", true)).toEqual({ type: "redirect-home" });
  });

  it("sends unauthenticated users to login, remembering the target path", () => {
    expect(resolveProxyAction("/dashboard", false)).toEqual({
      type: "redirect-login",
      next: "/dashboard",
    });
    expect(resolveProxyAction("/profile", false)).toEqual({
      type: "redirect-login",
      next: "/profile",
    });
  });

  it("passes protected routes for authenticated users", () => {
    expect(resolveProxyAction("/dashboard", true)).toEqual({ type: "pass" });
    expect(resolveProxyAction("/profile", true)).toEqual({ type: "pass" });
  });
});