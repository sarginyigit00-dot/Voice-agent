"use client";

import { LegalDoc, type DocSection } from "@/components/marketing/legal-doc";

// Based on 6563 s. ETK m.6 and Ticari İletişim ve Ticari Elektronik İletiler
// Hakkında Yönetmelik m.6–7 (checked via Resmen, 2026-11-21). Randevox does
// not collect this consent anywhere yet; if a checkbox is ever added it must be
// optional, unticked, and the consent registered in İYS within 3 business days.
const SECTIONS: DocSection[] = [
  {
    title: { tr: "1. Bilgilendirme", en: "1. Information" },
    body: [
      {
        tr: "6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun uyarınca ticari elektronik ileti; telefon, çağrı merkezi, SMS, e-posta ve benzeri elektronik iletişim araçlarıyla, ticari amaçla gönderilen veri, ses ve görüntü içerikli iletilerdir. Bu iletiler, alıcının önceden verdiği onayla gönderilebilir. Onay yazılı olarak, her türlü elektronik iletişim aracıyla ya da İleti Yönetim Sistemi (İYS) üzerinden alınabilir.",
        en: "Under Turkey's E-Commerce Law No. 6563, a commercial electronic message is a message with data, voice or image content sent for commercial purposes by phone, call centre, SMS, email or similar electronic means. Such messages may be sent only with the recipient's prior consent, which can be given in writing, by any electronic means, or through the Message Management System (İYS).",
      },
      {
        tr: "Bize iletişim bilgilerinizi kendinizle iletişime geçilmesi için verdiyseniz, aldığınız hizmetin değişikliği, kullanımı ve bakımıyla ilgili iletiler (ör. kurulum bilgilendirmesi, panel giriş bilgileri, fatura ve hizmet duyuruları) için ayrıca onay alınmaz. Randevox şu anda yalnızca bu tür hizmet iletileri göndermektedir; tanıtım ve kampanya iletisi göndermemektedir.",
        en: "If you gave us your contact details so we can reach you, messages about changes to, use of or maintenance of the service you receive (e.g. setup updates, panel login details, invoices and service notices) need no separate consent. Randevox currently sends only such service messages; it sends no promotional or campaign messages.",
      },
    ],
  },
  {
    title: { tr: "2. Onay metni", en: "2. Consent text" },
    body: [
      {
        tr: "İleride tanıtım iletileri göndermek istersek onayınızı aşağıdaki metinle, ayrı ve önceden işaretlenmemiş bir kutucukla isteriz:",
        en: "If we ever want to send promotional messages, we will ask for your consent with the text below, through a separate box that is never pre-ticked:",
      },
      {
        tr: "\"Randevox'un ürün ve hizmetleri, yenilikleri, kampanyaları ve etkinlikleriyle ilgili olarak tarafıma e-posta, SMS ve telefon yoluyla ticari elektronik ileti gönderilmesine onay veriyorum. Onayımı dilediğim zaman, ücretsiz olarak geri alabileceğimi biliyorum.\"",
        en: "\"I consent to receiving commercial electronic messages from Randevox by email, SMS and phone about its products and services, updates, campaigns and events. I know I can withdraw this consent at any time, free of charge.\"",
      },
    ],
  },
  {
    title: { tr: "3. Onayın şartları", en: "3. Conditions of consent" },
    body: [
      {
        list: [
          { tr: "Onay tamamen isteğe bağlıdır; hizmeti almak için ön şart değildir. Onay vermemeniz demo talebinizi, denemenizi veya aboneliğinizi etkilemez.", en: "Consent is entirely optional and is never a condition of the service. Not consenting doesn't affect your demo request, trial or subscription." },
          { tr: "Onay kutusu hiçbir zaman önceden işaretli gelmez.", en: "The consent box is never pre-ticked." },
          { tr: "Elektronik ortamda verilen onaylar mevzuatın öngördüğü süre içinde İYS'ye kaydedilir; onayın alındığı bilgisi, reddetme imkânıyla birlikte size iletilir.", en: "Consents given electronically are registered in İYS within the period the law requires, and you are notified that consent was recorded, with a way to refuse." },
          { tr: "Size onay istemek için ticari elektronik ileti gönderilmez.", en: "We never send a commercial message to ask for consent." },
        ],
      },
    ],
  },
  {
    title: { tr: "4. Ret ve onayın geri alınması", en: "4. Refusing and withdrawing consent" },
    body: [
      {
        tr: "Onay verseniz bile istediğiniz zaman, gerekçe göstermeden ve ücretsiz olarak ileti almayı reddedebilirsiniz. Bunun için gönderilen her iletideki ret bağlantısını kullanabilir, İYS (iys.org.tr) üzerinden onayınızı yönetebilir veya info@randevoxai.com adresine yazabilirsiniz. Ret bildiriminiz en geç üç iş günü içinde işleme alınır.",
        en: "Even after consenting you can refuse further messages at any time, without giving a reason and free of charge: use the opt-out link in any message, manage your consent through İYS (iys.org.tr), or write to info@randevoxai.com. Your opt-out is processed within three business days at the latest.",
      },
    ],
  },
  {
    title: { tr: "5. Kişisel veriler", en: "5. Personal data" },
    body: [
      {
        tr: "Onay kapsamında işlenen adınız, e-posta adresiniz ve telefon numaranız yalnızca bu iletileri göndermek ve onay kaydını tutmak için kullanılır. Ayrıntılar Gizlilik Politikası'ndadır.",
        en: "Your name, email address and phone number processed under this consent are used only to send these messages and keep the consent record. Details are in the Privacy Policy.",
      },
    ],
  },
];

export default function CommercialMessageConsentPage() {
  return (
    <LegalDoc
      title={{ tr: "Ticari Elektronik İleti Onayı", en: "Commercial Electronic Message Consent" }}
      updated={{ tr: "Son güncelleme: 21 Kasım 2026", en: "Last updated: November 21, 2026" }}
      sections={SECTIONS}
    />
  );
}
