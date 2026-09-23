import { describe, expect, it } from "vitest";

import { verifyCronSecret } from "@/lib/auth/cron";

function request(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/cron/sync", { headers });
}

describe("verifyCronSecret", () => {
  it("allows an exact bearer match", () => {
    expect(
      verifyCronSecret(request({ authorization: "Bearer sekret" }), "sekret"),
    ).toBe("ok");
  });

  it("denies a wrong secret", () => {
    expect(
      verifyCronSecret(request({ authorization: "Bearer nope" }), "sekret"),
    ).toBe("denied");
  });

  it("denies a missing (or malformed) authorization header", () => {
    expect(verifyCronSecret(request(), "sekret")).toBe("denied");
    expect(verifyCronSecret(request({ authorization: "sekret" }), "sekret")).toBe(
      "denied",
    );
  });

  it("reports unavailable when no secret is configured", () => {
    expect(verifyCronSecret(request({ authorization: "Bearer x" }), undefined)).toBe(
      "unavailable",
    );
    expect(verifyCronSecret(request({ authorization: "Bearer x" }), "")).toBe(
      "unavailable",
    );
  });
});