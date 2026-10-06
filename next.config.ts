import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  // One canonical origin. Google sign-in (GIS) checks the page origin against
  // the OAuth client's allow-list, and sessions live in per-origin storage —
  // so the bare domain must never serve the app on its own.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
        ],
      },
      // Admin and demo surfaces stay out of search results.
      ...[
        "/admin/:path*",
        "/demo/:path*",
        "/login",
        "/dashboard/:path*",
        "/agents/:path*",
        "/calls/:path*",
        "/crm/:path*",
        "/klinik/:path*",
        "/randevular/:path*",
        "/settings/:path*",
      ].map((source) => ({
        source,
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      })),
    ];
  },
  async redirects() {
    return [
      // The retired "Haberim olsun" waitlist page — old links go to the demo form.
      { source: "/on-kayit", destination: "/demo-talep", permanent: true },
      {
        source: "/:path*",
        has: [{ type: "host", value: "randevoxai.com" }],
        destination: "https://www.randevoxai.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
