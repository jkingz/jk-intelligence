import { describe, expect, it } from "vitest";
import { resolveProxyAction } from "./routing";

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

  it("sends unauthenticated users to login, remembering the target path", () => {
    expect(resolveProxyAction("/admin", false)).toEqual({
      type: "redirect-login",
      next: "/admin",
    });
  });

  it("uses no next target for the root route", () => {
    expect(resolveProxyAction("/", false)).toEqual({
      type: "redirect-login",
      next: undefined,
    });
  });

  it("passes protected routes for authenticated users", () => {
    expect(resolveProxyAction("/", true)).toEqual({ type: "pass" });
    expect(resolveProxyAction("/admin", true)).toEqual({ type: "pass" });
  });
});