// Sends iPhone push notifications through Apple (APNs) with a token-based key.
// Needs the function secrets APNS_KEY (text of the AuthKey_XXXX.p8 file) and
// APNS_KEY_ID; APNS_TEAM_ID and APNS_TOPIC default to the SIDLNE app.

const TEAM_ID = Deno.env.get("APNS_TEAM_ID") || "V3LQXRMUDZ";
const TOPIC = Deno.env.get("APNS_TOPIC") || "com.gmail.sidlne";
const KEY_ID = (Deno.env.get("APNS_KEY_ID") || "").trim();
const KEY_TEXT = Deno.env.get("APNS_KEY") || "";

export const apnsConfigured = () => !!KEY_ID && KEY_TEXT.replace(/-----[^-]+-----|\s/g, "").length > 100;

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const enc = new TextEncoder();

let cached: { jwt: string; at: number } | null = null;
let signingKey: CryptoKey | null = null;

async function jwt(): Promise<string> {
  // Apple accepts a token for an hour and rejects refreshing it too often
  if (cached && Date.now() - cached.at < 40 * 60_000) return cached.jwt;
  if (!signingKey) {
    const body = KEY_TEXT.replace(/-----[^-]+-----|\s/g, "");
    const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
    signingKey = await crypto.subtle.importKey("pkcs8", der, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  }
  const head = b64url(enc.encode(JSON.stringify({ alg: "ES256", kid: KEY_ID })));
  const claims = b64url(enc.encode(JSON.stringify({ iss: TEAM_ID, iat: Math.floor(Date.now() / 1000) })));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, signingKey, enc.encode(`${head}.${claims}`)));
  cached = { jwt: `${head}.${claims}.${b64url(sig)}`, at: Date.now() };
  return cached.jwt;
}

export type Push = { title: string; body: string; threadId?: string; data?: Record<string, unknown> };

// "ok", "gone" (the token is no longer valid: forget it) or "error"
export async function sendPush(token: string, push: Push): Promise<"ok" | "gone" | "error"> {
  const payload = JSON.stringify({
    aps: { alert: { title: push.title, body: push.body }, sound: "default", "thread-id": push.threadId },
    ...push.data,
  });
  const send = async (host: string) => {
    const res = await fetch(`https://${host}/3/device/${token}`, {
      method: "POST",
      headers: {
        authorization: `bearer ${await jwt()}`,
        "apns-topic": TOPIC,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "content-type": "application/json",
      },
      body: payload,
    });
    const reason = res.ok ? "" : ((await res.json().catch(() => ({}))) as { reason?: string }).reason || `HTTP ${res.status}`;
    return { status: res.status, reason };
  };
  try {
    let r = await send("api.push.apple.com");
    // Builds run straight from Xcode use Apple's sandbox
    if (r.reason === "BadDeviceToken") r = await send("api.sandbox.push.apple.com");
    if (r.status === 200) return "ok";
    console.warn(`APNs rejected a notification: ${r.reason}`);
    if (r.status === 410 || ["BadDeviceToken", "Unregistered", "DeviceTokenNotForTopic"].includes(r.reason)) return "gone";
    return "error";
  } catch (err) {
    console.error("APNs request failed", err);
    return "error";
  }
}
