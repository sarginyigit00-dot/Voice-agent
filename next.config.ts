import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  // One canonical origin. Google sign-in (GIS) checks the page origin against
  // the OAuth client's allow-list, and sessions live in per-origin storage —
  // so the bare domain must never serve the app on its own.
  async redirects() {
    return [
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
