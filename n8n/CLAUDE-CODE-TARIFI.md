# Randevox n8n otomasyonu — Claude Code için yapılacaklar

Bu dosyayı okuyan Claude Code oturumu: aşağıdaki adımları **sırayla** uygula. Her adımın
sonunda kullanıcıya kısaca ne yaptığını söyle. Bir adım kullanıcıdan bir şey istiyorsa dur ve
iste.

## Amaç

Randevox (Next.js, bu klasör, canlı: `https://www.randevoxai.com`) arama bitince imzalı bir olay
gönderiyor. Bu olayı işleyecek ve randevu hatırlatmalarını gönderecek **n8n**'i Railway'e kur,
repodaki hazır iki akışı içeri al ve Randevox'a bağla:

| Akış | Ne yapar |
|---|---|
| `n8n/randevox-events.json` | Randevu alındıysa hastaya WhatsApp onayı, alınmadıysa kliniğe e-posta (Resend) |
| `n8n/randevox-reminders.json` | 15 dakikada bir, randevuya 24 saat ve 2 saat kala hastaya WhatsApp hatırlatması |

## Kurallar

- Randevox kodunu **değiştirme**. İzin verilen tek dosya `randevox/.env.local`, orada da sadece
  `N8N_EVENTS_URL` satırı.
- **Vercel'e dokunma.** Vercel adımını kullanıcı kendisi yapacak (Adım 7).
- **WhatsApp mesajı gönderme.** Meta onayı gelmeden token yok, akışlar WhatsApp'ı atlar.
- Gizli değerleri (`AUTOMATION_SECRET`, API anahtarları, encryption key) **ekrana yazdırma**,
  commit etme. Komutlarda `.env.local`'dan okuyarak kullan.
- Her klinik için ayrı akış kopyalama. Tek akış seti tüm kliniklere hizmet eder.

---

## Adım 0 — Araçlar

1. Composio bağlıysa ve Railway araçları varsa Railway işlemleri için onları kullan.
2. Yoksa Railway CLI kur: `npm i -g @railway/cli`. Sonra kullanıcıdan şunu çalıştırmasını iste:
   `! railway login`. Tarayıcıdan giriş yapılır.
3. `railway whoami` ile girişi doğrula.

Komutlardaki bayraklar CLI sürümüne göre farklıysa `railway <komut> --help` ile kontrol et.

## Adım 1 — Railway projesi

```
railway init --name randevox-n8n
railway add --database postgres
railway add --service n8n --image n8nio/n8n:latest
```

## Adım 2 — n8n ayarları

`N8N_ENCRYPTION_KEY` üret (32 bayt hex). Değeri **repo dışına** kaydet:
`C:\Users\PC\randevox-n8n-encryption-key.txt`. Kullanıcıya bu dosyayı yedeklemesini söyle, çünkü
bu anahtar kaybolursa n8n'deki kimlik bilgileri açılamaz.

n8n servisine şu değişkenleri yaz (`railway variables --service n8n --set "KEY=VALUE" ...`):

| Değişken | Değer |
|---|---|
| `DB_TYPE` | `postgresdb` |
| `DB_POSTGRESDB_HOST` | `${{Postgres.PGHOST}}` |
| `DB_POSTGRESDB_PORT` | `${{Postgres.PGPORT}}` |
| `DB_POSTGRESDB_DATABASE` | `${{Postgres.PGDATABASE}}` |
| `DB_POSTGRESDB_USER` | `${{Postgres.PGUSER}}` |
| `DB_POSTGRESDB_PASSWORD` | `${{Postgres.PGPASSWORD}}` |
| `N8N_ENCRYPTION_KEY` | yukarıda üretilen değer |
| `N8N_PORT` | `5678` |
| `N8N_PROTOCOL` | `https` |
| `GENERIC_TIMEZONE` | `Europe/Istanbul` |
| `N8N_BLOCK_ENV_ACCESS_IN_NODE` | `false` (akışlar ayarları `$env` ile okur) |
| `AUTOMATION_SECRET` | `randevox/.env.local` içindeki değerin **aynısı** |
| `RANDEVOX_URL` | `https://www.randevoxai.com` |
| `RESEND_FROM` | `Randevox <bildirim@randevoxai.com>` |
| `RESEND_API_KEY` | Kullanıcıda varsa iste, yoksa şimdilik boş bırak (Adım 9) |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | Şimdilik **boş** (Adım 10) |

## Adım 3 — Adres

1. `railway domain --service n8n --port 5678` ile public adres al
   (`https://<ad>.up.railway.app`).
2. Şu değişkenleri de ekle, sonra `railway redeploy --service n8n -y` ile yeniden başlat:
   - `N8N_HOST=<ad>.up.railway.app`
   - `WEBHOOK_URL=https://<ad>.up.railway.app/`
   - `N8N_EDITOR_BASE_URL=https://<ad>.up.railway.app/`
3. Adres açılınca kullanıcıya ver ve **dur**.

## Adım 4 — Kullanıcı (sen bekle)

Kullanıcıdan şunları iste:
1. n8n adresini açıp **owner hesabını** oluşturmasını.
2. n8n → **Settings → n8n API → Create an API key** ile anahtar oluşturup sana vermesini.
   Anahtarı sadece bu oturumdaki komutlarda kullan, dosyaya yazma.

## Adım 5 — Akışları içeri al (n8n API)

1. 12 haneli rastgele hex üret: `<slug>`.
2. `n8n/randevox-events.json`'u oku. `Randevox Event` düğümündeki
   `randevox-events-REPLACE-ME` path'ini **bellekte** `randevox-events-<slug>` yap. Repodaki dosya
   değişmesin.
3. Her iki akış için: `POST <n8n>/api/v1/workflows`, başlık `X-N8N-API-KEY: <anahtar>`, gövde
   `{ name, nodes, connections, settings }`. JSON'daki bu dört alan zaten hazır.
4. Dönen id ile `POST <n8n>/api/v1/workflows/<id>/activate`.
5. Olay adresi: `N8N_EVENTS_URL = https://<ad>.up.railway.app/webhook/randevox-events-<slug>`

## Adım 6 — Randevox'a yerelde bağla

`randevox/.env.local` içindeki boş `N8N_EVENTS_URL=` satırına Adım 5'teki adresi yaz.

## Adım 7 — Kullanıcı Vercel'e yazar (sen yapma, tarif et)

Kullanıcıya şunu söyle:
1. vercel.com → **voice-agent** → Settings → Environment Variables → **Add**:
   - `AUTOMATION_SECRET`: `.env.local`'daki değer, Environment: **Production**
   - `N8N_EVENTS_URL`: Adım 5'teki adres, Environment: **Production**
2. **Deployments** → en üstteki → **⋯ → Redeploy**, "Ready" olmasını beklesin.

## Adım 8 — Test

1. **İmza testi.** Aşağıdaki betiği `randevox` klasöründe `node` ile çalıştır (geçici dosya,
   commit etme): `node test-event.mjs <N8N_EVENTS_URL> <kullanıcının test e-postası>`.
   Beklenen: yanlış imza **401**, doğru imza **200**. `RESEND_API_KEY` doluysa test
   e-postası da gelmeli.

   ```js
   // test-event.mjs
   import { createHmac } from "node:crypto";
   import fs from "node:fs";
   const env = Object.fromEntries(
     fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
       .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim()]),
   );
   const [url, email] = process.argv.slice(2);
   const body = JSON.stringify({
     source: "randevox", type: "call.completed", sentAt: new Date().toISOString(),
     clinic: { id: "test", name: "Test Klinik", timeZone: "Europe/Istanbul", notifyEmail: email, whatsappEnabled: false },
     data: {
       callId: "test-1", agentName: "Reception", caller: "Test Arayan", number: "05550000000",
       phone: "+905550000000", startedAt: new Date().toISOString(), durationSec: 42,
       outcome: "resolved", sentiment: "positive", summary: "Test araması, randevu alınmadı.",
       confirm: true, appointment: null,
     },
   });
   const sig = createHmac("sha256", env.AUTOMATION_SECRET).update(body).digest("hex");
   for (const [label, s] of [["yanlış imza", "x"], ["doğru imza", sig]]) {
     const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-randevox-signature": s }, body });
     console.log(label, r.status);
   }
   ```

2. **Hatırlatma testi.** Bu test Adım 7 tamamlandıktan sonra yapılır.
   - n8n'de "Randevox — Randevu hatırlatma" akışını elle bir kez çalıştır. "Zamanı gelenler"
     düğümü **200** almalı. Liste boş olabilir.
   - Anahtarsız istek **401** dönmeli:
     `curl -s -o /dev/null -w "%{http_code}" "https://www.randevoxai.com/api/automation/due-reminders?kind=24h"`

## Adım 9 — Rapor

Kullanıcıya şunları ver:
- n8n adresi,
- `N8N_EVENTS_URL`,
- encryption key dosyasının yeri,
- test sonuçları.

Bekleyen işleri de listele: Resend, Meta, Vercel.

---

## Sonra (anahtarlar gelince)

**Resend (klinik e-postası):**
- Kullanıcı Resend'de `randevoxai.com` alan adını ekler. Resend'in verdiği DNS kayıtları
  GoDaddy'ye girilir. Alan adının mevcut Google SPF kaydına dokunulmaz.
- Doğrulanınca n8n'de `RESEND_API_KEY` yazılır, servis redeploy edilir.

**WhatsApp (hasta mesajları):**
- Meta'da `n8n/FAZ3-KURULUM.md`'deki 3 şablon onaylanınca n8n'e `WHATSAPP_TOKEN` (kalıcı System
  User anahtarı) ve `WHATSAPP_PHONE_NUMBER_ID` yazılır, servis redeploy edilir.
- Kullanıcı Randevox admin → Klinikler → Yönet → Ayarlar → **WhatsApp mesajları** kutusunu açar.

---

## Ek: Sözleşme (akışları değiştirirsen bunlar bozulmasın)

**Olay: `POST <N8N_EVENTS_URL>`**, Randevox gönderir (`lib/automation/emit.ts`).
- Başlık `x-randevox-signature` = ham gövdenin `AUTOMATION_SECRET` ile HMAC-SHA256'sı (hex).
  Tutmazsa 401.
- Randevox 5 sn bekler: hemen 200 dön, işi sonra yap.
- Gövde:
  `{ source, type, sentAt, clinic: { id, name, timeZone, notifyEmail, messageChannel ('off'|'sms'|'whatsapp'), whatsappEnabled (eski, messageChannel === 'whatsapp') }, data }`
- `type`: `call.completed` | `appointment.cancelled` | `appointment.rescheduled`. Son ikisi
  şimdilik yok sayılır.
- `call.completed` → `data`: `callId, agentName, caller, number, phone (+90…|null), startedAt,
  durationSec, outcome (booked|transferred|voicemail|resolved|missed), sentiment, summary,
  confirm, appointment: { startsAt, date, time, attendeeName } | null`
- Kurallar:
  - Randevu var **ve** `data.confirm && data.phone` **ve** kanal açık → hastaya onay: `whatsapp`
    ise `randevu_onay` şablonu (ad, klinik, tarih, saat), `sms` ise Netgsm (yalnızca `+905…`).
  - Randevu yok **ve** `clinic.notifyEmail` dolu → kliniğe e-posta.

**Hatırlatma:** Randevox'un n8n'e açtığı iki adres. İkisi de
`Authorization: Bearer <AUTOMATION_SECRET>` ister.
- `GET /api/automation/due-reminders?kind=24h|2h` → `{ kind, reminders: [{ id, kind, startsAt, date, time, attendeeName, phone, clinic: { id, name } }] }`
- Her kayıt için WhatsApp gönderilir:
  - `24h` → `randevu_hatirlatma_24s` (ad, klinik, tarih, saat)
  - `2h` → `randevu_hatirlatma_2s` (ad, klinik, saat)
- Mesaj başarıyla gittikten **sonra** `POST /api/automation/reminders/sent { id, kind }`
  çağrılır. Böylece başarısız mesaj bir sonraki turda tekrar denenir, başarılı olan iki kez
  gitmez.

**WhatsApp:** `POST https://graph.facebook.com/v21.0/{WHATSAPP_PHONE_NUMBER_ID}/messages`,
`Authorization: Bearer {WHATSAPP_TOKEN}`, gövde:
`{ messaging_product: "whatsapp", to: "90…" (artısız), type: "template", template: { name, language: { code: "tr" }, components: [{ type: "body", parameters: [{ type: "text", text }] }] } }`

**E-posta:** `POST https://api.resend.com/emails`, `Authorization: Bearer {RESEND_API_KEY}`,
gövde `{ from, to: [notifyEmail], subject, html }`.
