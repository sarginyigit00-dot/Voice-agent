import type { MetadataRoute } from "next";

const BASE = "https://www.randevoxai.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/demo", "/login", "/dashboard"] }],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
