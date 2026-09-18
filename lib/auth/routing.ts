export function safeNext(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return undefined;
  }
  if (value.includes("\\") || Array.from(value).some((char) => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127)) {
    return undefined;
  }
  try {
    const base = new URL("https://app.invalid");
    const url = new URL(value, base);
    return url.origin === base.origin ? `${url.pathname}${url.search}${url.hash}` : undefined;
  } catch {
    return undefined;
  }
}

export type ProxyAction =
  | { type: "pass" }
  | { type: "redirect-login"; next: string | undefined }
  | { type: "redirect-home" };

export function resolveProxyAction(path: string, hasSession: boolean): ProxyAction {
  if (path === "/auth/login") {
    return hasSession ? { type: "redirect-home" } : { type: "pass" };
  }
  if (path.startsWith("/auth/")) {
    return { type: "pass" };
  }
  if (!hasSession) {
    return { type: "redirect-login", next: path === "/" ? undefined : path };
  }
  return { type: "pass" };
}