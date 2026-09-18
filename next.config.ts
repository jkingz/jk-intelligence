import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const baseDirectives = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  isDev
    ? "connect-src 'self' ws: wss: https:"
    : "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
];

// Trusted Types enforcement (`require-trusted-types-for 'script'`) is not
// viable: the Next.js client router re-creates head <script>/<link> elements on
// route transitions, and React DOM parses scripts through an HTML sink
// (`div.innerHTML = "<script></script>"`) and assigns script.src. Enforcing the
// directive blocks those sinks and breaks client-side navigation in production
// ("This document requires 'TrustedHTML'/'TrustedScriptURL' assignment").
// Keep only the narrow `trusted-types nextjs` policy allowlist (defense in
// depth against injected `createPolicy` calls); do not require sink types.
// Development separately observes the blocked-by-enforcement cases in
// report-only mode.
const trustedTypesDirective = "trusted-types nextjs";

const securityHeaders = isDev
  ? [
      { key: "Content-Security-Policy", value: baseDirectives.join("; ") },
      {
        key: "Content-Security-Policy-Report-Only",
        value: ["require-trusted-types-for 'script'", trustedTypesDirective].join("; "),
      },
    ]
  : [
      {
        key: "Content-Security-Policy",
        value: [...baseDirectives, trustedTypesDirective].join("; "),
      },
    ];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
