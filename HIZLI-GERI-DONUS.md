# Geri arama formu — kurulum

Hasta kliniğin formunu doldurur, başvuru **kliniğin bildirim e-postasına** düşer ve klinik hastayı
**kendisi arar**. Ajan kimseyi aramaz (01.11.2026'dan beri; yapay zekânın dışarıyı araması KVKK
açısından riskli görüldüğü için kapatıldı). Aynı numara 24 saat içinde tekrar gelirse ikinci
e-posta gitmez.

```
Klinik sitesi formu ──► POST /api/leads?key=… ──► leads tablosu + kliniğe e-posta ──► klinik arar
```

## 1. Admin

admin → Klinikler → Yönet:
1. **İletişim → Bildirim e-postası** dolu olmalı. Boşsa başvurular sadece admin'de görünür.
2. **Geri arama formu → Formu aç**. Form adresi burada çıkar. **Formu kapat** adresi geçersiz kılar.

## 2. Kliniğin web sitesi

Form adresine `POST` edilir. JSON ya da düz HTML form olur.

| Alan | Zorunlu | Not |
|---|---|---|
| `phone` | evet | `0532…`, `+90532…` |
| `consent` | evet | `true` / `on`. **Açık rıza kutusu işaretlenmeden gönderilmemeli.** |
| `consent_text` | önerilir | İşaretlenen kutunun metni, aynen. Rızanın ispatı olarak lead'le birlikte saklanır. |
| `name` | hayır | E-postada görünür |
| `note` | hayır | E-postada görünür (ör. "implant fiyatı") |
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
    <span id="randevox-consent-text">Paylaştığım sağlık bilgileri dahil kişisel verilerimin, [Klinik Adı] tarafından telefonla aranarak talebime dönüş yapılması amacıyla işlenmesine Aydınlatma Metni kapsamında açık rıza veriyorum. Rızamı dilediğim zaman geri alabileceğimi biliyorum.</span>
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
    e.target.innerHTML = res.ok ? "Teşekkürler, en kısa sürede sizi arayacağız." : "Gönderilemedi, lütfen kliniği arayın.";
  });
</script>
```

KVKK notları (formu klinik kendi metniyle değiştirirse de geçerli):
- Aydınlatma metni **bağlantı** olarak durur, onay kutusuna bağlanmaz. Açık rıza kutusu ayrıdır.
- Kutu önceden işaretli gelmez.
- Kampanya/tanıtım mesajı onayı (İYS) bu kutuya eklenmez; gerekiyorsa ayrı ve **isteğe bağlı**
  bir kutu olur ve klinik onu İYS'ye kendisi işler. Randevox bu alanı kullanmaz.

Yanıtlar: `200 {ok:true}`; aynı numara 24 saat içinde tekrar gelirse `{ok:true, duplicate:true}` ve
ikinci e-posta gitmez. `400 consent` / `400 phone`; `404 unknown_form` (adres yenilenmiş, form
kapalı ya da yanlış).

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
   başvuru `400 consent` ile reddedilir.

## Test

- Yanlış adres: `curl -X POST "https://www.randevoxai.com/api/leads?key=yanlis"` → **404**.
- Açık rıza yok → **400 consent**.
- Gönderilen başvurunun `leads` tablosunda `consent_text` (ve web'den geldiyse `consent_ip`) ile
  kaydedildiğini, `error` sütununda "Kliniğe e-postayla bildirildi" yazdığını kontrol et.
- Kliniğin bildirim e-postasına "Geri arama talebi: …" konulu mail gelmeli. Hiçbir telefon çalmamalı.
