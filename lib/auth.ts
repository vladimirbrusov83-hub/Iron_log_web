/**
 * The gate. One passcode, no accounts — one person uses this app.
 *
 * The cookie does not contain the passcode. It contains an HMAC of a fixed
 * string keyed by it, so the cookie is useless anywhere else and changing
 * APP_PASSCODE signs out every browser that was open.
 *
 * Web Crypto only (no node:crypto), because middleware runs on the edge.
 */

export const AUTH_COOKIE = "ironlog_auth";
const STAMP = "ironlog-v1";

function passcode(): string {
  const p = process.env.APP_PASSCODE;
  if (!p) throw new Error("APP_PASSCODE is not set — see .env.example");
  return p;
}

async function tokenFor(secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(STAMP));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** The cookie value to set after a correct passcode. */
export function authToken(): Promise<string> {
  return tokenFor(passcode());
}

/** Constant-time compare, so a token can't be guessed a byte at a time. */
function sameToken(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function isAuthToken(value: string | undefined): Promise<boolean> {
  if (!value) return false;
  return sameToken(value, await authToken());
}

/* Both sides are hashed before comparing, so the compare is over two equal-length
   hex strings and the length of the real passcode never shows through. */
export async function checkPasscode(entered: string): Promise<boolean> {
  return sameToken(await tokenFor(entered), await tokenFor(passcode()));
}
