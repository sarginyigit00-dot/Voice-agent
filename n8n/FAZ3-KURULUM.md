# Faz 3 — n8n otomasyonu kurulumu

İki akış var, ikisi de tüm klinikler için ortak. Kliniğe özel bilgiler olayın içinde gelir.

| Dosya | Ne yapar |
|---|---|
| `randevox-events.json` | Arama bitince Randevox olay gönderir (`lib/automation/emit.ts`). Randevu alındıysa hastaya onay mesajı, alınmadıysa kliniğe e-posta gider. Panelden iptal edilen ya da ertelenen randevu için de hastaya mesaj gider. |
| `randevox-reminders.json` | 15 dakikada bir, randevuya 24 saat ve 2 saat kala hastaya hatırlatma gönderir. |

Hasta mesajı kliniğin **mesaj kanalından** gider (admin → Klinikler → Yönet → Ayarlar → **Hasta
mesajları**): Kapalı, SMS (Netgsm) ya da WhatsApp. SMS yalnızca Türkiye cep numaralarına (+905…)
gider; yabancı numaralı hastaya SMS atlanır.

## 1. n8n ortam değişkenleri (Railway → n8n servisi → Variables)

| Değişken | Değer |
|---|---|
| `N8N_BLOCK_ENV_ACCESS_IN_NODE` | `false`. Akışlar aşağıdakileri `$env` ile okur |
| `GENERIC_TIMEZONE` | `Europe/Istanbul` |
| `AUTOMATION_SECRET` | Randevox'taki (`.env.local` ve Vercel) değerin aynısı |
| `RANDEVOX_URL` | `https://www.randevoxai.com` |
| `RESEND_API_KEY` | Resend → API Keys |
| `RESEND_FROM` | `Randevox <bildirim@randevoxai.com>` |
| `WHATSAPP_TOKEN` | Meta → kalıcı (System User) erişim anahtarı |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta → WhatsApp → API Setup → Phone number ID |
| `NETGSM_USERCODE` | Netgsm abone numarası (ör. `8508403483`) |
| `NETGSM_PASSWORD` | Netgsm → Abonelik İşlemleri → Alt Kullanıcı Hesapları'nda açılan **API kullanıcısının** şifresi (SMS yetkili, IP kısıtlaması yok) |
| `NETGSM_HEADER` | Onaylı gönderici adı, panelde yazdığı gibi (Abonelik İşlemleri → Online Başvurular → Gönderici Adı Başvurusu) |

## 2. Akışları içeri al

1. n8n → **Import from file** ile iki JSON dosyasını al.
2. `Randevox Event` düğümünde path'i tahmin edilemez bir değerle değiştir: `randevox-events-<rastgele>`.
3. İki akışı da **Active** yap.
4. Production webhook adresini (`https://<n8n>/webhook/randevox-events-<rastgele>`) Vercel'e
   `N8N_EVENTS_URL` olarak yaz, sonra redeploy et.

## 3. Meta'ya onaya gönderilecek şablonlar

Kategori: **Utility**, dil: **Turkish (tr)**. Değişkenler sırayla doldurulur.

**`randevu_onay`**, 4 değişken: ad, klinik, tarih, saat
> Merhaba {{1}}, {{2}} için randevunuz oluşturuldu: {{3}}, saat {{4}}. Değişiklik için kliniği arayabilirsiniz.

**`randevu_hatirlatma_24s`**, 4 değişken: ad, klinik, tarih, saat
> Merhaba {{1}}, {{2}} randevunuzu hatırlatırız: {{3}}, saat {{4}}. Gelemeyecekseniz lütfen kliniği arayın.

**`randevu_hatirlatma_2s`**, 3 değişken: ad, klinik, saat
> Merhaba {{1}}, {{2}} randevunuza az kaldı: bugün saat {{3}}. Sizi bekliyoruz.

**`randevu_iptal`**, 4 değişken: ad, klinik, tarih, saat
> Merhaba {{1}}, {{2}} için {{3}} saat {{4}} randevunuz iptal edildi. Yeni randevu için kliniği arayabilirsiniz.

**`randevu_degisiklik`**, 4 değişken: ad, klinik, yeni tarih, yeni saat
> Merhaba {{1}}, {{2}} randevunuzun saati değişti. Yeni randevunuz: {{3}}, saat {{4}}. Uygun değilse lütfen kliniği arayın.

İptal ve değişiklik mesajları yalnızca panelden (/randevular) yapılan işlemlerde ve randevu saati
henüz geçmemişse gider.

SMS'te şablon onayı yok; metinler aynı cümlelerle doğrudan akışta yazılı. Bilgilendirme mesajı
olarak gönderilir (`iysfilter: 0`), İYS izni gerekmez.

## 4. Klinikte aç

admin → Klinikler → Yönet → Ayarlar → **Hasta mesajları** → **SMS** (Netgsm değişkenleri
girilince) ya da **WhatsApp** (şablonlar onaylanınca) → **Ayarları kaydet**. Kapalıyken hastaya
mesaj gitmez, kliniğe e-posta yine gider.

## Test

- Yanlış imzalı istek 401 dönmeli:
  `curl -X POST <N8N_EVENTS_URL> -H "content-type: application/json" -H "x-randevox-signature: x" -d "{}"`
- Randevox tarafı:
  `curl -H "Authorization: Bearer <AUTOMATION_SECRET>" "https://www.randevoxai.com/api/automation/due-reminders?kind=24h"`
  → `{"kind":"24h","reminders":[...]}`. Anahtar olmadan 401 dönmeli.
