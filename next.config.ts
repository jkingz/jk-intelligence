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
  // Response compression (gzip/brotli) on by default in Next; made explicit
  // and self-documenting for the Lighthouse "transfer size" audit rather than
  // relying on the implicit default.
  compress: true,
  // The PDF report embeds the vendored Unicode TTFs in `lib/exports/fonts` and
  // reads them from disk at render time. Trace static-analysis cannot see a
  // dynamic `readFile`, so the fonts are declared explicitly for serverless
  // deployment bundles.
  outputFileTracingIncludes: {
    "/api/exports/**": ["./lib/exports/fonts/*.ttf"],
  },
  experimental: {
    // Tree-shakes the re-export barrels of these two first-party libraries so
    // the dashboard entry only ships the icons/chart primitives actually used
    // on the route. Directly trims the "large first-party JavaScript" parse
    // byte Lighthouse measures (lucide-react exports hundreds of icons;
    // recharts re-exports every chart from one barrel).
    optimizePackageImports: ["lucide-react", "recharts"],
  },
  images: {
    // Only self-authored, script-free SVGs in this repo (Archify exports). SVG
    // is served unoptimized (vector, lossless) but `dangerouslyAllowSVG` is
    // still required for `next/image` to accept the source, and the CSP below
    // blocks any script inside the SVG from executing.
    dangerouslyAllowSVG: true,
    contentDispositionType: "inline",
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    formats: ['image/avif', 'image/webp'], // Modern formats first
    minimumCacheTTL: 60 * 60 * 24 * 365, // 1 year cache
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
