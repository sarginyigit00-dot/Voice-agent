# Randevox otomasyonu — Modal kurulumu

n8n'in yerini aldı. Tek dosya (`app.py`), üç iş:

| İş | Ne yapar |
|---|---|
| `events` (web endpoint) | Arama bitince Randevox imzalı bir olay gönderir (`lib/automation/emit.ts`). Randevu alındıysa hastaya onay mesajı, alınmadıysa kliniğe e-posta gider. Panelden iptal edilen/ertelenen randevu için de hastaya mesaj gider. |
| `reminders` (her 15 dk) | Randevuya 24 saat ve 2 saat kala hastaya hatırlatma gönderir. |
| `lead_callbacks` (her 5 dk) | "Hızlı geri dönüş" — mesai dışı gelen ya da araması başarısız olan başvuruları arattırır. |

Hasta mesajı kliniğin **mesaj kanalından** gider (admin → Klinikler → Yönet → Ayarlar →
**Hasta mesajları**): Kapalı, SMS (Netgsm) ya da WhatsApp. SMS yalnızca Türkiye cep
numaralarına (+905…) gider.

## 1. Modal hesabı ve CLI

```
pip install modal
modal setup   # tarayıcıda hesabına bağlar
```

## 2. Secret'ı oluştur

Modal dashboard → Secrets → **New secret** → adı **`randevox-automation`**, aşağıdaki
anahtarları gir (aynı değerler `.env.local` / Vercel'de zaten var):

| Anahtar | Değer |
|---|---|
| `RANDEVOX_URL` | `https://www.randevoxai.com` |
| `AUTOMATION_SECRET` | Randevox'taki (`.env.local` ve Vercel) değerin aynısı |
| `RESEND_API_KEY` | Resend → API Keys |
| `RESEND_FROM` | `Randevox <bildirim@randevoxai.com>` |
| `WHATSAPP_TOKEN` | Meta → kalıcı (System User) erişim anahtarı |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta → WhatsApp → API Setup → Phone number ID |
| `NETGSM_USERCODE` | Netgsm abone numarası (ör. `8508403483`) |
| `NETGSM_PASSWORD` | Netgsm → Abonelik İşlemleri → Alt Kullanıcı Hesapları'nda açılan **API kullanıcısının** şifresi |
| `NETGSM_HEADER` | Onaylı gönderici adı, panelde yazdığı gibi |

Ya da CLI ile:

```
modal secret create randevox-automation \
  RANDEVOX_URL=https://www.randevoxai.com \
  AUTOMATION_SECRET=... \
  RESEND_API_KEY=... RESEND_FROM="Randevox <bildirim@randevoxai.com>" \
  WHATSAPP_TOKEN=... WHATSAPP_PHONE_NUMBER_ID=... \
  NETGSM_USERCODE=... NETGSM_PASSWORD=... NETGSM_HEADER=...
```

## 3. Deploy

```
cd automation
modal deploy app.py
```

Çıktıda üç şey görürsün: iki zamanlanmış fonksiyon (`reminders`, `lead_callbacks`) ve bir web
endpoint URL'i, şuna benzer:

```
https://<workspace>--randevox-automation-events.modal.run
```

## 4. Randevox tarafını bağla

`.env.local` (ve Vercel → Environment Variables) içinde:

```
AUTOMATION_EVENTS_URL=https://<workspace>--randevox-automation-events.modal.run
AUTOMATION_SECRET=...   # secret'takiyle birebir aynı
```

Vercel'e yazdıysan **redeploy** et.

## 5. Meta'ya onaylatılacak WhatsApp şablonları

Kategori: **Utility**, dil: **Turkish (tr)**. Değişkenler sırayla doldurulur.

- **`randevu_onay`** (4): ad, klinik, tarih, saat — "Merhaba {{1}}, {{2}} için randevunuz oluşturuldu: {{3}}, saat {{4}}. Değişiklik için kliniği arayabilirsiniz."
- **`randevu_hatirlatma_24s`** (4): ad, klinik, tarih, saat
- **`randevu_hatirlatma_2s`** (3): ad, klinik, saat
- **`randevu_iptal`** (4): ad, klinik, tarih, saat
- **`randevu_degisiklik`** (4): ad, klinik, yeni tarih, yeni saat

SMS'te şablon onayı yok — metinler `app.py` içinde doğrudan yazılı, bilgilendirme mesajı
olarak gönderilir (`iysfilter: 0`), İYS izni gerekmez.

## Test

- Yanlış imzalı istek 401 dönmeli:
  `curl -X POST <AUTOMATION_EVENTS_URL> -H "content-type: application/json" -H "x-randevox-signature: x" -d "{}"`
- Randevox tarafı:
  `curl -H "Authorization: Bearer <AUTOMATION_SECRET>" "https://www.randevoxai.com/api/automation/due-reminders?kind=24h"`
  → `{"kind":"24h","reminders":[...]}`. Anahtar olmadan 401 dönmeli.
- Modal dashboard → App → **Logs** sekmesinden her üç fonksiyonun çalıştığını izleyebilirsin;
  zamanlanmış fonksiyonları **Run now** ile elle de tetikleyebilirsin.

## Geliştirirken

```
modal serve app.py
```

canlıya dokunmadan `events` endpoint'ini geçici bir URL'de çalıştırır (zamanlanmış
fonksiyonlar `serve` sırasında tetiklenmez, yalnızca `deploy` sonrası zamanlanır).
