import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Güvenlik ve KVKK — Randevox",
  description: "Randevox klinik ve hasta verilerini nasıl korur, nerede tutar ve ne zaman siler.",
  alternates: { canonical: "/guvenlik" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
