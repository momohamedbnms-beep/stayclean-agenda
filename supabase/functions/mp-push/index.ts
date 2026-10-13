// Ma Paperasse — rappels sur le téléphone (Web Push : RFC 8291 aes128gcm + VAPID RFC 8292).
// Aucune dépendance externe : uniquement fetch et WebCrypto (Deno / Supabase Edge Runtime).
//
// Déploiement (une fois) :  supabase functions deploy mp-push --no-verify-jwt --project-ref rgfanwbyzsfjlhwwhudg
// (--no-verify-jwt : la fonction vérifie elle-même l'utilisateur, ou le secret du cron.)
//
// Actions (POST, JSON) :
//   { action: "vapid" }  utilisateur connecté → { publicKey }  (crée les clés VAPID au 1er appel
//                        et enregistre l'adresse de la fonction pour la tâche cron horaire)
//   { action: "test" }   utilisateur connecté → envoie une notification de test à ses appareils
//   { action: "cron" }   en-tête x-mp-secret  → envoie les rappels du jour (1 par jour et par compte max)

const SB_URL = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
/* Clés : nouvelles clés Supabase d'abord (sb_secret_… / sb_publishable_…), anciennes ensuite */
function keyFromEnv(name: string): string {
  const v = (Deno.env.get(name) ?? "").trim();
  if (!v) return "";
  if (v.startsWith("sb_")) return v;
  try { const m = JSON.parse(v); return String(m?.default ?? Object.values(m ?? {})[0] ?? ""); } catch { return ""; }
}
const SERVICE_KEY = Deno.env.get("MP_SERVICE_KEY") || keyFromEnv("SUPABASE_SECRET_KEYS") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || keyFromEnv("SUPABASE_PUBLISHABLE_KEYS") || "";
const CONTACT = Deno.env.get("MP_VAPID_SUBJECT") ?? "";
const TZ = "Europe/Brussels";
const LAST_HOUR = 21; // pas de rappel après 21 h

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-mp-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

/* ---------- Supabase (clé de service, côté serveur uniquement) ---------- */
function svcHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = { apikey: SERVICE_KEY, "Content-Type": "application/json", ...extra };
  if (!SERVICE_KEY.startsWith("sb_")) h.Authorization = `Bearer ${SERVICE_KEY}`;
  return h;
}
async function rest(path: string, init: RequestInit & { headers?: Record<string, string> } = {}) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { ...init, headers: svcHeaders(init.headers ?? {}) });
  const t = await r.text();
  if (!r.ok) throw new Error(`rest ${r.status}: ${t.slice(0, 300)}`);
  return t ? JSON.parse(t) : null;
}
async function getConfig(key: string): Promise<string | null> {
  const rows = await rest(`mp_config?key=eq.${encodeURIComponent(key)}&select=value`);
  return rows?.[0]?.value ?? null;
}
async function setConfig(key: string, value: string, overwrite: boolean) {
  await rest("mp_config?on_conflict=key", {
    method: "POST",
    headers: { Prefer: `resolution=${overwrite ? "merge" : "ignore"}-duplicates,return=minimal` },
    body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
  });
}
/* Utilisateur de l'appli (jeton Supabase Auth envoyé par l'agenda) */
async function userFrom(req: Request): Promise<{ id: string; email: string } | null> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const apikey = req.headers.get("apikey") || ANON_KEY;
  const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey } });
  if (!r.ok) return null;
  const u = await r.json();
  return u?.id ? { id: u.id, email: u.email ?? "" } : null;
}

/* ---------- Encodages ---------- */
const enc = new TextEncoder();
function b64u(buf: ArrayBuffer | Uint8Array): string {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = ""; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unb64u(s: string): Uint8Array {
  const p = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob(p), (c) => c.charCodeAt(0));
}
function concat(...arrs: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0));
  let o = 0; for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
}

/* ---------- VAPID (clés créées une fois, gardées dans mp_config) ---------- */
type Vapid = { key: CryptoKey; publicKey: string };
let vapidCache: Vapid | null = null;
async function vapidKeys(): Promise<Vapid> {
  if (vapidCache) return vapidCache;
  let jwk = await getConfig("vapid_private_jwk");
  if (!jwk) {
    const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]) as CryptoKeyPair;
    await setConfig("vapid_private_jwk", JSON.stringify(await crypto.subtle.exportKey("jwk", kp.privateKey)), false);
    jwk = await getConfig("vapid_private_jwk"); // en cas d'appels simultanés, une seule paire gagne
  }
  const priv = JSON.parse(jwk!);
  const key = await crypto.subtle.importKey("jwk", { kty: "EC", crv: "P-256", d: priv.d, x: priv.x, y: priv.y }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  vapidCache = { key, publicKey: b64u(concat(new Uint8Array([4]), unb64u(priv.x), unb64u(priv.y))) };
  return vapidCache;
}
function subject(): string {
  if (CONTACT) return /^(mailto:|https:\/\/)/.test(CONTACT) ? CONTACT : `mailto:${CONTACT}`;
  return SB_URL.startsWith("https://") ? SB_URL : "mailto:rappels@ma-paperasse.invalid";
}
async function vapidHeader(endpoint: string, v: Vapid): Promise<string> {
  const head = b64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject() })));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, v.key, enc.encode(`${head}.${body}`));
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${v.publicKey}`;
}

/* ---------- Chiffrement du message (aes128gcm) ---------- */
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, k, len * 8));
}
export async function encryptPayload(p256dh: string, auth: string, plaintext: Uint8Array): Promise<Uint8Array> {
  const uaPub = unb64u(p256dh), authSecret = unb64u(auth);
  const as = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as CryptoKeyPair;
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", as.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const secret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, as.privateKey, 256));
  const ikm = await hkdf(authSecret, secret, concat(enc.encode("WebPush: info\0"), uaPub, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, concat(plaintext, new Uint8Array([2]))));
  const rs = new Uint8Array(4); new DataView(rs.buffer).setUint32(0, 4096);
  return concat(salt, rs, new Uint8Array([asPub.length]), asPub, ct);
}
type Sub = { endpoint: string; p256dh: string; auth: string; fails?: number };
async function sendPush(s: Sub, payload: Record<string, unknown>, v: Vapid): Promise<number> {
  const body = await encryptPayload(s.p256dh, s.auth, enc.encode(JSON.stringify(payload)));
  const r = await fetch(s.endpoint, {
    method: "POST",
    headers: { Authorization: await vapidHeader(s.endpoint, v), "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", TTL: "43200", Urgency: "normal" },
    body,
  });
  await r.body?.cancel();
  return r.status;
}
/* Envoie à tous les appareils d'un compte et tient la liste à jour */
async function sendToUser(userId: string, payload: Record<string, unknown>, v: Vapid) {
  const subs: Sub[] = (await rest(`mp_push_subs?user_id=eq.${userId}&select=endpoint,p256dh,auth,fails`)) ?? [];
  let sent = 0, removed = 0;
  for (const s of subs) {
    let st = 0;
    try { st = await sendPush(s, payload, v); } catch { st = 0; }
    const where = `mp_push_subs?endpoint=eq.${encodeURIComponent(s.endpoint)}`;
    if (st >= 200 && st < 300) {
      sent++;
      await rest(where, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ last_ok_at: new Date().toISOString(), fails: 0 }) }).catch(() => {});
    } else if (st === 404 || st === 410 || (s.fails ?? 0) >= 4) {
      removed++;
      await rest(where, { method: "DELETE", headers: { Prefer: "return=minimal" } }).catch(() => {});
    } else {
      await rest(where, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ fails: (s.fails ?? 0) + 1 }) }).catch(() => {});
    }
  }
  return { devices: subs.length, sent, removed };
}

/* ---------- Rappels du jour ---------- */
export function brusselsNow(d = new Date()): { day: string; hour: number } {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit" }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  return { day: `${g("year")}-${g("month")}-${g("day")}`, hour: Number(g("hour")) };
}
export function isDue(plan: any, day: string, hour: number): boolean {
  if (!plan || typeof plan !== "object" || !plan.days || !plan.days[day]) return false;
  const h = Number.isInteger(plan.hour) && plan.hour >= 6 && plan.hour <= 20 ? plan.hour : 9;
  return hour >= h && hour < LAST_HOUR;
}
async function runCron() {
  const { day, hour } = brusselsNow();
  const plans: { user_id: string; data: any }[] = (await rest("mp_items?kind=eq.remind&id=eq.plan&deleted=is.false&select=user_id,data")) ?? [];
  const due = plans.filter((p) => isDue(p.data, day, hour));
  let sent = 0;
  if (due.length) {
    const v = await vapidKeys();
    for (const p of due) {
      const item = p.data.days[day] ?? {};
      /* au plus un rappel par jour et par compte, même si la tâche tourne deux fois */
      const ins = await rest("mp_push_log?on_conflict=user_id,day", {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
        body: JSON.stringify({ user_id: p.user_id, day, n: Number.isFinite(item.n) ? item.n : null }),
      });
      if (!Array.isArray(ins) || !ins.length) continue;
      const r = await sendToUser(p.user_id, {
        title: String(item.title ?? "Ma Paperasse").slice(0, 120),
        body: String(item.body ?? "Ouvre Ma Paperasse pour voir quoi faire.").slice(0, 240),
        tag: `ma-paperasse-${day}`,
        url: "paperasse.html",
      }, v);
      sent += r.sent;
      /* aucun appareil n'a reçu (panne passagère du service de notification) : on réessaiera à l'heure suivante */
      if (r.devices > 0 && r.sent === 0) {
        await rest(`mp_push_log?user_id=eq.${p.user_id}&day=eq.${day}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }).catch(() => {});
      }
    }
  }
  /* ménage : journal de plus de 90 jours */
  if (hour === 3) await rest(`mp_push_log?day=lt.${new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }).catch(() => {});
  return { day, hour, plans: plans.length, due: due.length, sent };
}

/* ---------- Point d'entrée ---------- */
if (typeof Deno !== "undefined" && typeof Deno.serve === "function" && !Deno.env.get("MP_PUSH_NO_SERVE")) Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, code: "method" }, 405);
  if (!SB_URL || !SERVICE_KEY) return json({ ok: false, code: "not_configured" }, 500);
  const body = await req.json().catch(() => ({}));
  const action = typeof body?.action === "string" ? body.action : "";
  try {
    if (action === "cron") {
      const secret = req.headers.get("x-mp-secret") ?? "";
      const want = await getConfig("cron_secret");
      if (!want || secret.length !== want.length || secret !== want) return json({ ok: false, code: "forbidden" }, 401);
      return json({ ok: true, ...(await runCron()) });
    }
    const user = await userFrom(req);
    if (!user) return json({ ok: false, code: "session_expired" }, 401);
    if (action === "vapid") {
      const v = await vapidKeys();
      await setConfig("push_url", `${SB_URL}/functions/v1/mp-push`, true).catch(() => {});
      return json({ ok: true, publicKey: v.publicKey });
    }
    if (action === "test") {
      const v = await vapidKeys();
      const r = await sendToUser(user.id, { title: "Ma Paperasse", body: "Notification de test : tes rappels marchent.", tag: "ma-paperasse-test", url: "paperasse.html" }, v);
      return json({ ok: true, ...r });
    }
    return json({ ok: false, code: "unknown_action" }, 400);
  } catch (e) {
    console.error("mp-push", e);
    const msg = String((e as Error)?.message ?? e);
    return json({ ok: false, code: /rest 404|PGRST205|42P01|does not exist/.test(msg) ? "not_installed" : "unavailable" }, 500);
  }
});
