# Prompt 1 — Waitlist karşılama e-postası (n8n + Gmail)

> Bu dosyanın tamamını Claude Code'a yapıştır.

---

Randevox'ta bekleme listesi karşılama e-postasını uçtan uca çalışır hale getir.
n8n'i Docker'da self-hosted çalıştırıyorum, e-posta Gmail ile gidecek.

## Bağlam (kod tarafı zaten hazır, DEĞİŞTİRME)

- `app/api/waitlist/route.ts` → `/on-kayit` formu POST edilince e-postayı Supabase
  `waitlist_emails` tablosuna yazıyor, sonra `triggerWelcomeEmail()` ile
  `WAITLIST_WEBHOOK_URL`'e `{ "email": "..." }` POST ediyor.
- Fire-and-forget: webhook patlarsa kayıt yine başarılı sayılıyor, sadece
  console'a `[waitlist] n8n webhook failed:` düşüyor. Bu davranışı koru.
- `WAITLIST_WEBHOOK_URL` boşsa fetch hiç yapılmıyor.
- Akış repoda hazır: `n8n/waitlist-welcome-email.json`

## Yapılacaklar

### 1. n8n'i Docker'da ayağa kaldır

Kurulu değilse named volume ile kalıcı bir kurulum yap:

```bash
docker volume create n8n_data
docker run -d --name n8n -p 5678:5678 \
  -v n8n_data:/home/node/.n8n \
  -e GENERIC_TIMEZONE=Europe/Istanbul \
  -e TZ=Europe/Istanbul \
  docker.n8n.io/n8nio/n8n
```

`http://localhost:5678` açılıyor mu doğrula, owner hesabını kur.

> Named volume şart — `-v` olmadan container silindiğinde tüm workflow'lar ve
> credential'lar gider.

### 2. Akışı import et

n8n arayüzünde: **Workflows → ⋯ → Import from File** → `n8n/waitlist-welcome-email.json`

Şu zinciri görmeliyim:

```
Waitlist Email Received (Webhook)
  → Extract Email
  → Onboarding Checklist
  → Personalize Using Gemini   ←  Google Gemini Chat Model (ai_languageModel)
  → Send Welcome Email (Gmail)
```

### 3. Gemini credential'ı bağla

`Google Gemini Chat Model` node'u `models/gemini-2.0-flash` kullanıyor ve
credential'ı boş geliyor. https://aistudio.google.com/apikey adresinden ücretsiz
bir API key al, n8n'de **Google Gemini(PaLM) API** credential'ı olarak ekle.

**Alternatif:** `.env.local`'de zaten dolu bir `ANTHROPIC_API_KEY` var. İstersen
Gemini node'unu silip yerine **Anthropic Chat Model** node'u koy, `claude-sonnet-5`
seç ve `Personalize Using Gemini` node'unun `ai_languageModel` girişine bağla.
Prompt metni aynen çalışır. Bana hangisini kurduğunu söyle.

### 4. Gmail credential'ı bağla

`Send Welcome Email` node'u Gmail OAuth2 istiyor:

1. Google Cloud Console'da yeni proje → **Gmail API**'yi enable et.
2. OAuth consent screen: **External**, test user olarak kendi adresini ekle.
3. Credentials → **OAuth client ID** → *Web application*. Authorized redirect URI:
   ```
   http://localhost:5678/rest/oauth2-credential/callback
   ```
4. Client ID + Secret'ı n8n'de **Gmail OAuth2** credential'ına gir,
   "Connect my account" ile yetkilendir.

> Uygulama "Testing" modundayken sadece test user listesindeki adresler
> yetkilendirilebilir ve token ~7 günde bir düşer. Kendi adresinle
> gönderdiğin sürece sorun değil.

### 5. Gmail node'unda satır sonu düzeltmesini yap ⚠️ ÖNEMLİ

Gmail node'u varsayılan olarak **HTML** gönderiyor, ama LLM'den gelen
`{{ $json.text }}` düz metin. Bu haliyle e-postadaki tüm satırlar tek bir bloğa
yapışır.

Node parametrelerinde **Email Type = Text** yap (JSON karşılığı: `parameters`
içine `"emailType": "text"`).

Bu düzeltmeyi `n8n/waitlist-welcome-email.json` dosyasına da işle ki bir dahaki
import'ta tekrar uğraşmayayım.

### 6. Webhook URL'ini al ve .env.local'e yaz

`Waitlist Email Received` node'unu aç, **Production URL**'i kopyala:

```
http://localhost:5678/webhook/randevox-waitlist
```

- ⚠️ `/webhook-test/` **DEĞİL** — o sadece "Listen for test event" basılıyken çalışır.
- ⚠️ Production URL'in çalışması için workflow sağ üstten **Active** edilmeli.

`.env.local`'de mevcut boş satırı doldur (yeni satır ekleme, var olanı düzenle):

```
WAITLIST_WEBHOOK_URL=http://localhost:5678/webhook/randevox-waitlist
```

Sonra dev server'ı yeniden başlat — Next.js env'i sadece boot'ta okur.

### 7. Test et

1. n8n'de workflow'u **Active** yap.
2. `npm run dev` → `http://localhost:3000/on-kayit` → gerçek bir e-posta gir.
3. Doğrula:
   - [ ] Sayfada başarı mesajı çıktı
   - [ ] Supabase `waitlist_emails` tablosuna satır düştü (Supabase MCP ile bak)
   - [ ] n8n → Executions'da yeşil bir çalıştırma var
   - [ ] Gmail'e Türkçe, kişiselleştirilmiş, satır sonları düzgün bir mail geldi
4. Terminal'de `[waitlist] n8n webhook failed:` hatası **olmamalı**.

Sorun çıkarsa n8n Executions'daki node çıktılarına bak — özellikle
`Extract Email` node'unun `$json.body.email` alanını gerçekten yakalayıp
yakalamadığına.

### 8. Deploy notu (şimdi yapma, sadece hatırlat)

Vercel'e çıkınca `localhost:5678` erişilemez olur. O noktada:

- n8n'i public bir domain arkasına al,
- container'a `-e WEBHOOK_URL=https://n8n.randevoxai.com/` ver (Production URL'ler
  bu adrese göre üretilir),
- Vercel'deki `WAITLIST_WEBHOOK_URL` env'ini o adrese çevir.

---

## İlgili dosyalar

| Dosya | Rolü |
|---|---|
| `app/api/waitlist/route.ts` | Webhook'u tetikleyen endpoint |
| `lib/waitlist/queries.ts` | `waitlist_emails` insert'i |
| `n8n/waitlist-welcome-email.json` | Import edilecek akış |
| `supabase/schema.sql` | `waitlist_emails` tablosu |
