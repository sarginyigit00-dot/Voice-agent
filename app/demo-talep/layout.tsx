import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Demo talep et — Randevox",
  description: "Kliniğiniz için Randevox yapay zekâ telefon asistanının demosunu talep edin.",
  alternates: { canonical: "/demo-talep" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
