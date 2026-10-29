/**
 * The two contracts a clinic accepts in its panel — Hizmet Sözleşmesi and
 * Veri İşleme Sözleşmesi — as data, filled with that clinic's terms.
 *
 * Same text as the paper versions (Word, signed by hand), with the
 * paper-only wording swapped for the electronic one: no blank dates, no
 * signature lines, "kabul edildiği anda yürürlüğe girer". The clause lists
 * at the bottom are generated from the Word sources — change them there and
 * regenerate, so the two never drift.
 *
 * Pure and isomorphic: the panel renders it, the server hashes it
 * (lib/contracts/server.ts). Bump CONTRACT_VERSION on any text change; the
 * hash changes anyway, the version is what a human reads in the records.
 */

export const CONTRACT_VERSION = "2026-10-27";

export interface Clause {
  title: string;
  paragraphs: string[];
}

/** What the operator fills in /admin per clinic: the customer's details and Ek-1. */
export interface ContractTerms {
  legalName: string;
  /** "Vergi Dairesi / No" */
  taxId: string;
  address: string;
  /** Where notices go (Hizmet Sözleşmesi 15.2). */
  email: string;
  /** Free text with currency, e.g. "499 USD". KDV hariç. */
  monthlyFee: string;
  overageFee: string;
  /** Null = none. */
  setupFee: string | null;
  /** Null = no free trial. */
  trialDays: number | null;
  paymentMethod: string;
  lineFeesBy: "clinic" | "provider";
}

/** The provider (Randevox's owner), from the environment — never in the repo. */
export interface ContractProvider {
  name: string;
  idNumber: string | null;
  address: string;
  email: string;
  /** "........ mahkemeleri ve icra daireleri yetkilidir" */
  court: string;
  /** The provider is a minor contracting with a guardian's written consent. */
  guardianConsent: boolean;
}

export interface ContractPackage {
  id: string;
  label: string;
  minutes: number;
}

export interface ContractDocument {
  id: "service" | "dpa";
  title: string;
  subtitle: string;
  sections: Clause[];
}

const PACKAGE_SCOPE: Record<string, string> = {
  klinik:
    "1–3 hekimli klinikler. 7/24 telefon karşılama (tüm hat ya da yalnızca meşgul / mesai dışı), takvime randevu, ses kaydı, döküm ve özet, randevusuz aramada kliniğe e-posta, canlı aktarma, mesai dışı ajanı, hızlı geri dönüş, dahili CRM, aylık performans raporu.",
  poliklinik:
    "4+ hekimli poliklinikler. Klinik paketindeki her şey; haftalık performans raporu, kendi CRM / klinik yazılımına aktarım, hekim bazlı takvim, öncelikli destek, aylık optimizasyon görüşmesi.",
};

function providerParty(title: string, p: ContractProvider): Clause {
  return {
    title,
    paragraphs: [
      `Ad Soyad / Unvan: ${p.name}`,
      `T.C. Kimlik No / Vergi No: ${p.idNumber || "—"}`,
      `Adres: ${p.address}`,
      `E-posta: ${p.email}`,
      ...(p.guardianConsent
        ? [
            "Hizmet Sağlayıcı 18 yaşından küçüktür ve bu sözleşmeyi yasal temsilcisinin yazılı muvafakatiyle kabul eder (TMK md. 16). Muvafakatname talep halinde Klinik'e ibraz edilir.",
          ]
        : []),
    ],
  };
}

function clinicParty(title: string, t: ContractTerms): Clause {
  return {
    title,
    paragraphs: [
      `Unvan: ${t.legalName}`,
      `Vergi Dairesi / No: ${t.taxId}`,
      `Adres: ${t.address}`,
      `E-posta: ${t.email}`,
    ],
  };
}

const fill = (clauses: Clause[], court: string): Clause[] =>
  clauses.map((c) => ({ title: c.title, paragraphs: c.paragraphs.map((p) => p.replaceAll("{{court}}", court)) }));

export function renderContracts(input: {
  terms: ContractTerms;
  provider: ContractProvider;
  pkg: ContractPackage;
}): ContractDocument[] {
  const { terms, provider, pkg } = input;

  const service: ContractDocument = {
    id: "service",
    title: "Hizmet Sözleşmesi",
    subtitle: "Randevox yapay zekâ telefon asistanı",
    sections: [
      providerParty("1. Taraflar — Hizmet Sağlayıcı", provider),
      clinicParty("1. Taraflar — Müşteri (\"Klinik\")", terms),
      ...fill(SERVICE_CLAUSES, provider.court),
      {
        title: "Ek-1 — Paket ve ücret",
        paragraphs: [
          `Seçilen paket: ${pkg.label} — aylık ${pkg.minutes.toLocaleString("tr-TR")} dakika.`,
          `Kapsam: ${PACKAGE_SCOPE[pkg.id] ?? PACKAGE_SCOPE.klinik}`,
          `Aylık paket ücreti (KDV hariç): ${terms.monthlyFee}`,
          `Aşım ücreti (dakika başına, KDV hariç): ${terms.overageFee}`,
          `Kurulum ücreti: ${terms.setupFee || "Yok"}`,
          `Ücretsiz deneme süresi: ${terms.trialDays ? `${terms.trialDays} gün` : "Yok"}`,
          `Ödeme yöntemi: ${terms.paymentMethod}`,
          `Telefon hattı ve operatör ücretleri: ${terms.lineFeesBy === "provider" ? "Hizmet Sağlayıcı öder" : "Klinik öder"}`,
          "USD olarak belirlenen ücretler, fatura tarihindeki T.C. Merkez Bankası döviz satış kuru üzerinden TL olarak faturalanır.",
        ],
      },
    ],
  };

  const dpa: ContractDocument = {
    id: "dpa",
    title: "Veri İşleme Sözleşmesi",
    subtitle: "6698 sayılı Kişisel Verilerin Korunması Kanunu md. 12 kapsamında",
    sections: [
      clinicParty("1. Taraflar — Veri Sorumlusu (\"Klinik\")", terms),
      providerParty("1. Taraflar — Veri İşleyen (\"Randevox\")", provider),
      ...fill(DPA_CLAUSES, provider.court),
      {
        title: "Ek-1 — İşlemenin kapsamı",
        paragraphs: [
          "İlgili kişiler: Klinik'i arayanlar ve Klinik'in geri arama formlarını dolduranlar (hasta ve hasta adayları), Klinik personeli (panel kullanıcıları).",
          "Veri kategorileri: kimlik ve iletişim (ad soyad, telefon, e-posta); görüşme (ses kaydı — Klinik etkinleştirdiyse —, transkript, özet, duygu etiketi, görüşme süresi ve sonucu); randevu (tarih, saat, hizmet, hekim); sağlık verisi (özel nitelikli: görüşmede veya formda paylaşılan şikâyet, tedavi ilgisi); rıza kaydı (rıza metni, zamanı, IP adresi); personel (ad, e-posta, giriş kayıtları).",
          "Amaçlar: Klinik adına gelen aramaların karşılanması ve geri arama yapılması; randevu oluşturma, değiştirme, iptal ve hatırlatma; arama kayıtlarının ve özetlerinin Klinik paneline ve Klinik'in belirlediği entegrasyonlara (CRM, takvim) aktarılması; hasta bildirimleri (SMS/WhatsApp) ve Klinik'e e-posta bildirimleri.",
          "Süre: Ses kayıtları 3 ay, transkript, özet ve arayanın adı ile telefonu 12 ay sonra otomatik olarak silinir (kişiyle ilişkilendirilemeyen istatistikler kalır). Geri arama formu kayıtları 12 ay sonra silinir. Randevu kayıtları ve personel bilgileri hesap kapanana kadar tutulur; sonrası madde 11'e göre.",
        ],
      },
      {
        title: "Ek-2 — Teknik ve idari tedbirler",
        paragraphs: [
          "Tüm bağlantılarda şifreli iletişim (HTTPS/TLS).",
          "Veritabanında satır düzeyinde erişim kontrolü: her kullanıcı yalnızca bağlı olduğu kliniğin verisini görür.",
          "Sunucu tarafı gizli anahtarlar yalnızca sunucuda tutulur, tarayıcıya gönderilmez.",
          "Klinik bazlı entegrasyon anahtarları kullanıcıların okuyamadığı ayrı bir tabloda saklanır.",
          "Ses kayıtları herkese açık bağlantıyla değil, her istekte yeniden üretilen süreli bağlantılarla sunulur.",
          "Telefon altyapısından gelen isteklerin imza/gizli anahtarla doğrulanması.",
          "Geri arama formlarında kötüye kullanım sınırları (IP ve klinik bazlı).",
          "Personel hesapları yalnızca Randevox tarafından açılır; herkese açık kayıt formu yoktur.",
          "Hata bildirimlerine hasta verisi konmaz.",
          "Saklama süresi dolan veriler her gece otomatik olarak silinir veya anonimleştirilir (Ek-1, Süre).",
        ],
      },
      {
        title: "Ek-3 — Alt işleyenler",
        paragraphs: [
          "Vapi Inc. (ve alt işleyenleri OpenAI, Deepgram, ElevenLabs) — telefon/ses altyapısı, yapay zekâ — ABD",
          "Supabase Inc. — veritabanı ve kimlik doğrulama — veritabanı Japonya, şirket ABD",
          "Vercel Inc. — uygulama barındırma — ABD",
          "Modal Labs — zamanlanmış işler (hatırlatma, geri arama) — ABD",
          "Resend Inc. — e-posta bildirimleri — ABD",
          "Klinik'in kendi hesabıyla bağlanan takvim (Cal.com, Google Takvim), CRM/webhook, WhatsApp Business, SMS ve telefon operatörü hizmetleri madde 4.6 uyarınca bu listeye dahil değildir.",
        ],
      },
    ],
  };

  return [service, dpa];
}

/** The documents as plain text — what is hashed, and the e-mail copy's text part. */
export function contractsAsText(docs: ContractDocument[]): string {
  return docs
    .map((d) =>
      [d.title.toLocaleUpperCase("tr-TR"), d.subtitle, "", ...d.sections.flatMap((s) => [s.title, ...s.paragraphs, ""])].join(
        "\n",
      ),
    )
    .join("\n\n");
}

/* ─────────── generated from the Word sources (hs2.js, vis2.js) ─────────── */

export const SERVICE_CLAUSES: Clause[] = [
  {
    title: "2. Tanımlar",
    paragraphs: [
      "Hizmet: Hizmet Sağlayıcı'nın \"Randevox\" adıyla sunduğu, Klinik'in telefon aramalarını yapay zekâ destekli sesli asistanla karşılayan, randevu oluşturan, değiştiren ve iptal eden, arama kayıtlarını, dökümlerini ve özetlerini Klinik'e sunan yazılım hizmetidir.",
      "Panel: Klinik personelinin Hizmet'i izlediği ve ayarladığı web arayüzüdür (randevoxai.com).",
      "Ajan: Klinik adına telefonla konuşan yapay zekâ asistanıdır.",
      "Paket: Ek-1'de seçilen, aylık dakika hakkını ve özellikleri belirleyen hizmet paketidir.",
      "Dakika: Ajanın gelen ve giden aramalarda konuştuğu süredir; Panel'deki arama kayıtlarına göre hesaplanır.",
    ],
  },
  {
    title: "3. Konu ve kapsam",
    paragraphs: [
      "3.1. Bu sözleşmenin konusu, Hizmet'in Ek-1'deki Paket kapsamında Klinik'e sunulması ve karşılığında Klinik'in ücret ödemesidir.",
      "3.2. Hizmet anahtar teslim sunulur: Hizmet Sağlayıcı, Klinik'in hesabını açar, ajanları Klinik'in bilgileriyle kurar ve telefon hattının Hizmet'e bağlanmasına yardımcı olur.",
      "3.3. Bazı özellikler üçüncü taraf hizmetlerin (telefon operatörü, takvim, e-posta, SMS/WhatsApp) Klinik tarafında doğru bağlanmasına ve çalışmasına bağlıdır. Bu hizmetlerdeki kesinti ve değişikliklerden Hizmet Sağlayıcı sorumlu değildir; ancak sorunun giderilmesi için makul çabayı gösterir.",
    ],
  },
  {
    title: "4. Kurulum ve başlangıç",
    paragraphs: [
      "4.1. Klinik; hizmetlerini, fiyatlarını, hekimlerini, çalışma saatlerini, adresini, sık sorulan soruları ve takvim erişimini Hizmet Sağlayıcı'ya eksiksiz ve doğru olarak iletir. Ajanın arayanlara verdiği bilgiler bu bilgilere dayanır; bilgilerin doğruluğundan ve güncel tutulmasından Klinik sorumludur.",
      "4.2. Klinik, telefon hattının Hizmet'e yönlendirilmesi için gerekli operatör işlemlerini yapar veya yapılmasına izin verir.",
      "4.3. Hizmet, telefon hattının bağlandığı ve ajanın ilk gerçek aramayı karşılamaya hazır olduğu tarihte başlar (\"Başlangıç Tarihi\"). Taraflar Başlangıç Tarihi'ni e-postayla teyit eder.",
      "4.4. Telefon hattı açılmadan önce Klinik, KVKK kapsamındaki aydınlatma metnini kendi web sitesinde yayınlar ve Veri İşleme Sözleşmesi imzalanır veya elektronik ortamda kabul edilir.",
    ],
  },
  {
    title: "5. Ücret ve ödeme",
    paragraphs: [
      "5.1. Klinik, Ek-1'de belirtilen aylık Paket ücretini her fatura döneminin başında peşin öder. Fatura dönemi takvim ayıdır (Türkiye saatiyle ayın 1'i 00:00'dan ay sonuna kadar). İlk ayın Paket ücreti, Başlangıç Tarihi'nden ay sonuna kadar kalan gün sayısıyla orantılı alınır; ilk ayın dakika hakkı tam Paket kotasıdır.",
      "5.2. Ödeme, Hizmet Sağlayıcı'nın ilettiği ödeme bağlantısı veya Ek-1'de belirtilen yöntemle yapılır. Ücretlere KDV ve yasal kesintiler dahil değildir, ayrıca eklenir.",
      "5.3. Paket'teki dakika hakkını aşan kullanım ay sonunda kesinleşir; Ek-1'deki aşım ücreti üzerinden hesaplanarak bir sonraki takvim ayının faturasına eklenir. Kullanılmayan dakikalar sonraki aya devretmez.",
      "5.4. Telefon hattı, operatör ve SMS ücretleri, Ek-1'de aksi belirtilmedikçe Klinik'e aittir.",
      "5.5. Ödeme vadesinden itibaren 7 gün içinde yapılmazsa Hizmet Sağlayıcı, e-postayla bildirimde bulunduktan sonra Hizmet'i ödeme yapılana kadar askıya alabilir. Askı süresince arama kayıtları korunur.",
    ],
  },
  {
    title: "6. Süre ve fesih",
    paragraphs: [
      "6.1. Sözleşme Başlangıç Tarihi'nde yürürlüğe girer ve aylık dönemler halinde kendiliğinden yenilenir.",
      "6.2. Taraflardan her biri, içinde bulunulan fatura döneminin bitiminden en az 7 gün önce yazılı (e-posta dahil) bildirimde bulunarak sözleşmeyi dönem sonu itibarıyla feshedebilir. Ödenmiş dönem için iade yapılmaz.",
      "6.3. Taraflardan biri sözleşmeye esaslı şekilde aykırı davranır ve bu aykırılığı yazılı bildirimden itibaren 7 gün içinde gidermezse, diğer taraf sözleşmeyi derhal feshedebilir.",
      "6.4. Sözleşme sona erdiğinde Klinik verilerinin iadesi ve silinmesi Veri İşleme Sözleşmesi'ne göre yapılır.",
    ],
  },
  {
    title: "7. Hizmet Sağlayıcı'nın yükümlülükleri",
    paragraphs: [
      "7.1. Hizmet Sağlayıcı, Hizmet'i makul özen ve sektör uygulamalarına uygun şekilde sunar, Klinik'in bildirdiği aksaklıkları gidermek için makul çabayı gösterir.",
      "7.2. Destek talepleri e-posta veya WhatsApp üzerinden alınır ve iş günlerinde yanıtlanır.",
      "7.3. Planlı bakım çalışmaları mümkün olduğunca önceden bildirilir ve yoğun saatler dışında yapılır.",
      "7.4. Hizmet Sağlayıcı, Hizmet'in kesintisiz veya hatasız olacağını garanti etmez ve belirli bir çalışma süresi (uptime) taahhüdü vermez.",
      "7.5. Hizmet Sağlayıcı'dan kaynaklanan ve bir fatura döneminde toplam 48 saati aşan kesintilerde Klinik, o döneme ait ücretten kesinti süresiyle orantılı indirim talep edebilir. Bu indirim, kesintiler için Klinik'in tek ve münhasır hakkıdır. Planlı bakım, Klinik'ten ve üçüncü taraf altyapı sağlayıcılarından kaynaklanan kesintiler bu hesaba katılmaz.",
    ],
  },
  {
    title: "8. Klinik'in yükümlülükleri",
    paragraphs: [
      "8.1. Klinik, Hizmet'i hukuka uygun amaçlarla kullanır; izinsiz toplu arama veya ticari ileti göndermek için kullanmaz.",
      "8.2. Klinik, Panel hesaplarının şifrelerini korur ve personelinin hesaplarını yalnızca yetkili kişilerin kullanmasını sağlar.",
      "8.3. Klinik, ajan talimatlarını ve klinik bilgilerini güncel tutar; ajanın verdiği bilgilerde bir hata fark ederse Hizmet Sağlayıcı'ya bildirir.",
      "8.4. Klinik Hizmet'i; hukuka aykırı, yanıltıcı veya üçüncü kişilerin haklarını ihlal eden amaçlarla, acil tıbbi durumların yönetimi veya tıbbi değerlendirme için, Hizmet'i kopyalamak, tersine mühendislik yapmak ya da erişimi üçüncü kişilere devretmek için kullanamaz. Ajan talimatlarına, randevu için gerekli olanın ötesinde sağlık bilgisi toplatan sorular eklemez.",
      "8.5. Klinik, bu madde ve Veri İşleme Sözleşmesi'ndeki kendi yükümlülüklerine (aydınlatma, açık rıza, hukuki sebep, bilgilerin doğruluğu, kullanım kuralları) aykırılığı nedeniyle Hizmet Sağlayıcı'ya yöneltilen talepler, idari para cezaları ve makul savunma masraflarından Hizmet Sağlayıcı'yı sorumlu tutmaz; Hizmet Sağlayıcı'nın bu nedenle ödediği tutarları rücuen öder.",
      "8.6. Bu maddeye esaslı aykırılık halinde Hizmet Sağlayıcı, e-postayla bildirimde bulunarak Hizmet'i askıya alabilir veya madde 6.3'e göre feshedebilir.",
    ],
  },
  {
    title: "9. Yapay zekâ kullanımı ve sınırları",
    paragraphs: [
      "9.1. Ajan bir yapay zekâ sistemidir ve görüşmenin başında bunu arayana bildirir. Ajan hata yapabilir, arayanı yanlış anlayabilir veya eksik bilgi verebilir.",
      "9.2. Ajan tıbbi tavsiye, teşhis veya tedavi önerisi vermez ve acil durumları yönetmez. Acil bir durum sezdiğinde arayanı 112'ye veya Klinik'e yönlendirmek üzere ayarlanır. Tıbbi konulardaki tüm kararlar ve hastayla ilgili sorumluluk Klinik'e aittir.",
      "9.3. Ajanın oluşturduğu randevuların Klinik takviminde takibi ve gerektiğinde teyidi Klinik'in sorumluluğundadır.",
    ],
  },
  {
    title: "10. Kişisel veriler",
    paragraphs: [
      "Hizmet kapsamında Klinik veri sorumlusu, Hizmet Sağlayıcı veri işleyendir. Kişisel verilerin işlenmesi, taraflar arasında kabul edilen Veri İşleme Sözleşmesi'ne tabidir. Veri İşleme Sözleşmesi bu sözleşmenin eki ve ayrılmaz parçasıdır.",
    ],
  },
  {
    title: "11. Fikri mülkiyet",
    paragraphs: [
      "11.1. Hizmet'e ait yazılım, arayüz, ajan yapılandırmaları ve diğer tüm fikri haklar Hizmet Sağlayıcı'ya aittir. Klinik'e sözleşme süresince Hizmet'i kullanma hakkı verilir; bu hak devredilemez.",
      "11.2. Klinik'in bilgileri, arama kayıtları ve randevu verileri Klinik'e aittir.",
    ],
  },
  {
    title: "12. Gizlilik",
    paragraphs: [
      "Taraflar, sözleşme sırasında öğrendikleri diğer tarafa ait ticari bilgileri gizli tutar ve bu sözleşmenin amacı dışında kullanmaz. Bu yükümlülük sözleşme sona erdikten sonra da devam eder.",
    ],
  },
  {
    title: "13. Sorumluluğun sınırlandırılması",
    paragraphs: [
      "13.1. Hizmet Sağlayıcı, dolaylı zararlardan, kâr kaybından, kaçan randevu veya müşteri kaybından sorumlu değildir.",
      "13.2. Hizmet Sağlayıcı'nın bu sözleşmeden doğan toplam sorumluluğu, zararın doğduğu tarihten önceki son 3 ayda Klinik'in ödediği ücretlerin toplamıyla sınırlıdır.",
      "13.3. Ajanın verdiği bilgiler, oluşturduğu randevular ve arayanla yaptığı görüşmeler nedeniyle üçüncü kişilerin Klinik'e yönelttiği talepler, madde 9 kapsamında Klinik'in sorumluluğundadır; Hizmet Sağlayıcı'nın bu taleplerdeki sorumluluğu madde 13.2 ile sınırlıdır.",
      "13.4. Bu maddedeki sınırlamalar kasıt ve ağır kusur hallerinde uygulanmaz.",
    ],
  },
  {
    title: "14. Mücbir sebep",
    paragraphs: [
      "Doğal afet, salgın, savaş, yaygın internet veya enerji kesintisi, üçüncü taraf altyapı sağlayıcılarının genel kesintileri ve resmi makam kararları gibi tarafların kontrolü dışındaki olaylar süresince yükümlülükler askıya alınır. Mücbir sebep 30 günden uzun sürerse taraflardan her biri sözleşmeyi feshedebilir.",
    ],
  },
  {
    title: "15. Değişiklikler ve bildirimler",
    paragraphs: [
      "15.1. Bu sözleşmedeki değişiklikler tarafların yazılı mutabakatıyla yapılır. Hizmet Sağlayıcı fiyat değişikliğini en az 30 gün önce bildirir; Klinik yeni fiyatı kabul etmezse yürürlük tarihinden önce sözleşmeyi feshedebilir.",
      "15.2. Taraflar, madde 1'de yazılı e-posta adreslerine yapılan bildirimlerin geçerli olduğunu kabul eder. Adres değişikliği bildirilmedikçe eski adrese yapılan bildirim geçerlidir.",
    ],
  },
  {
    title: "16. Uyuşmazlık",
    paragraphs: [
      "Bu sözleşmeye Türk hukuku uygulanır. Uyuşmazlıklarda {{court}} mahkemeleri ve icra daireleri yetkilidir. Taraflar, Hizmet'in arama ve kullanım kayıtlarının uyuşmazlıklarda delil olacağını kabul eder.",
      "Taraflar, sözleşmenin elektronik ortamda kabulüne ilişkin sistem kayıtlarının (kabul eden hesap, tarih-saat, IP adresi, kabul edilen sözleşme sürümü) HMK md. 193 anlamında delil sözleşmesi niteliğinde kesin delil olduğunu kabul eder. Sözleşmeyi Klinik adına elektronik ortamda kabul eden kişi, Klinik'i bağlamaya yetkili olduğunu beyan eder.",
      "Klinik, bu sözleşmenin tüm hükümlerini, özellikle madde 7.4–7.5 (hizmet seviyesi), 8.4–8.6 (kullanım kuralları ve rücu), 9 (yapay zekâ sınırları) ve 13 (sorumluluğun sınırlandırılması) hükümlerini okuduğunu, bunlar hakkında bilgilendirildiğini ve müzakere imkânı tanındığını kabul eder.",
      "İşbu sözleşme 16 madde ve 1 ekten ibaret olup, Veri İşleme Sözleşmesi ile birlikte Klinik tarafından elektronik ortamda kabul edildiği anda yürürlüğe girer; kabulün tarihi ve saati sistem kayıtlarında yer alır.",
    ],
  },
];

export const DPA_CLAUSES: Clause[] = [
  {
    title: "2. Konu",
    paragraphs: [
      "Bu sözleşme, Randevox'un bu sözleşmeyle birlikte kabul edilen Hizmet Sözleşmesi kapsamında Klinik'e sunduğu yapay zekâ destekli telefon asistanı hizmeti sırasında Klinik adına işlediği kişisel verilere ilişkin tarafların hak ve yükümlülüklerini, 6698 sayılı Kişisel Verilerin Korunması Kanunu (\"KVKK\") ve ilgili mevzuat çerçevesinde düzenler. İşlenen veriler, ilgili kişiler, amaçlar ve süreler Ek-1'dedir.",
    ],
  },
  {
    title: "3. Talimatla işleme",
    paragraphs: [
      "3.1. Randevox kişisel verileri yalnızca Klinik'in yazılı talimatları, Hizmet Sözleşmesi ve bu sözleşme doğrultusunda, Ek-1'deki amaçlarla işler. Klinik'in panel üzerinden yaptığı ayarlar (ajan talimatları, kayıt tercihi, entegrasyonlar, silme işlemleri) talimat sayılır.",
      "3.2. Randevox, bir talimatın mevzuata aykırı olduğu kanısındaysa Klinik'i derhal bilgilendirir.",
      "3.3. Randevox verileri kendi amaçları için kullanmaz, satmaz, üçüncü kişilerle Ek-3'te sayılanlar dışında paylaşmaz. Hizmetin işletilmesi ve iyileştirilmesi için yalnızca anonimleştirilmiş, kişiyle ilişkilendirilemeyen istatistikler kullanılabilir.",
    ],
  },
  {
    title: "4. Klinik'in yükümlülükleri",
    paragraphs: [
      "4.1. Veri sorumlusu Klinik'tir. İlgili kişilerin aydınlatılması (KVKK md. 10), gerekli hallerde açık rıza alınması (md. 5, 6) ve işlemenin hukuki sebebinin bulunması Klinik'in sorumluluğundadır. Randevox, arama başında yapay zekâ ve kayıt bildirimini otomatik olarak yapar; aydınlatma metni şablonu ve rıza formu sağlar.",
      "4.2. Klinik, kendi web sitesinde aydınlatma metnini yayınlar ve geri arama formlarında Randevox'un sağladığı açık rıza düzenini kullanır veya eşdeğerini sağlar.",
      "4.3. Klinik, VERBİS kaydı dahil veri sorumlusu olarak tabi olduğu diğer yükümlülükleri yerine getirir.",
      "4.4. Klinik, Ek-3'teki alt işleyenlere ve yurt dışına aktarıma onay verir ve bu aktarımı ilgili kişilere sunduğu aydınlatma metnine ekler.",
      "4.5. Klinik, Hizmet'e randevu ve görüşme amacının gerektirdiğinden fazla kişisel veri, özellikle sağlık verisi, aktarmaz ve ajan talimatlarına bu yönde soru eklemez.",
      "4.6. Klinik'in kendi hesabıyla bağladığı veya Randevox'tan bağlanmasını istediği üçüncü taraf hizmetler (takvim, CRM, webhook, WhatsApp Business, SMS ve telefon operatörü gibi) Randevox'un alt işleyeni değildir. Bu hizmetlere aktarım Klinik'in talimatıyla yapılır; bu hizmetlerle sözleşme yapılması ve yurt dışı aktarım yükümlülükleri Klinik'in sorumluluğundadır.",
    ],
  },
  {
    title: "5. Gizlilik",
    paragraphs: [
      "Randevox, verilere erişen çalışanlarının ve yardımcılarının gizlilik yükümlülüğü altında olmasını sağlar. Bu yükümlülük sözleşme sona erdikten sonra da devam eder.",
    ],
  },
  {
    title: "6. Güvenlik",
    paragraphs: [
      "Randevox, KVKK md. 12/1 uyarınca verilerin hukuka aykırı işlenmesini ve erişilmesini önlemek ve muhafazasını sağlamak için Ek-2'deki teknik ve idari tedbirleri alır ve güncel tutar.",
    ],
  },
  {
    title: "7. Alt işleyenler ve yurt dışına aktarım",
    paragraphs: [
      "7.1. Klinik, Ek-3'teki alt işleyenlerin kullanılmasına izin verir.",
      "7.2. Randevox yeni bir alt işleyen eklemeden veya mevcut birini değiştirmeden en az 15 gün önce Klinik'i yazılı olarak (e-posta dahil) bilgilendirir. Klinik haklı bir sebeple itiraz ederse taraflar çözüm arar; çözülemezse Klinik sözleşmeyi cezai şart ödemeksizin feshedebilir.",
      "7.3. Randevox, alt işleyenleri seçerken veri güvenliği bakımından yeterli güvence sunan, yaygın kullanılan sağlayıcıları tercih eder ve onların yayımladığı veri işleme koşullarını kabul eder. Randevox alt işleyenlerin fiillerinden, kendi seçim ve gözetim kusuru ölçüsünde ve madde 12'deki sınırlarla sorumludur.",
      "7.4. Ek-3'teki alt işleyenlerin bir kısmı yurt dışındadır. Randevox bu aktarımlar için KVKK md. 9'da öngörülen güvenceleri (standart sözleşme ve Kurum'a bildirim) sağlamak üzere gerekli işlemleri yürütür ve güncel durumu Klinik'in talebi üzerine bildirir.",
    ],
  },
  {
    title: "8. İlgili kişi başvuruları",
    paragraphs: [
      "Randevox, ilgili kişilerin KVKK md. 11 kapsamındaki başvurularını yanıtlayabilmesi için Klinik'e makul destek verir. Doğrudan Randevox'a gelen başvuruları gecikmeksizin ve en geç 3 iş günü içinde Klinik'e iletir, kendisi yanıtlamaz.",
    ],
  },
  {
    title: "9. Veri ihlali",
    paragraphs: [
      "Randevox, Klinik verilerini etkileyen bir ihlali öğrendiğinde Klinik'i gecikmeksizin ve en geç 48 saat içinde bilgilendirir. Bildirimde, bilinen ölçüde, ihlalin niteliği, etkilenen veri ve kişi sayısı, olası sonuçları ve alınan veya önerilen tedbirler yer alır. Kurul'a ve ilgili kişilere bildirim (KVKK md. 12/5) veri sorumlusu olarak Klinik'in yükümlülüğüdür; Randevox bu bildirim için gereken bilgileri sağlar.",
    ],
  },
  {
    title: "10. Denetim",
    paragraphs: [
      "Randevox, bu sözleşmeye uyumu gösteren bilgi ve belgeleri Klinik'in makul talebi üzerine sunar. Klinik, önceden yazılı bildirim yaparak ve yılda en fazla bir kez, Randevox'un işleyişini aksatmayacak şekilde ve masrafı kendisine ait olmak üzere denetim yapabilir veya yaptırabilir. Denetim öncelikle bilgi ve belge talebiyle yapılır; yerinde denetim, sunulan belgeler yetersiz kaldığında istenebilir. Kurul'un denetim talepleri saklıdır.",
    ],
  },
  {
    title: "11. Süre, iade ve silme",
    paragraphs: [
      "11.1. Bu sözleşme Hizmet Sözleşmesi süresince geçerlidir.",
      "11.2. Hizmet sona erdiğinde Randevox, Klinik'in tercihine göre verileri 30 gün içinde Klinik'e makine tarafından okunabilir biçimde iade eder ve/veya siler; mevzuatın saklamayı zorunlu kıldığı haller saklıdır. Alt işleyenlerdeki kopyalar da onların saklama süreleri sonunda silinir. Silme Klinik'e yazılı olarak teyit edilir.",
    ],
  },
  {
    title: "12. Sorumluluk",
    paragraphs: [
      "12.1. Taraflar, bu sözleşmeye ve KVKK'ya aykırılıktan kaynaklanan zararlardan kendi kusurları oranında sorumludur. İdari para cezası ve tazminat, buna yol açan aykırılığı yapan tarafa aittir.",
      "12.2. Klinik, madde 4'teki yükümlülüklerine aykırılığı nedeniyle Randevox'a yöneltilen talepler, idari para cezaları ve makul savunma masraflarından Randevox'u sorumlu tutmaz; Randevox'un bu nedenle ödediği tutarları rücuen öder.",
      "12.3. Randevox'un bu sözleşmeden doğan sorumluluğu Hizmet Sözleşmesi madde 13'teki sınırlara tabidir; kasıt ve ağır kusur halleri saklıdır.",
    ],
  },
  {
    title: "13. Uyuşmazlık",
    paragraphs: [
      "Bu sözleşmeye Türk hukuku uygulanır. Uyuşmazlıklarda {{court}} mahkemeleri ve icra daireleri yetkilidir.",
      "Taraflar, sözleşmenin elektronik ortamda kabulüne ilişkin sistem kayıtlarının (kabul eden hesap, tarih-saat, IP adresi, kabul edilen sözleşme sürümü) HMK md. 193 anlamında delil sözleşmesi niteliğinde kesin delil olduğunu kabul eder. Sözleşmeyi Klinik adına elektronik ortamda kabul eden kişi, Klinik'i bağlamaya yetkili olduğunu beyan eder.",
      "İşbu sözleşme 13 madde ve 3 ekten ibaret olup, Hizmet Sözleşmesi ile birlikte Klinik tarafından elektronik ortamda kabul edildiği anda yürürlüğe girer; kabulün tarihi ve saati sistem kayıtlarında yer alır.",
    ],
  },
];
