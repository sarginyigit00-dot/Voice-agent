# Hızlı geri dönüş — kurulum

Hasta kliniğin formunu doldurur, kliniğin seçtiği ajan onu hemen arar. Mesai dışında gelen
başvuru klinik açılınca aranır. Başarısız arama en fazla 3 kez denenir; 3 günden eski başvuru
aranmaz. Aramalar /calls'ta diğer aramalar gibi görünür.

```
Klinik sitesi formu ─┐
                     ├─► POST /api/leads?key=… ─► ajan arar (Vapi)
Meta reklam formu ─► n8n ┘
n8n (5 dk) ─► /api/automation/lead-callbacks ─► bekleyenleri arar
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
| `name` | hayır | Ajan hitap ederken kullanır |
| `note` | hayır | Ajana iletilir (ör. "saç ekimi fiyatı") |
| `source` | hayır | `web` (varsayılan), `meta` |
| `website` | — | Gizli bırakılacak bot tuzağı; doluysa başvuru yok sayılır |

Hazır form (adresi admin'deki ile değiştir):

```html
<form id="randevox-form">
  <input name="name" placeholder="Adınız" />
  <input name="phone" placeholder="Telefon" required />
  <input name="note" placeholder="Hangi konuda?" />
  <input name="website" style="display:none" tabindex="-1" autocomplete="off" />
  <label>
    <input type="checkbox" name="consent" required />
    Kliniğin beni telefonla aramasına ve bilgilerimin bu amaçla işlenmesine açık rıza veriyorum.
  </label>
  <button>Beni arayın</button>
</form>
<script>
  document.getElementById("randevox-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const res = await fetch("FORM_ADRESI", { method: "POST", body: new FormData(e.target) });
    e.target.innerHTML = res.ok ? "Teşekkürler, birazdan sizi arayacağız." : "Gönderilemedi, lütfen kliniği arayın.";
  });
</script>
```

Yanıtlar: `200 {ok:true}`; aynı numara 24 saat içinde tekrar gelirse `{ok:true, duplicate:true}` ve
ikinci arama yapılmaz. `400 consent` / `400 phone`; `404 unknown_form` (adres yenilenmiş ya da yanlış).

## 3. Meta reklam formu (n8n)

Meta'da Lead Ads formunda telefon alanı ve açık rıza sorusu (custom disclaimer) olmalı.
n8n'de kliniğe bir akış:
1. **Facebook Lead Ads Trigger** (sayfa ve form seçilir).
2. **HTTP Request** → `POST` form adresi, JSON gövde:
   `{ "name": "{{ $json.full_name }}", "phone": "{{ $json.phone_number }}", "consent": true, "source": "meta" }`
   (alan adları formdaki sorulara göre değişir).

## 4. Bekleyenler (n8n)

`randevox-lead-callbacks.json` bir kez içeri alınır ve aktif edilir; tüm klinikler için tek akış.
`RANDEVOX_URL` ve `AUTOMATION_SECRET` değişkenleri zaten n8n'de var.

## Test

- Yanlış adres: `curl -X POST "https://www.randevoxai.com/api/leads?key=yanlis"` → **404**.
- Açık rıza yok → **400 consent**.
- Gerçek arama: form adresine kendi numaranla gönder; mesai içindeyse telefonun çalmalı, sonra
  arama /calls'ta görünmeli.
