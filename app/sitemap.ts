import type { MetadataRoute } from "next";
import { WEB_TRIAL_LIVE } from "@/lib/marketing-flags";

const BASE = "https://www.randevoxai.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    "",
    "/demo-talep",
    "/hakkimizda",
    "/iletisim",
    "/guvenlik",
    "/gizlilik",
    "/sartlar",
    "/iade",
    ...(WEB_TRIAL_LIVE ? ["/acik-riza"] : []),
    "/ticari-ileti",
  ].map((path) => ({
    url: `${BASE}${path}`,
    changeFrequency: "monthly",
    priority: path === "" ? 1 : 0.5,
  }));
}
