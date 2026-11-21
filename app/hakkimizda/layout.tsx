import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hakkımızda — Randevox",
  description: "Randevox: diş klinikleri için 7/24 yapay zekâ telefon asistanı.",
  alternates: { canonical: "/hakkimizda" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
