import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "İletişim — Randevox",
  description: "Randevox ile iletişime geçin: demo, destek ve KVKK başvuruları.",
  alternates: { canonical: "/iletisim" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
