# Hızlı geri dönüş — kurulum

Hasta kliniğin formunu doldurur, kliniğin seçtiği ajan onu hemen arar. Mesai dışında gelen
başvuru klinik açılınca aranır. Başarısız arama en fazla 3 kez denenir; 3 günden eski başvuru
aranmaz. Aramalar /calls'ta diğer aramalar gibi görünür.

```
Klinik sitesi formu ──────────► POST /api/leads?key=… ─► ajan arar (Vapi)
Otomasyon uygulaması (Modal, 5 dk) ─► /api/automation/lead-callbacks ─► bekleyenleri arar
```

## 1. Admin

admin → Klinikler → Yönet:
1. **Ayarlar → Giden arama numara ID**: Vapi'de giden arama için ayrı bir numara varsa onun ID'si.
   Boşsa gelen arama numarasından aranır. Netgsm'de giden aramanın açık olması gerekir.
2. **Hızlı geri dönüş → Arayacak ajan** seç → **Kaydet**. Form adresi burada çıkar.
   Ajanın çalışma saatleri, ne zaman aranacağını belirler.

## 2. Kliniğin web sitesi

Form adresine `POST` edilir. JSON ya da düz HTML form olur.

| Alan | Zorunlu | Not |
|---|---|---|
| `phone` | evet | `0532…`, `+90532…` |
| `consent` | evet | `true` / `on`. **Açık rıza kutusu işaretlenmeden gönderilmemeli.** |
| `consent_text` | önerilir | İşaretlenen kutunun metni, aynen. Rızanın ispatı olarak lead'le birlikte saklanır. |
| `name` | hayır | Ajan hitap ederken kullanır |
| `note` | hayır | Ajana iletilir (ör. "implant fiyatı") |
| `source` | hayır | `web` (varsayılan), `meta` |
| `website` | — | Gizli bırakılacak bot tuzağı; doluysa başvuru yok sayılır |

Hazır form. Değiştirilecekler: `FORM_ADRESI` (admin'deki adres), `[Klinik Adı]` (iki yerde),
`AYDINLATMA_ADRESI` (kliniğin sitesindeki aydınlatma metni, şablon: `KVKK-AYDINLATMA-SABLONU.md`).

```html
<form id="randevox-form">
  <input name="name" placeholder="Adınız" />
  <input name="phone" placeholder="Telefon" required />
  <input name="note" placeholder="Hangi konuda?" />
  <input name="website" style="display:none" tabindex="-1" autocomplete="off" />
  <p>
    Kişisel verileriniz [Klinik Adı] tarafından talebinize dönüş yapmak amacıyla işlenir.
    Ayrıntılar: <a href="AYDINLATMA_ADRESI" target="_blank">Aydınlatma Metni</a>
  </p>
  <label>
    <input type="checkbox" name="consent" required />
    <span id="randevox-consent-text">Paylaştığım sağlık bilgileri dahil kişisel verilerimin, [Klinik Adı] tarafından beni yapay zekâ destekli sesli asistanla arayarak talebime dönüş yapılması amacıyla işlenmesine ve bu görüşmenin kaydedilmesine, Aydınlatma Metni kapsamında açık rıza veriyorum. Rızamı dilediğim zaman geri alabileceğimi biliyorum.</span>
  </label>
  <button>Beni arayın</button>
</form>
<script>
  document.getElementById("randevox-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    // Rızanın ispatı: işaretlenen metin aynen gönderilir.
    data.append("consent_text", document.getElementById("randevox-consent-text").textContent.trim());
    const res = await fetch("FORM_ADRESI", { method: "POST", body: data });
    e.target.innerHTML = res.ok ? "Teşekkürler, birazdan sizi arayacağız." : "Gönderilemedi, lütfen kliniği arayın.";
  });
</script>
```

KVKK notları (formu klinik kendi metniyle değiştirirse de geçerli):
- Aydınlatma metni **bağlantı** olarak durur, onay kutusuna bağlanmaz. Açık rıza kutusu ayrıdır.
- Kutu önceden işaretli gelmez.
- Kampanya/tanıtım mesajı onayı (İYS) bu kutuya eklenmez; gerekiyorsa ayrı ve **isteğe bağlı**
  bir kutu olur ve klinik onu İYS'ye kendisi işler. Randevox bu alanı kullanmaz.

Yanıtlar: `200 {ok:true}`; aynı numara 24 saat içinde tekrar gelirse `{ok:true, duplicate:true}` ve
ikinci arama yapılmaz. `400 consent` / `400 phone`; `404 unknown_form` (adres yenilenmiş ya da yanlış).

## 3. Meta reklam formu (klinik kendi otomasyonunu bağlar)

Meta'da Lead Ads formunda telefon alanı ve **Özel feragatname (custom disclaimer)** olmalı:
- Feragatname metnine aydınlatma metni bağlantısı konur (yukarıdaki web formundaki gibi).
- Feragatnameye bir **zorunlu onay kutusu** eklenir, metni web formundaki açık rıza metniyle aynı.

Klinik kendi tercih ettiği araçla (n8n, Zapier, Make, Facebook'un kendi entegrasyonu…) forma
bir akış kurar:
1. **Facebook Lead Ads Trigger** (sayfa ve form seçilir).
2. **HTTP Request** → `POST` form adresi, JSON gövde:
   ```json
   {
     "name": "{{ full_name }}",
     "phone": "{{ phone_number }}",
     "consent": "{{ custom_disclaimer_responses[0].is_checked }}",
     "consent_text": "<onay kutusunun metni, aynen>",
     "source": "meta"
   }
   ```
   Alan adları formdaki sorulara ve araca göre değişir. **`consent`'e sabit `true` yazılmaz**:
   değer Meta'dan gelen onay kutusu cevabından gelmeli, yoksa rıza ispatlanamaz. Cevap gelmezse
   başvuru `400 consent` ile reddedilir ve aranmaz.

## 4. Bekleyenler

Otomasyon uygulaması (`automation/app.py`, `lead_callbacks` işi) her 5 dakikada bir
`/api/automation/lead-callbacks`'i çağırır — kurulumu için `automation/README.md`.

## Test

- Yanlış adres: `curl -X POST "https://www.randevoxai.com/api/leads?key=yanlis"` → **404**.
- Açık rıza yok → **400 consent**.
- Gönderilen başvurunun `leads` tablosunda `consent_text` (ve web'den geldiyse `consent_ip`) ile
  kaydedildiğini kontrol et.
- Gerçek arama: form adresine kendi numaranla gönder; mesai içindeyse telefonun çalmalı, sonra
  arama /calls'ta görünmeli.
