"use client";

import { LegalDoc, type DocSection } from "@/components/marketing/legal-doc";

// Mirrors Hizmet Sözleşmesi 5.x / 6.2 / 7.5 (lib/contracts/text.ts). If those change, update this page too.
const SECTIONS: DocSection[] = [
  {
    title: { tr: "1. Hizmetin niteliği", en: "1. Nature of the service" },
    body: [
      {
        tr: "Randevox fiziksel bir ürün değil, dijital bir abonelik hizmetidir: kliniğe gelen telefonları karşılayan yapay zekâ asistanı, randevu takvimi bağlantısı ve klinik paneli. Hizmet yalnızca kliniklere (işletmelere) sunulur; tüketicilere satış yapılmaz. Klinikle aramızdaki ilişkinin ayrıntıları panelde kabul edilen Hizmet Sözleşmesi'ndedir; bu sayfa onun özetidir, çelişki halinde sözleşme geçerlidir.",
        en: "Randevox is not a physical product but a digital subscription service: an AI assistant that answers the clinic's calls, a booking-calendar connection and a clinic panel. It is sold only to clinics (businesses), not to consumers. The details are in the Service Agreement accepted in the panel; this page summarises it, and the agreement prevails if they conflict.",
      },
    ],
  },
  {
    title: { tr: "2. Teslimat (kurulum)", en: "2. Delivery (setup)" },
    body: [
      {
        tr: "Teslimat, hizmetin kliniğiniz için kurulup çalışır hale getirilmesidir. Kurulum adımları:",
        en: "Delivery means setting the service up and getting it running for your clinic. The steps:",
      },
      {
        list: [
          { tr: "Kliniğiniz için hesap ve personel girişleri açılır; giriş bilgileri e-postayla iletilir.", en: "We open your clinic's account and staff sign-ins and send the login details by email." },
          { tr: "Klinik bilgileri (hizmetler, hekimler, çalışma saatleri, adres) panele girilir ve asistan bunlarla hazırlanır.", en: "Your clinic's details (services, doctors, opening hours, address) go into the panel and the assistant is prepared with them." },
          { tr: "Randevu takviminiz ve telefon hattınız bağlanır.", en: "Your booking calendar and phone line are connected." },
          { tr: "Yayına almadan önce asistanı kendi telefonunuzdan test edersiniz.", en: "You test the assistant from your own phone before it goes live." },
        ],
      },
      {
        tr: "Kurulum, gerekli bilgiler ve hat bağlantısı için operatör işlemleri tamamlandıktan sonra genellikle 1 hafta içinde biter. Operatörden veya kliniğin sağlaması gereken bilgilerden kaynaklanan gecikmeler bu süreye dahil değildir. Hizmetin durumunu, dakika kullanımını ve paketinizi panelden izleyebilirsiniz.",
        en: "Setup usually finishes within a week once the required details and the operator's line paperwork are done. Delays caused by the operator, or by information the clinic needs to provide, are not counted. You can follow the service status, minute usage and your package from the panel.",
      },
    ],
  },
  {
    title: { tr: "3. Ödeme", en: "3. Payment" },
    body: [
      {
        list: [
          { tr: "Paket ücreti aylıktır ve her takvim ayının başında peşin ödenir. İlk ay, başlangıç tarihinden ay sonuna kadar kalan günlerle orantılı faturalanır.", en: "The package fee is monthly and paid in advance at the start of each calendar month. The first month is billed pro rata from the start date to the month's end." },
          { tr: "Paket dakikasını aşan kullanım ay sonunda kesinleşir ve bir sonraki faturaya eklenir. Kullanılmayan dakikalar sonraki aya devretmez.", en: "Usage above the package minutes is settled at month end and added to the next invoice. Unused minutes don't roll over." },
          { tr: "Ödeme, ilettiğimiz ödeme bağlantısıyla yapılır. Kart bilgileriniz Randevox'ta saklanmaz; ödeme kuruluşu tarafından işlenir.", en: "Payment is made through the payment link we send. Your card details are not stored by Randevox; the payment provider processes them." },
          { tr: "Telefon hattı, operatör ve SMS ücretleri, aksi kararlaştırılmadıkça kliniğe aittir.", en: "Phone line, operator and SMS charges are the clinic's, unless agreed otherwise." },
        ],
      },
    ],
  },
  {
    title: { tr: "4. Deneme süresi", en: "4. Trial period" },
    body: [
      {
        tr: "Sözleşmenizde ücretsiz deneme süresi belirtilmişse bu sürede paket ücreti alınmaz. Deneme bitmeden yazılı olarak (e-posta dahil) bildirirseniz sözleşme ek bir ücret doğmadan sona erer. Kurulum ücreti alınmışsa bu ücret kurulum çalışmalarına başlanmadan önce peşin ödenir; hizmete devam ederseniz ilk paket faturanızdan düşülür.",
        en: "If your agreement includes a free trial, no package fee is charged during it. If you notify us in writing (email counts) before the trial ends, the agreement ends with no further charge. If a setup fee applies, it is paid in advance before setup work starts, and is deducted from your first package invoice if you continue.",
      },
    ],
  },
  {
    title: { tr: "5. İade", en: "5. Refunds" },
    body: [
      {
        list: [
          { tr: "Hizmet dijitaldir ve ödendiği dönemin başından itibaren kullanıma açıktır; bu nedenle ödenmiş dönem için iade yapılmaz.", en: "The service is digital and available from the start of the paid period, so paid periods are not refunded." },
          { tr: "Kurulum ücreti, kurulum çalışmalarına başlandıktan sonra iade edilmez.", en: "The setup fee is not refunded once setup work has started." },
          { tr: "Randevox'tan kaynaklanan ve bir fatura döneminde toplam 48 saati aşan kesintilerde, o dönemin ücretinden kesinti süresiyle orantılı indirim talep edebilirsiniz. Planlı bakım ile kliniğin ve üçüncü taraf altyapı sağlayıcılarının (ör. telefon operatörü) kesintileri bu hesaba katılmaz.", en: "For outages caused by Randevox that exceed 48 hours in total in a billing period, you can request a discount on that period's fee proportional to the outage. Planned maintenance and outages caused by the clinic or third-party infrastructure (e.g. the phone operator) are not counted." },
          { tr: "Hatalı veya mükerrer çekim olduğunu düşünüyorsanız bize yazın; inceleyip haklı bulunan tutarı aynı ödeme yöntemiyle iade ederiz.", en: "If you believe you were charged in error or twice, write to us; we will review it and refund any amount found due through the same payment method." },
        ],
      },
    ],
  },
  {
    title: { tr: "6. Abonelik iptali", en: "6. Cancelling the subscription" },
    body: [
      {
        tr: "Aboneliği, içinde bulunulan ayın bitiminden en az 7 gün önce info@randevoxai.com adresine e-postayla bildirerek ay sonu itibarıyla sonlandırabilirsiniz. İptalden sonra ödenmiş ayın sonuna kadar hizmeti kullanmaya devam edersiniz; sonraki ay için ücret alınmaz. Hesap kapandığında verileriniz 30 gün içinde size iade edilir veya silinir.",
        en: "You can end the subscription at the end of a month by emailing info@randevoxai.com at least 7 days before that month ends. After cancelling you keep using the service until the end of the paid month; the next month isn't charged. When the account closes, your data is returned to you or deleted within 30 days.",
      },
    ],
  },
  {
    title: { tr: "7. İletişim", en: "7. Contact" },
    body: [
      {
        tr: "Teslimat, fatura ve iade ile ilgili tüm talepleriniz için: info@randevoxai.com",
        en: "For anything about delivery, invoices or refunds: info@randevoxai.com",
      },
    ],
  },
];

export default function RefundPage() {
  return (
    <LegalDoc
      title={{ tr: "Teslimat ve İade Şartları", en: "Delivery & Refund Terms" }}
      updated={{ tr: "Son güncelleme: 21 Kasım 2026", en: "Last updated: November 21, 2026" }}
      sections={SECTIONS}
    />
  );
}
