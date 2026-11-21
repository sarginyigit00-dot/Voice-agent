import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Açık Rıza Metni — Randevox",
  description: "Randevox web deneme görüşmeleri için KVKK açık rıza metni.",
  alternates: { canonical: "/acik-riza" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
