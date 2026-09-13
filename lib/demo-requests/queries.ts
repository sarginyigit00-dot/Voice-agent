import { getSupabaseServer } from "@/lib/supabase/server";

export interface DemoRequestInput {
  clinicName: string;
  contactName: string;
  phone: string;
  email: string | null;
  note: string | null;
}

/**
 * Stores a /demo-talep submission in `demo_requests` (supabase/schema.sql).
 * Returns "demo" when Supabase isn't configured, so the form still reads as
 * sent on a keyless checkout.
 */
export async function addDemoRequest(input: DemoRequestInput): Promise<"ok" | "demo" | "error"> {
  const supabase = getSupabaseServer();
  if (!supabase) return "demo";

  const { error } = await supabase.from("demo_requests").insert({
    clinic_name: input.clinicName,
    contact_name: input.contactName,
    phone: input.phone,
    email: input.email,
    note: input.note,
  });
  if (error) {
    console.error("[demo-request] insert failed:", error.message);
    return "error";
  }
  return "ok";
}
