"""
Randevox automation — everything that used to live in n8n (Faz 3), on Modal.

Randevox (Next.js) owns everything that happens while a caller is on the
line; this app owns what happens after: SMS/WhatsApp to the patient, email
to the clinic, appointment reminders, and the "Hızlı geri dönüş" poll.

Three jobs, one shared secret (AUTOMATION_SECRET):
  - `events`         — web endpoint. Randevox POSTs a signed event here
                        (lib/automation/emit.ts) on call.completed /
                        appointment.cancelled / appointment.rescheduled.
  - `reminders`       — every 15 min: pulls due 24h/2h reminders and sends them.
  - `lead_callbacks`  — every 5 min: pokes Randevox to phone waiting leads.

Deploy: see README.md in this folder.
"""

import base64
import hashlib
import hmac
import os

import modal
from fastapi import Request, Response

app = modal.App("randevox-automation")

image = modal.Image.debian_slim(python_version="3.12").pip_install("fastapi[standard]", "httpx")

secret = modal.Secret.from_name("randevox-automation")

HTTP_TIMEOUT = 10.0


# ── shared helpers ────────────────────────────────────────────────────────

def randevox_url(path: str) -> str:
    return os.environ["RANDEVOX_URL"].rstrip("/") + path


def randevox_headers() -> dict:
    return {"Authorization": f"Bearer {os.environ['AUTOMATION_SECRET']}"}


def resolve_channel(clinic: dict) -> str:
    """Same fallback Randevox itself uses: messageChannel, else the old whatsappEnabled flag."""
    return clinic.get("messageChannel") or ("whatsapp" if clinic.get("whatsappEnabled") else "off")


def send_netgsm_sms(msg: str, phone: str) -> bool:
    """Netgsm REST v2. `no` is the phone without the leading '+90'. True only if a jobid came back."""
    import httpx

    usercode = os.environ["NETGSM_USERCODE"]
    password = os.environ["NETGSM_PASSWORD"]
    auth = base64.b64encode(f"{usercode}:{password}".encode()).decode()
    body = {
        "msgheader": os.environ["NETGSM_HEADER"],
        "encoding": "TR",
        "iysfilter": "0",
        "messages": [{"msg": msg, "no": phone[3:]}],
    }
    try:
        res = httpx.post(
            "https://api.netgsm.com.tr/sms/rest/v2/send",
            headers={"Authorization": f"Basic {auth}"},
            json=body,
            timeout=HTTP_TIMEOUT,
        )
        return bool(res.json().get("jobid"))
    except Exception as e:
        print(f"[netgsm] send failed: {e}")
        return False


def send_whatsapp_template(template: str, params: list[str], phone: str) -> bool:
    """Meta Graph API, Turkish (tr) template, body params in order."""
    import httpx

    phone_number_id = os.environ["WHATSAPP_PHONE_NUMBER_ID"]
    body = {
        "messaging_product": "whatsapp",
        "to": phone.lstrip("+"),
        "type": "template",
        "template": {
            "name": template,
            "language": {"code": "tr"},
            "components": [{"type": "body", "parameters": [{"type": "text", "text": str(p)} for p in params]}],
        },
    }
    try:
        res = httpx.post(
            f"https://graph.facebook.com/v21.0/{phone_number_id}/messages",
            headers={"Authorization": f"Bearer {os.environ['WHATSAPP_TOKEN']}"},
            json=body,
            timeout=HTTP_TIMEOUT,
        )
        if res.status_code >= 400:
            print(f"[whatsapp] {template} failed: HTTP {res.status_code} {res.text}")
        return res.status_code < 400
    except Exception as e:
        print(f"[whatsapp] {template} failed: {e}")
        return False


def send_whatsapp_text(phone: str, text: str) -> bool:
    """Free-form WhatsApp text — only allowed inside the 24 h window a patient's own message opens."""
    import httpx

    phone_number_id = os.environ["WHATSAPP_PHONE_NUMBER_ID"]
    body = {"messaging_product": "whatsapp", "to": phone.lstrip("+"), "type": "text", "text": {"body": text}}
    try:
        res = httpx.post(
            f"https://graph.facebook.com/v21.0/{phone_number_id}/messages",
            headers={"Authorization": f"Bearer {os.environ['WHATSAPP_TOKEN']}"},
            json=body,
            timeout=HTTP_TIMEOUT,
        )
        if res.status_code >= 400:
            print(f"[whatsapp] text failed: HTTP {res.status_code} {res.text}")
        return res.status_code < 400
    except Exception as e:
        print(f"[whatsapp] text failed: {e}")
        return False


def send_patient_message(channel: str, phone: str | None, sms_text: str, wa_template: str, wa_params: list[str]) -> bool:
    """SMS only ever goes to Turkish mobiles (+905…) — mirrors the due-reminders query and the events flow."""
    if not phone or channel not in ("sms", "whatsapp"):
        return False
    if channel == "sms":
        if not phone.startswith("+905"):
            return False
        return send_netgsm_sms(sms_text, phone)
    return send_whatsapp_template(wa_template, wa_params, phone)


def send_clinic_email(to: str, subject: str, html: str) -> None:
    import httpx

    try:
        httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {os.environ['RESEND_API_KEY']}"},
            json={"from": os.environ["RESEND_FROM"], "to": [to], "subject": subject, "html": html},
            timeout=HTTP_TIMEOUT,
        )
    except Exception as e:
        print(f"[resend] email failed: {e}")


# ── job: appointment reminders (24h / 2h) ────────────────────────────────

def reminder_texts(kind: str, name: str, clinic_name: str, date: str, time: str) -> tuple[str, list[str]]:
    name = name or "Değerli hastamız"
    if kind == "2h":
        sms = f"Merhaba {name}, {clinic_name} randevunuza az kaldı: bugün saat {time}. Sizi bekliyoruz."
        return sms, [name, clinic_name, time]
    sms = f"Merhaba {name}, {clinic_name} randevunuzu hatırlatırız: {date}, saat {time}. Gelemeyecekseniz lütfen kliniği arayın."
    return sms, [name, clinic_name, date, time]


@app.function(image=image, secrets=[secret], schedule=modal.Period(minutes=15), timeout=300)
def reminders():
    import httpx

    for kind in ("24h", "2h"):
        res = httpx.get(randevox_url(f"/api/automation/due-reminders?kind={kind}"), headers=randevox_headers(), timeout=HTTP_TIMEOUT)
        res.raise_for_status()
        due = res.json().get("reminders", [])
        for r in due:
            template = "randevu_hatirlatma_2s" if kind == "2h" else "randevu_hatirlatma_24s"
            sms_text, wa_params = reminder_texts(kind, r.get("attendeeName"), r["clinic"]["name"], r.get("date", ""), r.get("time", ""))
            sent = send_patient_message(r["channel"], r.get("phone"), sms_text, template, wa_params)
            if not sent:
                continue  # left due — retried on the next 15-minute pass
            httpx.post(
                randevox_url("/api/automation/reminders/sent"),
                headers=randevox_headers(),
                json={"id": r["id"], "kind": kind},
                timeout=HTTP_TIMEOUT,
            )


# ── job: Hızlı geri dönüş (waiting lead callbacks) ───────────────────────

@app.function(image=image, secrets=[secret], schedule=modal.Period(minutes=5), timeout=120)
def lead_callbacks():
    import httpx

    res = httpx.post(randevox_url("/api/automation/lead-callbacks"), headers=randevox_headers(), timeout=HTTP_TIMEOUT)
    res.raise_for_status()
    print(f"[lead-callbacks] {res.json()}")


# ── job: signed events from Randevox (booking confirm / cancel / reschedule) ─

def verify_signature(raw_body: bytes, signature: str) -> bool:
    expected = hmac.new(os.environ["AUTOMATION_SECRET"].encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature or "")


@app.function(image=image, secrets=[secret])
@modal.fastapi_endpoint(method="POST")
async def events(request: Request):
    from datetime import datetime, timezone

    raw = await request.body()
    if not verify_signature(raw, request.headers.get("x-randevox-signature", "")):
        return Response(status_code=401, content='{"error":"bad signature"}', media_type="application/json")

    import json

    payload = json.loads(raw)
    event_type = payload.get("type")
    clinic = payload.get("clinic") or {}
    data = payload.get("data") or {}
    channel = resolve_channel(clinic)

    if event_type == "call.completed":
        appointment = data.get("appointment")
        if appointment:
            if data.get("confirm"):
                name = appointment.get("attendeeName")
                sms_text = (
                    f"Merhaba {name or 'Değerli hastamız'}, {clinic.get('name')} randevunuz oluşturuldu: "
                    f"{appointment.get('date')}, saat {appointment.get('time')}. Değişiklik için kliniği arayabilirsiniz."
                )
                wa_params = [name or "Değerli hastamız", clinic.get("name"), appointment.get("date"), appointment.get("time")]
                send_patient_message(channel, data.get("phone"), sms_text, "randevu_onay", wa_params)
        elif clinic.get("notifyEmail"):
            send_clinic_email(
                clinic["notifyEmail"],
                f"Randevu alınamayan arama: {data.get('number') or 'numara yok'}",
                f"<p><b>{clinic.get('name')}</b> hattına gelen bir arama randevuyla sonuçlanmadı. Geri aramak isteyebilirsiniz.</p>"
                f"<p>Arayan: {data.get('caller') or '-'}<br>Numara: {data.get('number') or '-'}<br>"
                f"Ajan: {data.get('agentName')}<br>Sonuç: {data.get('outcome')} · Duygu: {data.get('sentiment')}</p>"
                f"<p>{data.get('summary') or ''}</p>",
            )

    elif event_type == "appointment.booked":
        # Booked by hand from the panel — same confirmation the phone line sends after a call.
        starts_at = data.get("startsAt")
        in_future = bool(starts_at) and datetime.fromisoformat(starts_at.replace("Z", "+00:00")) > datetime.now(timezone.utc)
        if data.get("phone") and in_future:
            name = data.get("attendeeName") or "Değerli hastamız"
            date, time = data.get("date"), data.get("time")
            sms_text = (
                f"Merhaba {name}, {clinic.get('name')} randevunuz oluşturuldu: "
                f"{date}, saat {time}. Değişiklik için kliniği arayabilirsiniz."
            )
            send_patient_message(channel, data.get("phone"), sms_text, "randevu_onay", [name, clinic.get("name"), date, time])

    elif event_type in ("appointment.cancelled", "appointment.rescheduled"):
        starts_at = data.get("startsAt")
        in_future = bool(starts_at) and datetime.fromisoformat(starts_at.replace("Z", "+00:00")) > datetime.now(timezone.utc)
        if data.get("phone") and in_future:
            name = data.get("attendeeName") or "Değerli hastamız"
            date, time = data.get("date"), data.get("time")
            if event_type == "appointment.cancelled":
                sms_text = f"Merhaba {name}, {clinic.get('name')} için {date} saat {time} randevunuz iptal edildi. Yeni randevu için kliniği arayabilirsiniz."
                template = "randevu_iptal"
            else:
                sms_text = f"Merhaba {name}, {clinic.get('name')} randevunuzun saati değişti. Yeni randevunuz: {date}, saat {time}. Uygun değilse lütfen kliniği arayın."
                template = "randevu_degisiklik"
            send_patient_message(channel, data.get("phone"), sms_text, template, [name, clinic.get("name"), date, time])

    return Response(status_code=200, content='{"ok":true}', media_type="application/json")


# ── job: a patient's WhatsApp reply to a reminder ("iptal") ──────────────

@app.function(image=image, secrets=[secret, modal.Secret.from_name("randevox-whatsapp-inbound")])
@modal.asgi_app()
def whatsapp_webhook():
    """
    Meta's WhatsApp webhook. One URL, two verbs: GET is Meta's one-off "is this
    really yours" handshake, POST carries the patient's messages. Each text is
    handed to Randevox (/api/automation/inbound-reply), which decides whether it
    is a cancel request and answers with the text to send back (or nothing).
    """
    import json

    import httpx
    from fastapi import FastAPI

    web = FastAPI()

    @web.get("/")
    async def verify(request: Request):
        q = request.query_params
        expected = os.environ.get("WHATSAPP_VERIFY_TOKEN", "")
        if expected and q.get("hub.mode") == "subscribe" and hmac.compare_digest(q.get("hub.verify_token", ""), expected):
            return Response(content=q.get("hub.challenge", ""), media_type="text/plain")
        return Response(status_code=403)

    @web.post("/")
    async def receive(request: Request):
        raw = await request.body()
        app_secret = os.environ.get("WHATSAPP_APP_SECRET", "")
        if not app_secret:
            return Response(status_code=403)
        expected = "sha256=" + hmac.new(app_secret.encode(), raw, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, request.headers.get("x-hub-signature-256", "")):
            return Response(status_code=401)

        payload = json.loads(raw)
        for entry in payload.get("entry", []):
            for change in entry.get("changes", []):
                for msg in (change.get("value") or {}).get("messages", []):
                    if msg.get("type") != "text":
                        continue
                    phone = "+" + str(msg.get("from", "")).lstrip("+")
                    try:
                        res = httpx.post(
                            randevox_url("/api/automation/inbound-reply"),
                            headers=randevox_headers(),
                            json={"phone": phone, "text": (msg.get("text") or {}).get("body", "")},
                            timeout=HTTP_TIMEOUT,
                        )
                        reply = res.json().get("reply") if res.status_code == 200 else None
                    except Exception as e:
                        print(f"[whatsapp-inbound] randevox call failed: {e}")
                        reply = None
                    if reply:
                        send_whatsapp_text(phone, reply)

        # Always 200: a non-2xx makes Meta retry the same message for days.
        return Response(status_code=200, content='{"ok":true}', media_type="application/json")

    return web
