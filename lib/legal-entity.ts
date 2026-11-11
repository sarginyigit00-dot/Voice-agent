/**
 * The legal identity of whoever operates Randevox — the one place to fill in
 * once a company exists. The footer, the Privacy Policy and Terms §1 read it.
 *
 * Every field starts empty on purpose: there is no company yet, and nothing
 * is shown for an empty field (no "[unvan]"-style placeholders on the site).
 * Fill a field and it appears in all three places on the next build.
 */
export interface LegalEntity {
  /** Ticaret unvanı */
  title: string;
  /** MERSİS numarası */
  mersis: string;
  /** Vergi kimlik numarası */
  taxNo: string;
  /** Vergi dairesi */
  taxOffice: string;
  /** Açık adres */
  address: string;
  /** KEP adresi */
  kep: string;
  /** İletişim e-postası */
  email: string;
}

// TODO(yasal): şirket kurulunca unvan, MERSİS, vergi no/dairesi, adres ve KEP doldurulacak.
export const LEGAL_ENTITY: LegalEntity = {
  title: "",
  mersis: "",
  taxNo: "",
  taxOffice: "",
  address: "",
  kep: "",
  email: "",
};

type LL = { tr: string; en: string };

const LABELS: Record<keyof LegalEntity, LL> = {
  title: { tr: "Unvan", en: "Company name" },
  mersis: { tr: "MERSİS No", en: "MERSIS No" },
  taxNo: { tr: "Vergi No", en: "Tax ID" },
  taxOffice: { tr: "Vergi Dairesi", en: "Tax office" },
  address: { tr: "Adres", en: "Address" },
  kep: { tr: "KEP", en: "Registered e-mail (KEP)" },
  email: { tr: "E-posta", en: "Email" },
};

/** Only the filled-in fields, labelled, in display order. Empty → []. */
export function legalEntityLines(lang: "tr" | "en", entity: LegalEntity = LEGAL_ENTITY): { key: keyof LegalEntity; label: string; value: string }[] {
  return (Object.keys(LABELS) as (keyof LegalEntity)[])
    .map((key) => ({ key, label: LABELS[key][lang], value: entity[key].trim() }))
    .filter((l) => l.value !== "");
}
