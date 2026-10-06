import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gizlilik ve KVKK — Randevox",
  description: "Randevox'un kişisel verileri nasıl işlediği: veri sorumlusu, veri işleyen, KVKK ve saklama.",
  alternates: { canonical: "/gizlilik" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
