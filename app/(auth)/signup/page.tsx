import { redirect } from "next/navigation";

/**
 * Randevox is sold turnkey: the operator creates each clinic and its staff
 * accounts from /admin, so there is no self-serve sign-up. Anyone who lands
 * here — an old link, a bookmark — goes to the demo-request form instead.
 */
export default function SignupPage() {
  redirect("/demo-talep");
}
