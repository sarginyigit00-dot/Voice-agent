"use client";

/**
 * Thin wrapper around Google Identity Services (the `accounts.google.com/gsi`
 * script). Used instead of Supabase's redirect flow so the visitor never
 * leaves randevoxai.com — Google's own sheet then shows OUR origin rather than
 * the project's `*.supabase.co` auth host, and it costs nothing (a custom
 * Supabase auth domain is a paid add-on).
 *
 * GIS hands back a signed ID token, which `supabase.auth.signInWithIdToken()`
 * trades for a session. The client secret is never involved — this flow is
 * public by design, which is why the client id is a NEXT_PUBLIC_ var.
 */

/** The OAuth client id from Google Cloud. Absent → the caller falls back to redirect. */
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

const GIS_SRC = "https://accounts.google.com/gsi/client";

export interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleIdApi {
  initialize(opts: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    nonce?: string;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    use_fedcm_for_prompt?: boolean;
  }): void;
  renderButton(
    parent: HTMLElement,
    opts: {
      type?: "standard" | "icon";
      theme?: "outline" | "filled_blue" | "filled_black";
      size?: "large" | "medium" | "small";
      text?: "signin_with" | "signup_with" | "continue_with" | "signin";
      shape?: "rectangular" | "pill" | "circle" | "square";
      logo_alignment?: "left" | "center";
      width?: number;
      locale?: string;
    },
  ): void;
  disableAutoSelect(): void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdApi } };
  }
}

/**
 * Injects the GIS script once and resolves with its API.
 *
 * It polls rather than relying on the script's load event, because a second
 * mount (React strict mode, or navigating login → signup) finds the tag
 * already in the document and would otherwise wait for an event that fired
 * long ago.
 */
export function loadGoogleIdentity(timeoutMs = 8000): Promise<GoogleIdApi> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));

  if (!document.querySelector(`script[src="${GIS_SRC}"]`)) {
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }

  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      const api = window.google?.accounts?.id;
      if (api) return resolve(api);
      if (Date.now() - started > timeoutMs) {
        return reject(new Error("Google Identity Services could not be loaded"));
      }
      setTimeout(tick, 60);
    };
    tick();
  });
}

type CredentialHandler = (response: GoogleCredentialResponse, rawNonce: string) => void;

let handler: CredentialHandler | null = null;
let ready: Promise<GoogleIdApi> | null = null;

/**
 * Loads GIS and runs `initialize` exactly ONCE per page load, whatever how many
 * times a button mounts (strict mode, login ↔ signup, a language toggle).
 * Calling it repeatedly is what makes GIS log "initialize() is called multiple
 * times", and it would also mint a second nonce that the first callback can no
 * longer match.
 *
 * The credential handler is kept in a module-level slot and swapped on every
 * call, so the callback registered with Google always reaches the button that
 * is currently on screen — including its up-to-date remember-me choice.
 */
export function initGoogleIdentity(
  clientId: string,
  onCredential: CredentialHandler,
): Promise<GoogleIdApi> {
  handler = onCredential;
  if (ready) return ready;

  ready = (async () => {
    const [api, nonce] = await Promise.all([loadGoogleIdentity(), createNonce()]);
    api.initialize({
      client_id: clientId,
      callback: (response) => handler?.(response, nonce.raw),
      nonce: nonce.hashed,
      auto_select: false,
      cancel_on_tap_outside: true,
      use_fedcm_for_prompt: true,
    });
    return api;
  })();
  // A failed load (blocked script, offline) must not poison later attempts.
  ready.catch(() => {
    ready = null;
  });
  return ready;
}

/**
 * A single-use nonce, in the two shapes the handshake needs: Google signs the
 * SHA-256 hash into the token, Supabase re-hashes the raw value and compares.
 * Without it a token lifted from another site could be replayed here.
 */
export async function createNonce(): Promise<{ raw: string; hashed: string }> {
  const raw = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return { raw, hashed };
}
