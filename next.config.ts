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

// React's dev runtime (eval-based stack reconstruction) and Turbopack's HMR
// script loader assign raw strings to script sinks, so Trusted Types cannot be
// enforced in development. Report violations instead; enforce in production.
const trustedTypesDirectives = [
  "require-trusted-types-for 'script'",
  "trusted-types nextjs",
];

const securityHeaders = isDev
  ? [
      { key: "Content-Security-Policy", value: baseDirectives.join("; ") },
      {
        key: "Content-Security-Policy-Report-Only",
        value: trustedTypesDirectives.join("; "),
      },
    ]
  : [
      {
        key: "Content-Security-Policy",
        value: [...baseDirectives, ...trustedTypesDirectives].join("; "),
      },
    ];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
