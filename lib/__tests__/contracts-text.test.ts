import { describe, expect, it } from "vitest";
import { contractsAsText, renderContracts, type ContractProvider, type ContractTerms } from "@/lib/contracts/text";

const terms: ContractTerms = {
  legalName: "Örnek Diş Ltd. Şti.",
  taxId: "Nilüfer VD / 1234567890",
  address: "Bursa",
  email: "info@ornek.com",
  monthlyFee: "499 USD",
  overageFee: "0,60 USD",
  setupFee: null,
  trialDays: 14,
  paymentMethod: "Ödeme bağlantısı (Ruul)",
  lineFeesBy: "clinic",
};
const provider: ContractProvider = {
  name: "Test Sağlayıcı",
  idNumber: null,
  address: "Test adresi",
  email: "info@randevoxai.com",
  court: "Bursa",
  guardianConsent: false,
};
const pkg = { id: "klinik", label: "Klinik", minutes: 300 };

describe("contracts/text", () => {
  it("leaves no paper blanks or placeholders", () => {
    const text = contractsAsText(renderContracts({ terms, provider, pkg }));
    expect(text).not.toMatch(/\.\.\.\.\./);
    expect(text).not.toContain("{{");
    expect(text).not.toMatch(/iki nüsha/);
  });

  it("fills the clinic's terms, the package and the court", () => {
    const text = contractsAsText(renderContracts({ terms, provider, pkg }));
    expect(text).toContain("Unvan: Örnek Diş Ltd. Şti.");
    expect(text).toContain("Aylık paket ücreti (KDV hariç): 499 USD");
    expect(text).toContain("Ücretsiz deneme süresi: 14 gün");
    expect(text).toContain("Seçilen paket: Klinik — aylık 300 dakika.");
    expect(text).toContain("Bursa mahkemeleri");
    expect(text).toContain("HMK md. 193");
  });

  it("states the setup fee as one-off and deducted from the first invoice", () => {
    const none = contractsAsText(renderContracts({ terms, provider, pkg }));
    const fee = contractsAsText(renderContracts({ terms: { ...terms, setupFee: "300 USD" }, provider, pkg }));
    expect(none).toMatch(/Kurulum ücreti \(tek seferlik[^)]*\): Yok/);
    expect(fee).toMatch(/ilk Paket faturasından düşülür\): 300 USD/);
    expect(fee).toContain("kurulum çalışmalarına başlandıktan sonra iade edilmez");
  });

  it("states the guardian's consent only when set", () => {
    const off = contractsAsText(renderContracts({ terms, provider, pkg }));
    const on = contractsAsText(renderContracts({ terms, provider: { ...provider, guardianConsent: true }, pkg }));
    expect(off).not.toContain("muvafakat");
    expect(on).toContain("yasal temsilcisinin yazılı muvafakatiyle");
  });

  it("changes with the terms, so new terms need a new acceptance", () => {
    const a = contractsAsText(renderContracts({ terms, provider, pkg }));
    const b = contractsAsText(renderContracts({ terms: { ...terms, monthlyFee: "599 USD" }, provider, pkg }));
    expect(a).not.toBe(b);
  });
});
