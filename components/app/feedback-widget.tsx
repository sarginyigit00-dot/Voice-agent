"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { useLang } from "@/components/i18n/language-provider";
import { useSession } from "@/components/auth/session";
import { authedFetch } from "@/lib/supabase/authed-fetch";
import { cn } from "@/lib/utils";

type Category = "fikir" | "hata" | "soru" | "diger";

const CATEGORIES: { id: Category; icon: string; label: { tr: string; en: string } }[] = [
  { id: "fikir", icon: "lightbulb", label: { tr: "Fikir / Öneri", en: "Idea" } },
  { id: "hata", icon: "bug", label: { tr: "Hata / Bug", en: "Bug" } },
  { id: "soru", icon: "circle-help", label: { tr: "Soru", en: "Question" } },
  { id: "diger", icon: "message-circle", label: { tr: "Diğer", en: "Other" } },
];

const MAX_FILE = 4 * 1024 * 1024;
const MAX_MESSAGE = 2000;

/**
 * Floating "Geliştiriciye mesaj gönder" button + panel, bottom-right of the
 * clinic cockpit. Mounted in app/(app)/layout.tsx only — never on /admin,
 * the landing page or the demo sign-in screens.
 */
export function FeedbackWidget() {
  const { t } = useLang();
  const { demo } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category>("fikir");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current && !panelRef.current.contains(target) && !(target as Element).closest?.("[data-feedback-fab]")) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  function pickFile(f: File | null) {
    if (f && f.size > MAX_FILE) {
      setNotice({ ok: false, text: t({ tr: "Dosya 4 MB'tan büyük olamaz.", en: "File must be under 4 MB." }) });
      return;
    }
    setNotice(null);
    setFile(f);
  }

  async function send() {
    if (!message.trim() || sending) return;
    if (demo) {
      setNotice({
        ok: false,
        text: t({ tr: "Demo modunda mesaj gönderilemez.", en: "Messages can't be sent in demo mode." }),
      });
      return;
    }
    setSending(true);
    setNotice(null);
    try {
      const form = new FormData();
      form.set("category", category);
      form.set("message", message.trim());
      form.set("path", pathname ?? "");
      if (file) form.set("file", file);
      const res = await authedFetch("/api/feedback", { method: "POST", body: form });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      if (res.ok && body.ok) {
        setNotice({
          ok: true,
          text: t({ tr: "Mesajınız iletildi, teşekkürler!", en: "Message sent, thank you!" }),
        });
        setMessage("");
        setFile(null);
        if (fileRef.current) fileRef.current.value = "";
      } else {
        setNotice({
          ok: false,
          text: body.message ?? t({ tr: "Gönderilemedi, tekrar deneyin.", en: "Couldn't send, please try again." }),
        });
      }
    } catch {
      setNotice({ ok: false, text: t({ tr: "Bağlantı hatası.", en: "Connection error." }) });
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={t({ tr: "Geliştiriciye mesaj gönder", en: "Message the developer" })}
          className="animate-float-up fixed bottom-28 right-4 z-40 w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-border bg-popover p-4 shadow-pop"
        >
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-base font-semibold text-foreground">
              {t({ tr: "Geliştiriciye mesaj gönder", en: "Message the developer" })}
            </h2>
            <button
              onClick={() => setOpen(false)}
              aria-label={t({ tr: "Kapat", en: "Close" })}
              className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
            >
              <Icon name="x" className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {t({
              tr: "Soru sor, fikrini paylaş ya da bir hatayı bildir. Doğrudan geliştiriciye gider — ekran görüntüsü veya dosya ekleyebilirsin.",
              en: "Ask a question, share an idea or report a bug. It goes straight to the developer — you can attach a screenshot or file.",
            })}
          </p>

          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {CATEGORIES.map((c) => {
              const active = category === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  aria-pressed={active}
                  className={cn(
                    "flex cursor-pointer flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[11px] font-medium transition-colors",
                    active
                      ? "border-violet bg-violet-soft text-violet"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon name={c.icon} className="h-4 w-4" />
                  {t(c.label)}
                </button>
              );
            })}
          </div>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
            rows={5}
            placeholder={t({ tr: "Mesajını yaz…", en: "Write your message…" })}
            className="mt-3 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:outline-none"
          />

          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf,text/plain"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="inline-flex min-w-0 cursor-pointer items-center gap-1.5 transition-colors hover:text-foreground"
            >
              <Icon name="paperclip" className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {file ? file.name : t({ tr: "Dosya ekle (ekran görüntüsü vb.)", en: "Attach a file (screenshot etc.)" })}
              </span>
            </button>
            {file && (
              <button
                onClick={() => {
                  setFile(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
                aria-label={t({ tr: "Dosyayı kaldır", en: "Remove file" })}
                className="cursor-pointer hover:text-foreground"
              >
                <Icon name="x" className="h-3.5 w-3.5" />
              </button>
            )}
            <span className="ml-auto font-mono tabular-nums">
              {message.length}/{MAX_MESSAGE}
            </span>
          </div>

          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/80">
            {t({
              tr: "Lütfen mesaja veya ekran görüntüsüne hasta bilgisi eklemeyin.",
              en: "Please don't include patient information in the message or screenshot.",
            })}
          </p>

          {notice && (
            <p
              className={cn(
                "mt-2 rounded-md px-3 py-2 text-xs",
                notice.ok ? "bg-booked/10 text-booked" : "bg-missed/10 text-missed",
              )}
            >
              {notice.text}
            </p>
          )}

          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => setOpen(false)}
              className="cursor-pointer rounded-md border border-border px-3.5 py-2 text-[12.5px] font-medium text-foreground transition-colors hover:bg-muted"
            >
              {t({ tr: "İptal", en: "Cancel" })}
            </button>
            <button
              onClick={send}
              disabled={!message.trim() || sending}
              className="cursor-pointer rounded-md bg-violet px-4 py-2 text-[12.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? t({ tr: "Gönderiliyor…", en: "Sending…" }) : t({ tr: "Gönder", en: "Send" })}
            </button>
          </div>
        </div>
      )}

      <button
        data-feedback-fab
        onClick={() => setOpen((o) => !o)}
        aria-label={t({ tr: "Geliştiriciye mesaj gönder", en: "Message the developer" })}
        aria-expanded={open}
        className="fixed bottom-12 right-4 z-40 flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-violet text-white shadow-pop transition-transform hover:scale-105 active:scale-95"
      >
        <Icon name={open ? "x" : "message-square-plus"} className="h-5 w-5" />
      </button>
    </>
  );
}
