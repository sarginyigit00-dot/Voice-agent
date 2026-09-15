"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { useLang } from "@/components/i18n/language-provider";
import { useSession } from "@/components/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { fetchKnowledge, saveKnowledgeRemote } from "@/lib/clinics/knowledge-queries";
import {
  DEMO_KNOWLEDGE,
  EMPTY_KNOWLEDGE,
  KNOWLEDGE_LIMITS,
  type ClinicKnowledge,
} from "@/lib/clinics/knowledge-shape";

/**
 * /klinik — the clinic's own facts: services with prices, doctors, address,
 * FAQ. Every agent answers from these (lib/agents/prompt.ts → "# Klinik
 * bilgileri"); saving re-pushes the clinic's live agents to Vapi, so a price
 * change is on the phone line within seconds.
 */

type ServiceRow = { k: number; name: string; specialty: string; price: string; durationMin: string; description: string };
type DoctorRow = { k: number; title: string; name: string; specialty: string; notes: string };

let nextKey = 1;
const key = () => nextKey++;

function toRows(k: ClinicKnowledge) {
  return {
    services: k.services.map<ServiceRow>((s) => ({
      k: key(),
      name: s.name,
      specialty: s.specialty,
      price: s.price === null ? "" : String(s.price),
      durationMin: s.durationMin === null ? "" : String(s.durationMin),
      description: s.description,
    })),
    doctors: k.doctors.map<DoctorRow>((d) => ({ k: key(), title: d.title, name: d.name, specialty: d.specialty, notes: d.notes })),
    address: k.address,
    faq: k.faq,
  };
}

function fromRows(services: ServiceRow[], doctors: DoctorRow[], address: string, faq: string) {
  return {
    services: services.map((s) => ({
      name: s.name,
      specialty: s.specialty,
      price: s.price.trim() === "" ? null : s.price,
      durationMin: s.durationMin.trim() === "" ? null : s.durationMin,
      description: s.description,
    })),
    doctors: doctors.map(({ title, name, specialty, notes }) => ({ title, name, specialty, notes })),
    address,
    faq,
  } as unknown as ClinicKnowledge;
}

const TITLES = ["Dt.", "Dr.", "Uzm. Dt.", "Uzm. Dr.", "Doç. Dr.", "Prof. Dr.", "Psk.", "Dyt.", "Fzt.", "Vet. Hek."];

const inputCls =
  "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[12.5px] outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-violet/60";

export default function ClinicInfoPage() {
  const { lang } = useLang();
  const { demo } = useSession();
  const live = isSupabaseConfigured && !demo;
  const tr = lang === "tr";

  const [loaded, setLoaded] = useState(false);
  const [isDemoData, setIsDemoData] = useState(false);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [address, setAddress] = useState("");
  const [faq, setFaq] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null);

  const apply = (k: ClinicKnowledge) => {
    const r = toRows(k);
    setServices(r.services);
    setDoctors(r.doctors);
    setAddress(r.address);
    setFaq(r.faq);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      if (live) {
        const k = await fetchKnowledge();
        if (!alive) return;
        if (k) {
          apply(k);
          setIsDemoData(false);
          setLoaded(true);
          return;
        }
      }
      if (!alive) return;
      apply(live ? EMPTY_KNOWLEDGE : DEMO_KNOWLEDGE);
      setIsDemoData(!live);
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, [live]);

  const L = {
    title: tr ? "Klinik bilgileri" : "Clinic info",
    sub: tr
      ? "Asistan hizmet, fiyat, doktor ve adres sorularını yalnızca buradaki bilgilerle cevaplar."
      : "The agent answers questions about services, prices, doctors and the address only from what's here.",
    demoBadge: tr ? "Demo verisi" : "Demo data",
    demoHint: tr ? "Demo modda kaydedilemez." : "Saving is disabled in demo mode.",
    services: tr ? "Hizmetler" : "Services",
    servicesHint: tr ? "Fiyatı boş bırakırsanız asistan \"fiyat muayene sonrası belirlenir\" der." : "Leave the price empty and the agent says it is quoted after an examination.",
    serviceName: tr ? "Hizmet adı" : "Service",
    specialty: tr ? "Uzmanlık" : "Specialty",
    price: tr ? "Fiyat (₺)" : "Price (₺)",
    duration: tr ? "Süre (dk)" : "Minutes",
    description: tr ? "Açıklama (isteğe bağlı)" : "Description (optional)",
    addService: tr ? "Hizmet ekle" : "Add service",
    doctors: tr ? "Doktorlar" : "Doctors",
    title2: tr ? "Unvan" : "Title",
    name: tr ? "Ad soyad" : "Full name",
    notes: tr ? "Not (ör. hangi günler klinikte)" : "Note (e.g. which days in)",
    addDoctor: tr ? "Doktor ekle" : "Add doctor",
    address: tr ? "Adres ve ulaşım" : "Address and directions",
    faq: tr ? "Sık sorulanlar" : "FAQ",
    faqHint: tr ? "Her satıra bir soru ve cevabı yazın." : "One question and answer per line.",
    faqPlaceholder: tr
      ? "Otopark var mı? Binanın önünde ücretsiz otopark var.\nKredi kartı geçiyor mu? Evet, taksit de yapılabiliyor."
      : "Is there parking? Yes, free parking in front of the building.",
    remove: tr ? "Sil" : "Remove",
    save: tr ? "Kaydet ve asistana öğret" : "Save and teach the agent",
    saving: tr ? "Kaydediliyor…" : "Saving…",
    unsaved: tr ? "Kaydedilmemiş değişiklik var" : "Unsaved changes",
    loading: tr ? "Yükleniyor…" : "Loading…",
    empty: tr ? "Henüz eklenmedi." : "Nothing added yet.",
  };

  const touch = () => {
    setDirty(true);
    setNotice(null);
  };

  const setService = (k: number, patch: Partial<ServiceRow>) => {
    setServices((list) => list.map((s) => (s.k === k ? { ...s, ...patch } : s)));
    touch();
  };
  const setDoctor = (k: number, patch: Partial<DoctorRow>) => {
    setDoctors((list) => list.map((d) => (d.k === k ? { ...d, ...patch } : d)));
    touch();
  };

  const handleSave = async () => {
    if (isDemoData) {
      setNotice({ tone: "warn", text: L.demoHint });
      return;
    }
    setSaving(true);
    setNotice(null);
    const result = await saveKnowledgeRemote(fromRows(services, doctors, address, faq));
    setSaving(false);

    if (!result.ok) {
      setNotice({ tone: "error", text: result.error ?? (tr ? "Kaydedilemedi." : "Could not save.") });
      return;
    }
    if (result.knowledge) apply(result.knowledge);
    setDirty(false);

    const failed = result.failed ?? [];
    if (failed.length) {
      setNotice({
        tone: "warn",
        text:
          (tr ? "Kaydedildi, ama şu ajanlar güncellenemedi: " : "Saved, but these agents could not be updated: ") +
          failed.map((f) => `${f.name} (${f.message})`).join(", "),
      });
    } else {
      setNotice({
        tone: "ok",
        text: result.synced
          ? tr
            ? `Kaydedildi. ${result.synced} ajan yeni bilgilerle güncellendi.`
            : `Saved. ${result.synced} agent(s) updated with the new facts.`
          : tr
            ? "Kaydedildi. Vapi'ye kurulu ajan olmadığı için telefon hattı henüz değişmedi."
            : "Saved. No agent is live in Vapi yet, so the phone line is unchanged.",
      });
    }
  };

  const noticeColor = notice?.tone === "ok" ? "var(--color-booked)" : notice?.tone === "warn" ? "var(--color-voicemail)" : "var(--color-destructive)";

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-4 p-3 pb-24 sm:p-4 sm:pb-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[20px] font-bold tracking-tight">{L.title}</h1>
          <p className="text-[13px] text-muted-foreground">{L.sub}</p>
        </div>
        {isDemoData && (
          <span className="rounded px-2 py-1 font-mono text-[10px] uppercase tracking-wider" style={{ background: "var(--color-muted)", color: "var(--color-muted-foreground)" }}>
            {L.demoBadge}
          </span>
        )}
      </div>

      {!loaded ? (
        <p className="py-8 text-center text-[12.5px] text-muted-foreground">{L.loading}</p>
      ) : (
        <>
          {/* services */}
          <section className="rounded-lg border border-border bg-card/30 p-3 sm:p-4">
            <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="flex items-center gap-2 text-[14px] font-semibold">
                <Icon name="list" className="h-4 w-4 text-violet" />
                {L.services}
                <span className="font-mono text-[11px] text-muted-foreground">{services.length}</span>
              </h2>
              <p className="text-[11.5px] text-muted-foreground">{L.servicesHint}</p>
            </header>

            {services.length === 0 && <p className="py-2 text-[12px] text-muted-foreground">{L.empty}</p>}

            <ul className="space-y-2">
              {services.map((s) => (
                <li key={s.k} className="rounded-md border border-border/70 p-2">
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-[1.4fr_1fr_110px_90px_32px]">
                    <input className={`${inputCls} col-span-2 md:col-span-1`} placeholder={L.serviceName} value={s.name} maxLength={KNOWLEDGE_LIMITS.field} onChange={(e) => setService(s.k, { name: e.target.value })} />
                    <input className={`${inputCls} col-span-2 md:col-span-1`} placeholder={L.specialty} value={s.specialty} maxLength={KNOWLEDGE_LIMITS.field} onChange={(e) => setService(s.k, { specialty: e.target.value })} />
                    <input className={inputCls} placeholder={L.price} inputMode="decimal" value={s.price} onChange={(e) => setService(s.k, { price: e.target.value })} />
                    <input className={inputCls} placeholder={L.duration} inputMode="numeric" value={s.durationMin} onChange={(e) => setService(s.k, { durationMin: e.target.value })} />
                    <button
                      onClick={() => {
                        setServices((list) => list.filter((x) => x.k !== s.k));
                        touch();
                      }}
                      aria-label={L.remove}
                      title={L.remove}
                      className="col-span-2 grid h-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground md:col-span-1"
                    >
                      <Icon name="trash-2" className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <input className={`${inputCls} mt-2`} placeholder={L.description} value={s.description} maxLength={KNOWLEDGE_LIMITS.description} onChange={(e) => setService(s.k, { description: e.target.value })} />
                </li>
              ))}
            </ul>

            <button
              onClick={() => {
                setServices((list) => [...list, { k: key(), name: "", specialty: "", price: "", durationMin: "", description: "" }]);
                touch();
              }}
              disabled={services.length >= KNOWLEDGE_LIMITS.services}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-1.5 text-[12px] text-muted-foreground transition-colors hover:border-violet/50 hover:text-violet disabled:opacity-50"
            >
              <Icon name="plus" className="h-3.5 w-3.5" />
              {L.addService}
            </button>
          </section>

          {/* doctors */}
          <section className="rounded-lg border border-border bg-card/30 p-3 sm:p-4">
            <header className="mb-3">
              <h2 className="flex items-center gap-2 text-[14px] font-semibold">
                <Icon name="user-round" className="h-4 w-4 text-violet" />
                {L.doctors}
                <span className="font-mono text-[11px] text-muted-foreground">{doctors.length}</span>
              </h2>
            </header>

            {doctors.length === 0 && <p className="py-2 text-[12px] text-muted-foreground">{L.empty}</p>}

            <ul className="space-y-2">
              {doctors.map((d) => (
                <li key={d.k} className="grid grid-cols-2 gap-2 rounded-md border border-border/70 p-2 md:grid-cols-[120px_1.2fr_1fr_1.4fr_32px]">
                  <select className={inputCls} value={TITLES.includes(d.title) || !d.title ? d.title : ""} onChange={(e) => setDoctor(d.k, { title: e.target.value })} aria-label={L.title2}>
                    <option value="">{L.title2}</option>
                    {TITLES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <input className={inputCls} placeholder={L.name} value={d.name} maxLength={KNOWLEDGE_LIMITS.field} onChange={(e) => setDoctor(d.k, { name: e.target.value })} />
                  <input className={`${inputCls} col-span-2 md:col-span-1`} placeholder={L.specialty} value={d.specialty} maxLength={KNOWLEDGE_LIMITS.field} onChange={(e) => setDoctor(d.k, { specialty: e.target.value })} />
                  <input className={`${inputCls} col-span-2 md:col-span-1`} placeholder={L.notes} value={d.notes} maxLength={KNOWLEDGE_LIMITS.description} onChange={(e) => setDoctor(d.k, { notes: e.target.value })} />
                  <button
                    onClick={() => {
                      setDoctors((list) => list.filter((x) => x.k !== d.k));
                      touch();
                    }}
                    aria-label={L.remove}
                    title={L.remove}
                    className="col-span-2 grid h-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground md:col-span-1"
                  >
                    <Icon name="trash-2" className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>

            <button
              onClick={() => {
                setDoctors((list) => [...list, { k: key(), title: "Dt.", name: "", specialty: "", notes: "" }]);
                touch();
              }}
              disabled={doctors.length >= KNOWLEDGE_LIMITS.doctors}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-1.5 text-[12px] text-muted-foreground transition-colors hover:border-violet/50 hover:text-violet disabled:opacity-50"
            >
              <Icon name="plus" className="h-3.5 w-3.5" />
              {L.addDoctor}
            </button>
          </section>

          {/* address + faq */}
          <section className="grid gap-4 md:grid-cols-2">
            <label className="block rounded-lg border border-border bg-card/30 p-3 sm:p-4">
              <span className="mb-2 flex items-center gap-2 text-[14px] font-semibold">
                <Icon name="map-pin" className="h-4 w-4 text-violet" />
                {L.address}
              </span>
              <textarea
                className={`${inputCls} min-h-[120px] resize-y`}
                value={address}
                maxLength={KNOWLEDGE_LIMITS.address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  touch();
                }}
              />
            </label>
            <label className="block rounded-lg border border-border bg-card/30 p-3 sm:p-4">
              <span className="mb-1 flex items-center gap-2 text-[14px] font-semibold">
                <Icon name="message-circle-question" className="h-4 w-4 text-violet" />
                {L.faq}
              </span>
              <span className="mb-2 block text-[11.5px] text-muted-foreground">{L.faqHint}</span>
              <textarea
                className={`${inputCls} min-h-[120px] resize-y`}
                placeholder={L.faqPlaceholder}
                value={faq}
                maxLength={KNOWLEDGE_LIMITS.faq}
                onChange={(e) => {
                  setFaq(e.target.value);
                  touch();
                }}
              />
            </label>
          </section>

          {notice && (
            <p className="rounded-md border px-3 py-2 text-[12px]" style={{ borderColor: `color-mix(in oklch, ${noticeColor} 40%, transparent)`, color: noticeColor }}>
              {notice.text}
            </p>
          )}

          {/* save bar */}
          <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-end gap-3 rounded-lg border border-border bg-card/95 px-3 py-2 backdrop-blur">
            {dirty && <span className="mr-auto font-mono text-[11px] text-muted-foreground">{L.unsaved}</span>}
            {isDemoData && <span className="mr-auto text-[11px] text-muted-foreground">{L.demoHint}</span>}
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md bg-violet px-4 py-2 text-[12.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              <Icon name="save" className="h-3.5 w-3.5" />
              {saving ? L.saving : L.save}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
