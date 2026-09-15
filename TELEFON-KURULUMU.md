# Telefon hattı kurulumu (Netgsm → Vapi → Randevox)

Bu adımlar her klinik için **bir kez** yapılır. Ajanları kurmak için bu listeye gerek
yok, ajanlar Randevox'tan otomatik kurulur. Buradaki iş, kliniğin numarasını Vapi'ye
bağlamaktır.

```
Arayan → Netgsm numarası → SIP trunk → Vapi (BYO numara) → Randevox'un kurduğu ajan
                                                  ↓ webhook
                                  https://www.randevoxai.com/api/vapi/webhook
```

## 1. Netgsm

1. Numara alınır: 0850 veya kliniğin ilindeki sabit numara. Bunun için BTK evrakı gerekir.
   Numaraya **Ses Hizmeti / SIP** özelliği açtırılır.
2. **Ses Hizmeti → Ayarlar → SIP Bilgileri** ekranından kullanıcı adı ve şifre alınır.
   Sunucu: `sip.netgsm.com.tr`, port `5060`.
3. Gelen aramalar SIP trunk ile Vapi'ye yönlendirilir: **Ses Hizmeti → Ayarlar → SIP
   Bilgileri → SIP Trunk** açılır, "SIP Trunk Bilgileri" alanına
   `<kimlik-bilgisi-id>.sip.vapi.ai` yazılır (ID, 2. bölüm 1. adımda Vapi'de oluşan SIP
   trunk kimlik bilgisinin ID'sidir; düz `sip.vapi.ai` hangi trunk'a gideceğini
   belirtmez), port `5060`. Panelde bu seçenek yoksa Netgsm destekten istenir.
4. Vapi'nin IP adreslerine izin verilir:
   - Sinyal (SIP): `44.229.228.186` ve `44.238.177.138` (ABD)
   - Ses (medya): UDP `40000–60000`
5. Numara biçimi: arayan numarasının başına `0` eklenir; aranan numara `+90` ile
   başlayacak şekilde ayarlanır.

## 2. Vapi paneli

1. **Integrations → SIP Trunk**: yeni bir kimlik bilgisi oluşturulur (`byo-sip-trunk`).
   - Gateway: `sip.netgsm.com.tr`, port 5060
   - Giden arama doğrulaması: 1. bölümdeki Netgsm kullanıcı adı ve şifresi
2. **Phone Numbers → Import → BYO SIP Trunk Number**:
   - Numara `+90` ile yazılır (`+90850xxxxxxx`), 1. adımdaki kimlik bilgisi seçilir.
     Netgsm aranan numaranın başına `+90` ekleyerek gönderir (1. bölüm, 5. adım); Vapi'deki
     numara bununla birebir aynı olmazsa Vapi aramayı reddeder ve arayan Netgsm'in
     "yanlış numara" anonsunu duyar.
   - **Allow non-E164** seçeneği açılır.
   - Aynı numarayı Vapi'ye ikinci kez (örneğin giden arama için ayrı) eklemeyin.
3. Oluşan numaranın **ID**'si kopyalanır. Bu ID bir UUID'dir, numaranın kendisi değildir.

Vapi panelinde **ajan oluşturulmaz**, ajana talimat da yapıştırılmaz.

## 3. Randevox admin paneli (/admin → Klinikler → Yönet)

1. **Ayarlar** bölümünde **Vapi numara ID** alanına 2. bölümde kopyalanan ID yazılır.
   Aynı yerde **Aktarma numarası** da doldurulur; arayan "bir insanla konuşmak istiyorum"
   derse bu numaraya aktarılır. Sonra **Ayarları kaydet**'e basılır.
2. **Takvim** bölümünde Cal.com API anahtarı ve event type id girilir.
3. **Telefon** bölümünde:
   1. **Ajanları Vapi'ye kur** butonuna basılır. Kliniğin tüm ajanları Vapi'de oluşur.
   2. **Gelen aramaları karşılayan ajan** seçilir (örneğin Reception).
   3. **Numaraya bağla** butonuna basılır.

Bundan sonra klinik /agents sayfasında bir ajanı değiştirip kaydettiğinde, değişiklik
Vapi'ye kendiliğinden gider.

## 4. Test

- Numara aranır. Ajan karşılama cümlesiyle açmalı.
- "Yarın için boş saat var mı?" diye sorulur. Gerçek saatler okunmalı, seçilen saat
  kliniğin Cal.com takvimine düşmeli.
- "Bir yetkiliyle görüşmek istiyorum" denir. Arama aktarma numarasına geçmeli.
- Kapattıktan sonra arama birkaç saniye içinde /calls sayfasında görünmeli.

## Sorun giderme

| Belirti | Neden / çözüm |
|---|---|
| Arama hiç çalmıyor | Netgsm yönlendirmesi ya da IP izinleri eksik (1. bölüm, 3. ve 4. adımlar). |
| Çalıyor ama ses yok | UDP 40000–60000 kapalı. |
| Admin'de "hiçbir ajana bağlı değil" | 3. bölümdeki Telefon adımları yapılmamış. |
| Ajan "sistemde bir sorun oldu" deyip aktarıyor | Vercel'deki `VAPI_WEBHOOK_SECRET` ile ajanı kaydeden ortamın değeri farklı. Değerler eşitlenir, sonra ajanlar yeniden kurulur. |
| Arama /calls'ta görünmüyor, Vercel loglarında `unknown assistant` yazıyor | Ajan Vapi panelinde elle oluşturulmuş. Randevox'tan kurulan ajan kullanılmalı. |
