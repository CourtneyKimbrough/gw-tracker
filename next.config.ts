import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    // Cache-Control for individual /api/v1 GET endpoints is set per-response in
    // src/lib/api-response.ts (jsonOk), not here — a blanket header at this level
    // would apply to mutating routes (POST /alerts, PATCH /me, ...) too, which must
    // never be cached.
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/internal/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
