# n8n güncellemesi — Netgsm SMS kanalı

Randevox kodu hazır. Canlı n8n'deki iki akış bu klasördeki JSON'larla değiştirilecek.

## Ne değişti

- Her klinikte bir **mesaj kanalı** var: `off`, `sms`, `whatsapp` (`clinics.message_channel`).
  Olayda `clinic.messageChannel` olarak, hatırlatmada her kayıtta `channel` olarak gelir.
- **Olaylar** akışı (17 düğüm): onay ve iptal / değişiklik mesajı önce kanala bakar.
  `sms` → Netgsm, `whatsapp` → Meta. SMS yalnızca `+905…` numaralara gider.
- **Hatırlatma** akışı (9 düğüm): `channel === 'sms'` → Netgsm. Netgsm `jobid` döndürmezse
  kayıt "gönderildi" işaretlenmez, 15 dk sonra tekrar denenir. Akışın adı
  "Randevox — Randevu hatırlatma (SMS / WhatsApp)" oldu (eskisi "… (WhatsApp)").
- Eski olaylarla da çalışır: `messageChannel` yoksa `whatsappEnabled`'a bakar.

## Yapılacaklar

1. Railway → randevox-n8n → n8n → Variables: `NETGSM_USERCODE`, `NETGSM_PASSWORD`,
   `NETGSM_HEADER` girilmiş olmalı, sonra **Deploy**.
2. Canlı n8n'de iki akışın id'sini bul (`GET /api/v1/workflows`, başlık `X-N8N-API-KEY`).
3. **Olaylar** akışındaki `Randevox Event` düğümünün mevcut `parameters.path` ve `webhookId`
   değerlerini not al. Bunlar Vercel'deki `N8N_EVENTS_URL` ile aynı, **değişmemeli**.
4. `randevox-events.json`'u oku, `Randevox Event` düğümüne 3. adımdaki path ve webhookId'yi
   **bellekte** yaz (repodaki dosya değişmesin).
5. İki akış için `PUT /api/v1/workflows/<id>`, gövdede yalnızca `name`, `nodes`, `connections`,
   `settings`. Pasif kaldıysa `POST /api/v1/workflows/<id>/activate`.
6. Test:
   - Yanlış imzalı `POST <N8N_EVENTS_URL>` → **401**.
   - Doğru imzalı, `messageChannel: "off"` olan sahte `call.completed` → **200**, Executions'ta
     SMS düğümü **çalışmamalı**.
   - Hatırlatma akışını elle bir kez çalıştır: "Zamanı gelenler" **200** almalı.

Elle yapmak istersen: n8n'de eski akışı aç → sağ üst **⋯ → Import from file** ile JSON'u al →
`Randevox Event` düğümünün path'ini eskisiyle aynı yap → Save → Active.

**Yapma:** Webhook path'ini değiştirme. Gerçek hastaya SMS gönderme. Gizli değerleri ekrana
yazdırma.
