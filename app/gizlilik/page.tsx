"use client";

import { useLang } from "@/components/i18n/language-provider";
import { LegalShell } from "../legal-shell";

type LL = { tr: string; en: string };

const SECTIONS: { title: LL; body: LL[] }[] = [
  {
    title: { tr: "1. Hangi verileri işliyoruz", en: "1. What data we process" },
    body: [
      {
        tr: "Hesap bilgilerinizi (ad, e-posta), kliniğinizin ayarlarını, ajan yapılandırmalarını ve ajanınızın aldığı çağrılara ait arayan bilgilerini (ad, telefon, e-posta), çağrı transkriptlerini, çağrı kayıtlarını (etkinleştirdiyseniz) ve randevu kayıtlarını işleriz.",
        en: "We process your account information (name, email), your clinic's settings, agent configurations, and — for calls your agent handles — caller details (name, phone, email), call transcripts, call recordings (if you enable them), and appointment records.",
      },
    ],
  },
  {
    title: { tr: "2. Sağlık verisi ve KVKK", en: "2. Health data and KVKK" },
    body: [
      {
        tr: "Kliniğiniz sağlık hizmeti verdiği için, arayanların paylaştığı bilgiler özel nitelikli kişisel veri (sağlık verisi) sayılabilir. Bu verilerin işlenmesinden ve arayanlara KVKK kapsamında aydınlatma yapılmasından veri sorumlusu sıfatıyla siz (klinik) sorumlusunuz; biz veri işleyen sıfatıyla sadece sizin talimatlarınız doğrultusunda işleriz. Arama başında okutmak üzere kendi aydınlatma metninizi ajan talimatlarınıza ekleyebilirsiniz.",
        en: "Because your clinic provides healthcare, information callers share may qualify as special-category personal data (health data). As the data controller, your clinic is responsible for processing this data lawfully and informing callers (e.g. under Turkey's KVKK); we act only as a data processor, on your instructions. You can add your own disclosure text to your agent's instructions to be read at the start of a call.",
      },
    ],
  },
  {
    title: { tr: "3. Verileri nasıl kullanıyoruz", en: "3. How we use the data" },
    body: [
      {
        tr: "Verileri yalnızca hizmeti sunmak (çağrıları yanıtlamak, randevu almak, panelinizde göstermek), hizmeti iyileştirmek ve yasal yükümlülüklerimizi yerine getirmek için kullanırız. Verilerinizi satmayız.",
        en: "We use data only to provide the service (answering calls, booking appointments, showing them in your panel), to improve the service, and to meet legal obligations. We do not sell your data.",
      },
    ],
  },
  {
    title: { tr: "4. Hukuki sebepler", en: "4. Legal grounds" },
    body: [
      {
        tr: "Hesap ve klinik verilerinizi sizinle yaptığımız sözleşmenin kurulması ve ifası (KVKK md. 5/2-c), hukuki yükümlülüklerimiz (md. 5/2-ç) ve hizmetin güvenliği ile iyileştirilmesine ilişkin meşru menfaatimiz (md. 5/2-f) kapsamında işleriz. Demo talep formundaki bilgileri, talebiniz üzerine size dönüş yapmak için işleriz (md. 5/2-c). Arayanların verileri bakımından hukuki sebep ve gerektiğinde açık rıza, veri sorumlusu olan kliniğin sorumluluğundadır.",
        en: "We process account and clinic data to enter into and perform our contract with you (KVKK art. 5/2-c), to meet legal obligations (art. 5/2-ç), and on our legitimate interest in securing and improving the service (art. 5/2-f). Demo-request details are used to get back to you at your request (art. 5/2-c). For callers' data, the legal ground — and explicit consent where needed — is the responsibility of the clinic as data controller.",
      },
    ],
  },
  {
    title: { tr: "5. Kiminle paylaşıyoruz", en: "5. Who we share it with" },
    body: [
      {
        tr: "Hizmeti çalıştırmak için kullandığımız alt işleyicilerle (telefon/ses altyapısı, büyük dil modeli sağlayıcısı, takvim entegrasyonu, veritabanı barındırma, SMS/WhatsApp ve e-posta bildirimleri) sınırlı ölçüde veri paylaşırız. Kendi CRM entegrasyonunuzu (ör. bir webhook) etkinleştirirseniz, çağrı verileri sizin belirttiğiniz o adrese de gönderilir.",
        en: "We share data on a limited basis with the sub-processors we use to run the service (telephony/voice infrastructure, the LLM provider, calendar integration, database hosting, SMS/WhatsApp and email notifications). If you enable your own CRM integration (e.g. a webhook), call data is also sent to the address you specify.",
      },
      {
        tr: "Ses altyapısı, büyük dil modeli ve veritabanı barındırma sağlayıcılarının sunucuları yurt dışında bulunduğundan, hesap ve çağrı verileri yurt dışına aktarılır.",
        en: "Because the voice infrastructure, LLM and database hosting providers' servers are located abroad, account and call data is transferred outside Türkiye.",
      },
    ],
  },
  {
    title: { tr: "6. Saklama süresi", en: "6. Retention" },
    body: [
      {
        tr: "Çağrı ses kayıtları 3 ay sonra, transkriptler, özetler ve arayanın adı ile telefonu 12 ay sonra otomatik olarak silinir; raporlar için yalnızca kişiyle ilişkilendirilemeyen istatistikler (tarih, süre, sonuç) kalır. Geri arama formu kayıtları da 12 ay sonra silinir. Panel kullanım kayıtları (hangi panel sayfasının hangi gün açıldığı) 6 ay sonra silinir. Randevu kayıtları, kliniğin takvimi için hesap kapanana kadar tutulur. Hesap kapandığında kalan veriler 30 gün içinde iade edilir veya silinir.",
        en: "Call recordings are deleted automatically after 3 months; transcripts, summaries and the caller's name and number after 12 months, leaving only non-identifying statistics (date, duration, outcome) for reports. Callback-form entries are also deleted after 12 months. Panel usage records (which panel page was opened on which day) are deleted after 6 months. Appointment records are kept for the clinic's calendar until the account is closed. When an account is closed, the remaining data is returned or deleted within 30 days.",
      },
    ],
  },
  {
    title: { tr: "7. Haklarınız", en: "7. Your rights" },
    body: [
      {
        tr: "KVKK md. 11 uyarınca; verilerinizin işlenip işlenmediğini öğrenme ve bilgi talep etme, işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme, yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme, eksik veya yanlış işlenmişse düzeltilmesini, KVKK md. 7 çerçevesinde silinmesini veya yok edilmesini ve bu işlemlerin aktarılan üçüncü kişilere bildirilmesini isteme, münhasıran otomatik sistemlerle analiz sonucu aleyhinize bir sonuca itiraz etme ve kanuna aykırı işleme nedeniyle uğradığınız zararın giderilmesini talep etme haklarına sahipsiniz.",
        en: "Under KVKK art. 11 you may: learn whether your data is processed and request information about it; learn the purpose of processing and whether data is used accordingly; know the third parties it is transferred to in Türkiye or abroad; request correction of incomplete or inaccurate data, and erasure or destruction under art. 7, and have these notified to recipients; object to an outcome against you arising solely from automated analysis; and claim compensation for damage caused by unlawful processing.",
      },
      {
        tr: `Taleplerinizi info@randevoxai.com adresine e-postayla iletebilirsiniz; en geç 30 gün içinde ücretsiz yanıtlarız. Bir kliniğin arayanıysanız, talebinizi veri sorumlusu olan o kliniğe iletmeniz gerekir; bize ulaşırsa kliniğe yönlendiririz.`,
        en: `Email requests to info@randevoxai.com; we answer free of charge within 30 days. If you called a clinic, direct your request to that clinic as the data controller; if it reaches us, we forward it to the clinic.`,
      },
    ],
  },
  {
    title: { tr: "8. Güvenlik", en: "8. Security" },
    body: [
      {
        tr: "Verileriniz erişim kontrolü ve şifreli bağlantılar (HTTPS) ile korunur. Hiçbir sistem %100 güvenli değildir; bir ihlal durumunda yasal yükümlülüklerimiz doğrultusunda bilgilendirme yaparız.",
        en: "Your data is protected with access controls and encrypted connections (HTTPS). No system is 100% secure; in the event of a breach we will notify as required by law.",
      },
      {
        tr: "Teknik destek gerektiğinde ve yalnızca sorunu gidermek amacıyla Randevox ekibi kliniğinizin paneline erişebilir. Bu erişim sırasında panelde \"Destek modu\" uyarısı görünür ve her erişim tarih ve saatiyle kayıt altına alınır.",
        en: "When technical support is needed, and only to resolve the issue, the Randevox team may access your clinic's panel. During such access the panel shows a \"Support mode\" notice, and every access is logged with its date and time.",
      },
    ],
  },
];

export default function V2PrivacyPage() {
  const { lang } = useLang();
  const tt = (v: LL) => v[lang];

  return (
    <LegalShell>
      <div className="mx-auto max-w-3xl px-5 py-16">
        <p className="font-mono-nums text-[11px] uppercase tracking-wider text-muted-foreground">
          {lang === "tr" ? "Yasal" : "Legal"}
        </p>
        <h1 className="mt-2 font-editorial text-4xl">{lang === "tr" ? "Gizlilik Politikası" : "Privacy Policy"}</h1>
        <p className="mt-3 text-[13px] text-muted-foreground">
          {lang === "tr" ? "Son güncelleme: 26 Ekim 2026" : "Last updated: October 26, 2026"}
        </p>

        <div className="mt-10 space-y-8">
          {SECTIONS.map((s) => (
            <section key={s.title.en} id={s.title.en === "2. Health data and KVKK" ? "kvkk" : undefined}>
              <h2 className="text-[15px] font-semibold text-foreground">{tt(s.title)}</h2>
              <div className="mt-2 space-y-3">
                {s.body.map((p, i) => (
                  <p key={i} className="text-[14px] leading-relaxed text-muted-foreground">
                    {tt(p)}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </LegalShell>
  );
}
