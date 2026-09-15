# Randevox n8n otomasyonu — Claude Code tarifi

Bu dosyanın tamamını Railway + Composio bağlı Claude Code oturumuna ver.

> Randevox için n8n otomasyonunu Railway'e kurmanı istiyorum. Railway ve n8n işlemleri için
> Composio'yu kullan; Composio'da Railway yoksa Railway CLI'ı kullan. Proje klasörü:
> `C:\Users\PC\Desktop\Ai voice agent\randevox`. Önce `n8n/FAZ3-KURULUM.md`,
> `lib/automation/emit.ts` ve `app/api/automation/*` dosyalarını oku.

### 1. Railway'de n8n

- Yeni Railway projesi: **n8n** servisi (`n8nio/n8n` imajı) ve **Postgres** servisi.
- n8n ortam değişkenleri:
  - `DB_TYPE=postgresdb` ve `DB_POSTGRESDB_HOST/PORT/DATABASE/USER/PASSWORD` (Railway Postgres'ten referansla)
  - `N8N_ENCRYPTION_KEY`: rastgele 32 bayt hex. **Bana ayrıca ver, yedekleyeceğim.**
  - `N8N_HOST` ve `WEBHOOK_URL`: Railway'in verdiği public domain (`https://…up.railway.app/`), `N8N_PROTOCOL=https`, `N8N_PORT=5678`
  - `GENERIC_TIMEZONE=Europe/Istanbul`, `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`
  - `AUTOMATION_SECRET`: `randevox/.env.local` içindeki değerin **aynısı** (değeri ekrana yazdırma)
  - `RANDEVOX_URL=https://www.randevoxai.com`
  - `RESEND_API_KEY`, `RESEND_FROM=Randevox <bildirim@randevoxai.com>`: bana sor
  - `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`: Meta onayı gelince bana sor, o zamana kadar boş kalsın
- Public domain aç. n8n açılınca owner hesabını ben oluşturacağım, bekle.

### 2. Akışları içeri al

- `n8n/randevox-events.json` ve `n8n/randevox-reminders.json` dosyalarını n8n'e import et
  (n8n API'si ya da arayüz).
- `Randevox Event` webhook düğümündeki `randevox-events-REPLACE-ME` path'ini
  `randevox-events-<12 haneli rastgele hex>` yap.
- İki akışı da **Active** yap.
- Production webhook adresini (`<WEBHOOK_URL>webhook/randevox-events-<hex>`) bana ver.
  Randevox'ta `N8N_EVENTS_URL` olarak kullanılacak.

### 3. Akışlar ne yapıyor (bozulmaması gereken sözleşme)

**A) Olaylar: `POST <N8N_EVENTS_URL>`**, Randevox gönderir.
- Başlık: `x-randevox-signature` = gövdenin `AUTOMATION_SECRET` ile HMAC-SHA256'sı (hex).
  İmza tutmazsa **401**. Randevox 5 sn bekler, bu yüzden hemen 200 dön, işi sonra yap.
- Gövde:
  ```json
  {
    "source": "randevox",
    "type": "call.completed | appointment.cancelled | appointment.rescheduled",
    "sentAt": "ISO",
    "clinic": { "id": "", "name": "", "timeZone": "Europe/Istanbul", "notifyEmail": "…|null", "whatsappEnabled": false },
    "data": { }
  }
  ```
- `call.completed` içindeki `data`: `callId, agentName, caller, number, phone (+90… ya da null),
  startedAt, durationSec, outcome (booked|transferred|voicemail|resolved|missed), sentiment,
  summary, confirm (bool), appointment: { startsAt, date: "15 Eylül Salı", time: "14:30",
  attendeeName } | null`
- Kurallar:
  - `appointment` varsa **ve** `clinic.whatsappEnabled && data.confirm && data.phone` doğruysa →
    hastaya `randevu_onay` şablonu (ad, klinik, tarih, saat).
  - `appointment` yoksa **ve** `clinic.notifyEmail` doluysa → Resend ile kliniğe
    "Randevu alınamayan arama" e-postası (arayan, numara, ajan, sonuç, duygu, özet).
  - `appointment.cancelled` / `appointment.rescheduled` şimdilik yok sayılır.

**B) Hatırlatma: her 15 dakikada bir**
- `GET {RANDEVOX_URL}/api/automation/due-reminders?kind=24h` ve `?kind=2h`,
  başlık `Authorization: Bearer {AUTOMATION_SECRET}`.
- Dönen cevap: `{ kind, reminders: [{ id, kind, startsAt, date, time, attendeeName, phone, clinic: { id, name } }] }`.
  Liste yalnızca WhatsApp'ı açık ve aktif kliniklerin randevularını içerir.
- Her kayıt için WhatsApp şablonu gönderilir:
  - `24h` → `randevu_hatirlatma_24s` (ad, klinik, tarih, saat)
  - `2h` → `randevu_hatirlatma_2s` (ad, klinik, saat)
- Mesaj başarıyla gidince `POST {RANDEVOX_URL}/api/automation/reminders/sent`, gövde
  `{ "id": "...", "kind": "24h|2h" }`, aynı Bearer başlığıyla. **Mesaj gitmeden bu çağrılmaz.**
  Böylece başarısız mesaj bir sonraki turda tekrar denenir, başarılı olan iki kez gitmez.

**WhatsApp gönderimi:** Meta Cloud API'ye doğrudan istek, aracı firma yok.
`POST https://graph.facebook.com/v21.0/{WHATSAPP_PHONE_NUMBER_ID}/messages`,
`Authorization: Bearer {WHATSAPP_TOKEN}`, gövde
`{ messaging_product: "whatsapp", to: "90…" (artısız), type: "template", template: { name, language: { code: "tr" }, components: [{ type: "body", parameters: [{ type: "text", text }] }] } }`.

**E-posta:** `POST https://api.resend.com/emails`, `Authorization: Bearer {RESEND_API_KEY}`,
gövde `{ from: RESEND_FROM, to: [notifyEmail], subject, html }`.

### 4. Test et ve bana raporla

1. Yanlış imzalı `POST <N8N_EVENTS_URL>` → **401** dönmeli.
2. Doğru imzalı sahte `call.completed` gönder: `appointment: null`, `clinic.notifyEmail` bana ait
   bir test adresi → e-posta gelmeli. İmzayı Node `crypto.createHmac('sha256', AUTOMATION_SECRET)`
   ile hesapla, gövdeyi `JSON.stringify` ile tek seferde üret ve aynen gönder.
3. Hatırlatma akışını elle bir kez çalıştır → Randevox 200 dönmeli (liste boş olabilir).
   Anahtarsız istek 401 dönmeli.
4. Bana şunları ver: n8n adresi, `N8N_EVENTS_URL`, `N8N_ENCRYPTION_KEY`, testlerin sonucu.
   Gizli değerleri ekrana basma; `N8N_ENCRYPTION_KEY`'i ayrı bir dosyaya yaz.

**Yapma:** Randevox kodunu değiştirme, Vercel'e dokunma, WhatsApp mesajı gönderme
(Meta onayı gelmeden token yok). Her klinik için ayrı akış kopyalama; tek akış hepsine hizmet eder.
