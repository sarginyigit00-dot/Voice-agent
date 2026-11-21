"use client";

import Link from "next/link";
import { useLang } from "@/components/i18n/language-provider";
import { LegalDoc, type DocSection } from "@/components/marketing/legal-doc";

// No people's names, photos or invented numbers here on purpose.
const SECTIONS: DocSection[] = [
  {
    title: { tr: "Ne yapıyoruz", en: "What we do" },
    body: [
      {
        tr: "Randevox, diş kliniklerinin telefonunu 7/24 açan bir yapay zekâ asistanıdır. Hastanın sorusunu Türkçe ve doğal bir dille yanıtlar, uygun saati takvimden okuyup randevuyu yazar, çözemediği aramayı klinikteki bir kişiye aktarır. Her görüşmenin kaydı, dökümü ve özeti kliniğin panelinde durur.",
        en: "Randevox is an AI assistant that answers dental clinics' phones 24/7. It answers patients' questions in natural Turkish, reads free slots from the calendar and books the appointment, and hands calls it can't resolve to a person at the clinic. Every call's recording, transcript and summary sits in the clinic's panel.",
      },
    ],
  },
  {
    title: { tr: "Neden", en: "Why" },
    body: [
      {
        tr: "Kliniklerde telefon en yoğun saatlerde, hekim koltuktayken ve mesai bittikten sonra çalar. Açılmayan her arama, büyük ihtimalle başka bir kliniğe giden bir hastadır. Sekreterin işini ortadan kaldırmak değil, onun yetişemediği aramaları karşılamak istiyoruz.",
        en: "Clinic phones ring hardest at peak hours, while the dentist is chairside, and after closing. Every unanswered call is most likely a patient who goes to another clinic. We don't want to replace the receptionist; we want to catch the calls they can't reach.",
      },
    ],
  },
  {
    title: { tr: "Nasıl çalışıyoruz", en: "How we work" },
    body: [
      {
        list: [
          { tr: "Yalnızca diş klinikleri: asistan diş tedavileri, hekimler, fiyatlar ve randevu üzerine kurulu.", en: "Dental clinics only: the assistant is built around dental treatments, dentists, prices and bookings." },
          { tr: "Anahtar teslim kurulum: hattı, takvimi ve asistanı biz kurarız; yayına almadan önce siz test edersiniz.", en: "Turnkey setup: we set up the line, the calendar and the assistant; you test before it goes live." },
          { tr: "Kliniğe özel: asistan sizin hizmetlerinizi, hekimlerinizi ve çalışma saatlerinizi bilir; bunları panelden siz güncellersiniz.", en: "Clinic-specific: the assistant knows your services, dentists and hours, and you update them from the panel." },
        ],
      },
    ],
  },
  {
    title: { tr: "İlkelerimiz", en: "Our principles" },
    body: [
      {
        list: [
          { tr: "Şeffaflık: asistan her aramada yapay zekâ olduğunu ve görüşmenin kaydedildiğini söyler.", en: "Transparency: on every call the assistant says it's an AI and that the call is recorded." },
          { tr: "Gizlilik: hastaların verisi yalnızca o kliniğindir; kayıtlar 14 gün içinde silinir.", en: "Privacy: patients' data belongs only to their clinic; recordings are deleted within 14 days." },
          { tr: "İnsan her zaman devrede: asistan teşhis koymaz, hekimin yerine geçmez; gerektiğinde aramayı size aktarır.", en: "A human stays in the loop: the assistant doesn't diagnose or replace the dentist, and transfers the call to you when needed." },
          { tr: "Sadece gelen aramalar: asistan hiçbir zaman hastaları kendisi aramaz.", en: "Inbound only: the assistant never calls patients itself." },
        ],
      },
    ],
  },
];

export default function AboutPage() {
  const { lang } = useLang();
  const tr = lang === "tr";
  return (
    <LegalDoc
      eyebrow={{ tr: "Şirket", en: "Company" }}
      title={{ tr: "Hakkımızda", en: "About us" }}
      intro={{
        tr: "Diş kliniklerinde hiçbir hasta aramasının cevapsız kalmaması için çalışıyoruz.",
        en: "We work so that no patient's call to a dental clinic goes unanswered.",
      }}
      sections={SECTIONS}
    >
      <div className="mt-12 flex flex-col gap-3 border-t border-border pt-8 sm:flex-row">
        <Link href="/demo-talep" className="ed-pill ed-pill-primary px-7 text-[15px]" style={{ height: 52 }}>
          {tr ? "Kliniğinizde deneyin" : "Try it in your clinic"}
        </Link>
        <Link href="/iletisim" className="ed-pill ed-pill-ghost px-7 text-[15px]" style={{ height: 52 }}>
          {tr ? "Bize ulaşın" : "Contact us"}
        </Link>
      </div>
    </LegalDoc>
  );
}
