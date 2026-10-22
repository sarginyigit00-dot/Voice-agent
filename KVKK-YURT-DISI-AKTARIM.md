# Yurt dışına aktarım (KVKK md. 9) — yapılacaklar

Randevox, kliniklerin (veri sorumlusu) verilerini **veri işleyen** olarak işler ve aşağıdaki yurt
dışı servislere aktarır. Her biri için Kurul'un **"Veri İşleyenden Veri İşleyene"** standart
sözleşmesi imzalanır ve imzadan itibaren **5 iş günü** içinde Kurum'a bildirilir.

Dayanak: KVKK md. 9 (7499 sayılı Kanun ile değişik, 1 Haziran 2024) ve Kişisel Verilerin Yurt
Dışına Aktarılmasına İlişkin Usul ve Esaslar Hakkında Yönetmelik (10 Temmuz 2024). Ayrıntılar
ve güncel bildirim yöntemi için kvkk.gov.tr → Standart Sözleşmeler.

## Servisler

Koddan çıkarıldı (Ekim 2026). Yeni bir servis eklendiğinde bu tablo da güncellenir.

| Servis | Şirket / yer | Giden veri | Öncelik | Durum |
|---|---|---|---|---|
| Vapi | Vapi Inc., ABD | Ses, transkript, telefon, randevu bilgisi. Kendi alt işleyenleri: OpenAI (dil modeli), Deepgram (ses→metin), ElevenLabs (kullanılıyorsa, ses) | 1 | ☐ yazıldı ☐ imzalandı ☐ bildirildi |
| Supabase | Supabase Inc., ABD; veritabanı Tokyo | Tüm veriler (aramalar, transkriptler, randevular, hesaplar) | 1 | ☐ ☐ ☐ |
| Vercel | Vercel Inc., ABD | Tüm istekler sunucudan geçer | 1 | ☐ ☐ ☐ |
| Modal | Modal Labs, ABD | Hatırlatma/geri arama otomasyonu: hasta adı, telefon, randevu | 2 | ☐ ☐ ☐ |
| Resend | Resend Inc., ABD | Kliniğe giden e-postalar: arayan adı, telefon, özet | 2 | ☐ ☐ ☐ |
| Cal.com | Cal.com Inc., ABD | Randevu, hasta adı, e-posta | 2 | ☐ ☐ ☐ |
| Google | Google LLC, ABD | Personel girişi (Google ile giriş), Google Takvim kullanılıyorsa randevular | 2 | ☐ ☐ ☐ |
| Meta (WhatsApp) | Meta Platforms, ABD/İrlanda | Hasta telefonu, randevu mesajı | 3 | ☐ ☐ ☐ |
| Telegram | Telegram, BAE | Operatöre hata bildirimleri, demo talepleri (klinik personeli iletişim bilgisi) | 3 | ☐ ☐ ☐ |
| Netgsm | Türkiye | — | Yurt içi, gerekmez | — |

Anthropic listeden çıkarıldı (Ekim 2026): duygu analizi artık Vapi'nin arama sonu analizinde
yapılıyor, transkript Anthropic'e gitmiyor.

## Adımlar

1. kvkk.gov.tr'den **"Veri İşleyenden Veri İşleyene"** standart sözleşmeyi (Türkçe + İngilizce)
   indir. Metin **değiştirilmez**; yalnızca ekler doldurulur (taraflar, aktarılan veri
   kategorileri, ilgili kişi grupları, amaçlar, teknik ve idari tedbirler, alt işleyenler).
2. Aşağıdaki e-postayı her servisin gizlilik / DPO adresine gönder, sözleşmeyi ekle.
3. İmzalanan her sözleşmeyi **imza tarihinden itibaren 5 iş günü içinde** Kurum'a bildir
   (Kurum'un sitesinde açıklanan yöntemle; KEP adresi bu iş için pratik).
4. İmzalamayan servis için: alternatif sağlayıcı, gönderilen veriyi azaltma ya da riski bilerek
   sürdürme — bir KVKK avukatıyla karar ver.
5. Tablodaki durumu güncel tut; Kurul denetiminde ilk istenecek belge bu envanter ve
   sözleşmelerdir.

## E-posta taslağı (İngilizce)

**Konu:** Request to sign the Turkish KVKK Standard Contract (Processor to Processor)

> Hello,
>
> I am [Full name], an individual based in Türkiye who operates Randevox
> (randevoxai.com), an AI phone-agent service for healthcare clinics. I use [Service name]
> as a sub-processor, and in doing so I transfer personal data — including health-related
> data of our clinic customers' patients — from Türkiye to your infrastructure.
>
> Under Article 9 of the Turkish Personal Data Protection Law No. 6698 ("KVKK"), as amended in
> 2024, such transfers require appropriate safeguards. The standard route is the **Standard
> Contract published by the Turkish Personal Data Protection Authority**, which must be signed
> **without modification**, and notified to the Authority within five business days of
> signature. I am attaching the "Processor to Processor" module (Turkish original and
> English translation; the Turkish version prevails).
>
> Could you please let me know:
> 1. Whether you can sign this Standard Contract, and who I should send it to for signature;
> 2. If you already offer a KVKK Standard Contract or KVKK addendum to your DPA, where I can
>    find it;
> 3. Your current list of sub-processors and the countries where the data is stored and
>    processed.
>
> My account details: [account e-mail / organisation ID].
>
> Thank you,
> [Full name]
> Randevox, [Address]
> [E-mail], [Phone]

Adresler (gönderirken sitelerinden teyit et): Vapi, Supabase, Vercel, Modal, Resend, Cal.com
için genelde `privacy@<alan adı>` veya destek formu; Google, Meta ve Telegram için hesabın
gizlilik / veri işleme koşulları sayfası.
