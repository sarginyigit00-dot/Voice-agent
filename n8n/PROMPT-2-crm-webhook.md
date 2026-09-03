# Prompt 2 — Harici CRM webhook'u (n8n Catch Hook)

> Bu dosyanın tamamını Claude Code'a yapıştır.

---

Randevox'ta biten aramaları n8n'e ileten harici CRM webhook'unu kur.
n8n Docker'da self-hosted (Prompt 1'de kurduğum aynı instance).

## Bağlam (kod tarafı zaten hazır, DEĞİŞTİRME)

`lib/actions/executors/crm.ts`:

- `runCrm()` önce Supabase `crm_records` tablosuna upsert ediyor — **dahili CRM
  budur, `/crm` sayfasını o besler ve zaten çalışıyor.**
- Sonra `forwardToWebhook()` çağrılıyor: `CRM_WEBHOOK_URL` doluysa aynı kaydı
  oraya POST ediyor. Boşsa hiçbir şey yapmıyor.
- 5 saniyelik `AbortController` timeout'u var, hatalar yutuluyor (best-effort) —
  webhook patlasa bile dahili kayıt ve `crm` action'ı başarılı sayılıyor.
- `.env.local`'de `CRM_WEBHOOK_URL` satırı **hiç yok** — eklenmesi gerekiyor.

> ⚠️ `forwardToWebhook` **await ediliyor**. Yani n8n yavaş yanıt verirse `crm`
> action'ının sonucu 5 saniyeye kadar gecikir. Bu yüzden n8n Webhook node'u
> **Respond: Immediately** olmalı — ağır işi yanıttan sonra yapsın.

## Gelen payload'ın tam şekli

`lib/actions/types.ts` → `CallActionPayload`. Gövde:

```json
{
  "source": "randevox",
  "event": "call.completed",
  "call": {
    "callId": "call_123",
    "agentId": "agent_1",
    "agentName": "Resepsiyon",
    "caller": "Ayşe Yılmaz",
    "number": "+905550000000",
    "startedAt": "2026-08-25T10:12:00Z",
    "durationSec": 184,
    "outcome": "booked",
    "summary": "Salı 14:00 kontrol randevusu alındı.",
    "transcript": [
      { "speaker": "agent", "text": "Merhaba, size nasıl yardımcı olabilirim?", "atSec": 0 }
    ]
  }
}
```

n8n Webhook node'unda bu gövdeye **`$json.body`** üzerinden erişilir —
yani arama nesnesi `$json.body.call`.

## Yapılacaklar

### 1. Akışı import et

Repoda hazır: `n8n/crm-webhook-catch.json`
**Workflows → ⋯ → Import from File** ile içeri al. Adı: *Randevox — CRM Call Sync*.

Node zinciri:

```
Call Completed (Webhook, Respond: Immediately)
  → Normalize Call
  → Route By Outcome (Switch)
      ├─ booked     → Booked Target      (NoOp — değiştirilecek)
      ├─ qualified  → Qualified Target   (NoOp — değiştirilecek)
      └─ diğerleri  → Other Target       (NoOp — değiştirilecek)
Error Handler (Error Trigger) → Execution Failure
```

`Normalize Call` düz alanlar üretir: `callId, agentName, caller, number,
startedAt, durationSec, outcome, summary` ve transkripti tek metne düzleştiren
`transcriptText`.

### 2. Hedef node'larını bağla

Üç `NoOp` placeholder'ı gerçek hedeflerle değiştir. Ben ne istediğimi söyleyeceğim,
ama varsayılan olarak şunu kur:

- **Google Sheets → Append Row** (her üç dal da) — kolonlar:
  `startedAt | agentName | caller | number | outcome | durationSec | summary | transcriptText`
- **Slack → Post Message** (sadece `booked` dalına) — sıcak randevu bildirimi

HubSpot/Salesforce istersem: contact'ı `number` ile upsert, aramayı Call activity
olarak `summary` + `transcriptText` ile logla.

### 3. Webhook path'ini üret ve .env.local'e yaz

JSON'da path bir placeholder: `randevox-crm-REPLACE-ME`.

**Tahmin edilemez** bir slug üret (bu güvenlik önlemi — bkz. adım 5) ve hem n8n
Webhook node'unda hem `.env.local`'de aynısını kullan:

```bash
# örnek slug üretimi
openssl rand -hex 6
```

`.env.local`'de bu satır **hiç yok** — `.env.example`'daki sıraya sadık kalarak
CRM bölümüne ekle:

```
CRM_WEBHOOK_URL=http://localhost:5678/webhook/randevox-crm-<ÜRETİLEN-SLUG>
```

Workflow'u **Active** yap, dev server'ı yeniden başlat.

### 4. Test et

Önce kodu hiç çalıştırmadan, gerçek payload şekliyle doğrudan webhook'a bas:

```bash
curl -X POST http://localhost:5678/webhook/randevox-crm-<SLUG> \
  -H "Content-Type: application/json" \
  -d '{"source":"randevox","event":"call.completed","call":{"callId":"test-001","agentId":"a1","agentName":"Resepsiyon","caller":"Test Arayan","number":"+905550000000","startedAt":"2026-08-25T10:00:00Z","durationSec":95,"outcome":"booked","summary":"Test randevusu","transcript":[{"speaker":"agent","text":"Merhaba","atSec":0},{"speaker":"caller","text":"Randevu almak istiyorum","atSec":3}]}}'
```

Beklenen: `{"ok":true}` yanıtı, n8n Executions'da yeşil çalıştırma,
`Normalize Call` çıktısında düzgün `transcriptText` ve `booked` dalının seçilmesi.

Sonra uygulama üzerinden uçtan uca doğrula — bir aramayı bitirip `crm` action'ını
tetikle, ardından:

- [ ] Supabase `crm_records`'a satır düştü (Supabase MCP `execute_sql` ile bak;
      şu an tabloda 1 kayıt var, 2'ye çıkmalı)
- [ ] n8n'de ikinci bir execution göründü
- [ ] `/crm` sayfasında kayıt listelendi

### 5. Güvenlik ⚠️

`forwardToWebhook` özel bir header veya imza **göndermiyor** — yani URL'i bilen
herkes sahte arama kaydı POST edebilir. Kod değişikliği yapmadan alınacak önlem:
webhook path'ini tahmin edilemez uzun bir slug yapmak ve bu URL'i gizli tutmak
(adım 3). URL'i commit'leme, `.env.local` git'e girmiyor.

Daha sağlamını istersem — **şimdi uygulama, sadece anlat:**
`crm.ts`'e paylaşılan bir sır ile `X-Randevox-Signature` HMAC header'ı ekleyip
n8n Webhook node'unda Header Auth ile doğrulamak.

### 6. Cron ile karıştırma

`vercel.json`'daki `/api/cron/crm-sync` 5 dakikada bir `calls` → `crm_records`
senkronu yapıyor (`lib/crm/sync.ts`) ve `crm_records.actions` kolonunu orada
dolduruyor. Bu cron **n8n'e POST etmiyor** — sadece dahili tabloyu tamamlayan bir
güvenlik ağı. İki mekanizma ayrı.

> ⚠️ İlgili açık konu: `CRON_SECRET` `.env.local`'de tanımlı değil, yani
> `/api/cron/crm-sync` şu an **korumasız** (`app/api/cron/crm-sync/route.ts:12`).
> Local'de sorun değil, ama Vercel'e çıkmadan önce set edilmeli — Vercel Cron
> `Authorization: Bearer <secret>` header'ını otomatik gönderir.

### 7. Deploy notu

Prompt 1'deki ile aynı: Vercel'e çıkınca `localhost:5678` erişilemez.
n8n public bir domain arkasına alınmalı, container'a `-e WEBHOOK_URL=...` verilmeli
ve Vercel'deki `CRM_WEBHOOK_URL` o adrese çevrilmeli.

---

## İlgili dosyalar

| Dosya | Rolü |
|---|---|
| `lib/actions/executors/crm.ts` | Dahili CRM upsert + webhook forward |
| `lib/actions/types.ts` | `CallActionPayload` — payload şekli |
| `lib/actions/run.ts` | Executor'ları paralel çalıştırır |
| `lib/crm/sync.ts` | Cron senkronu (webhook'tan bağımsız) |
| `n8n/crm-webhook-catch.json` | Import edilecek akış |
