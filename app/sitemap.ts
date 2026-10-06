import type { MetadataRoute } from "next";

const BASE = "https://www.randevoxai.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/demo-talep", "/gizlilik", "/sartlar"].map((path) => ({
    url: `${BASE}${path}`,
    changeFrequency: "monthly",
    priority: path === "" ? 1 : 0.5,
  }));
}
