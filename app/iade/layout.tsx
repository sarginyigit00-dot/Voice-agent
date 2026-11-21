import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Teslimat ve İade Şartları — Randevox",
  description: "Randevox aboneliğinin teslimat (kurulum), ödeme, iade ve iptal şartları.",
  alternates: { canonical: "/iade" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
