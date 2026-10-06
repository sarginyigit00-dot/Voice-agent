import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kullanım Şartları — Randevox",
  description: "Randevox hizmetinin kullanım şartları, faturalandırma ve sorumluluklar.",
  alternates: { canonical: "/sartlar" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
