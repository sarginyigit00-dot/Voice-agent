# n8n güncellemesi — iptal ve erteleme mesajı

Diğer Claude Code oturumuna ver. Randevox kodu hazır, sadece canlı n8n'deki "Olaylar" akışı güncellenecek.

## Ne değişti

`n8n/randevox-events.json` artık 13 düğüm. "Arama bitti mi?" düğümünün **false** çıkışına iki düğüm eklendi:

- **İptal / değişiklik bildirilsin mi?** Olay `appointment.cancelled` ya da `appointment.rescheduled` olmalı. Ayrıca şu dördü de doğru olmalı:
  - `clinic.whatsappEnabled`
  - `data.phone` dolu
  - `data.startsAt` gelecekte
- **WhatsApp: iptal / değişiklik** Olaya göre `randevu_iptal` ya da `randevu_degisiklik` şablonunu gönderir. Değişkenler: ad, klinik, tarih, saat.

## Yapılacaklar

1. Canlı n8n'de **"Randevox — Olaylar (onay + klinik uyarısı)"** akışının id'sini bul (`GET /api/v1/workflows`).
2. O akıştaki `Randevox Event` düğümünün **mevcut webhook path'ini** not al. Bu path Vercel'deki `N8N_EVENTS_URL` ile aynı, **değişmemeli**.
3. `n8n/randevox-events.json` dosyasını oku ve `Randevox Event` düğümünün `parameters.path` alanını 2. adımdaki path ile değiştir. `webhookId` alanını da canlı akıştaki değerle aynı yap.
4. `PUT /api/v1/workflows/<id>` isteğiyle akışı güncelle. Gövdede yalnızca `name`, `nodes`, `connections`, `settings` alanları olsun.
5. Akış pasif kaldıysa `POST /api/v1/workflows/<id>/activate` ile tekrar aktif et.
6. Test:
   - Yanlış imzalı `POST <N8N_EVENTS_URL>` → **401** dönmeli.
   - Doğru imzalı, `whatsappEnabled: false` olan sahte bir `appointment.cancelled` olayı → **200** dönmeli.
   - n8n Executions'ta akış hatasız bitmeli ve WhatsApp düğümü **çalışmamalı**.
7. Bana sonucu yaz: akış id'si, path'in değişmediği, test sonuçları.

**Yapma:** Webhook path'ini değiştirme. Randevox koduna ve Vercel'e dokunma. WhatsApp mesajı gönderme. Gizli değerleri ekrana yazdırma.
