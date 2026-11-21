import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ticari Elektronik İleti Onayı — Randevox",
  description: "Randevox ticari elektronik ileti bilgilendirmesi ve onay metni.",
  alternates: { canonical: "/ticari-ileti" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
