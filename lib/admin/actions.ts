import { getSupabaseServer } from "@/lib/supabase/server";
import { MIN_PASSWORD_LENGTH } from "@/lib/admin/constants";

/**
 * Account-level operator actions on Randevox's own customers (`auth.users`).
 *
 * PRIVACY BOUNDARY — read app/gizlilik/page.tsx before extending this file.
 * The policy puts us in two different roles at once:
 *   · For a clinic's ACCOUNT data (name, email, sign-up) we're the controller,
 *     so account administration here is squarely "providing the service" (§3),
 *     and delete is how we honour a customer's §6 erasure right.
 *   · For everything a clinic's CALLERS said — transcripts, recordings, caller
 *     name/phone/email, appointment detail — we're only a processor acting "on
 *     your instructions" (§2), and that content can be special-category health
 *     data. Reading it from an operator console is not one of those
 *     instructions.
 * So: this module touches accounts only. Do not add anything that reads
 * `calls`, `crm_records` or `appointments` rows into the admin panel.
 */

export type AdminAction = "ban" | "unban" | "confirm" | "setPassword" | "delete";

export interface ActionResult {
  ok: boolean;
  message: string;
}

const FOREVER = "876000h"; // ~100 years — Supabase has no "indefinite" ban.

export async function runAdminAction(
  action: AdminAction,
  userId: string,
  password?: string,
): Promise<ActionResult> {
  const supabase = getSupabaseServer();
  if (!supabase) return { ok: false, message: "Supabase bağlı değil." };

  switch (action) {
    case "ban":
    case "unban": {
      const { error } = await supabase.auth.admin.updateUserById(userId, {
        ban_duration: action === "ban" ? FOREVER : "none",
      });
      if (error) return { ok: false, message: error.message };
      return { ok: true, message: action === "ban" ? "Hesap askıya alındı." : "Hesap yeniden açıldı." };
    }

    case "confirm": {
      const { error } = await supabase.auth.admin.updateUserById(userId, { email_confirm: true });
      if (error) return { ok: false, message: error.message };
      return { ok: true, message: "E-posta doğrulandı." };
    }

    case "setPassword": {
      // The operator sets the password directly instead of mailing a reset
      // link — Supabase's outbound email is the one thing here we don't
      // control, and an account shouldn't be unrecoverable because an SMTP
      // provider is down. The new password is typed twice in the panel, never
      // stored by us, and goes to the customer out-of-band.
      if (!password || password.length < MIN_PASSWORD_LENGTH) {
        return { ok: false, message: `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.` };
      }
      const { error } = await supabase.auth.admin.updateUserById(userId, { password });
      if (error) return { ok: false, message: error.message };
      return { ok: true, message: "Şifre güncellendi." };
    }

    case "delete": {
      // Hard delete, not a soft flag: §6 promises real erasure on request.
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) return { ok: false, message: error.message };
      return { ok: true, message: "Hesap silindi." };
    }
  }
}
