// Shared helpers for the Aerostasis API (Cloudflare Pages Functions + D1).
export const SESSION_COOKIE = 'aero_sid';
export const SESSION_DAYS = 60;

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

export const bad = (msg, status = 400) => json({ error: msg }, status);

export function getCookie(request, name) {
  const raw = request.headers.get('cookie') || '';
  for (const part of raw.split(/;\s*/)) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1));
  }
  return null;
}

// Reject cross-site writes. Browsers always send Origin on POST/PUT/DELETE.
export function sameOrigin(request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}

export async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomToken() {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export function sessionCookie(token, maxAgeSeconds) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export async function createSession(env, userId) {
  const token = randomToken();
  const expires = Date.now() + SESSION_DAYS * 864e5;
  await env.DB.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?1, ?2, ?3)')
    .bind(await sha256(token), userId, expires).run();
  return sessionCookie(token, SESSION_DAYS * 86400);
}

export async function currentUser(env, request) {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const row = await env.DB.prepare(
    'SELECT u.id, u.display_name, u.picture FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?1 AND s.expires_at > ?2'
  ).bind(await sha256(token), Date.now()).first();
  return row || null;
}

export const publicUser = (u) => u && { id: u.id, name: u.display_name, picture: u.picture || null };

export async function readJson(request, maxBytes = 300000) {
  const text = await request.text();
  if (text.length > maxBytes) throw new Error('too large');
  return JSON.parse(text || '{}');
}

// ---- Google ID token verification (RS256 against Google's published keys) ----
let jwks = null, jwksAt = 0;
async function googleKeys() {
  if (jwks && Date.now() - jwksAt < 3600e3) return jwks;
  const r = await fetch('https://www.googleapis.com/oauth2/v3/certs');
  if (!r.ok) throw new Error('could not fetch Google keys');
  jwks = (await r.json()).keys;
  jwksAt = Date.now();
  return jwks;
}
function b64url(s) {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad), (c) => c.charCodeAt(0));
}
export async function verifyGoogleToken(token, clientId) {
  const [h, p, s] = String(token).split('.');
  if (!h || !p || !s) throw new Error('malformed token');
  const header = JSON.parse(new TextDecoder().decode(b64url(h)));
  const payload = JSON.parse(new TextDecoder().decode(b64url(p)));
  if (header.alg !== 'RS256') throw new Error('unexpected algorithm');
  const jwk = (await googleKeys()).find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('unknown key');
  const key = await crypto.subtle.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64url(s), new TextEncoder().encode(`${h}.${p}`));
  if (!ok) throw new Error('bad signature');
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss)) throw new Error('bad issuer');
  if (payload.aud !== clientId) throw new Error('token is for another app');
  if (payload.exp * 1000 < Date.now()) throw new Error('token expired');
  return payload;
}

export function defaultDisplayName(p) {
  const first = (p.given_name || p.name || 'Player').trim().split(/\s+/)[0];
  const last = (p.family_name || '').trim();
  return (last ? `${first} ${last[0].toUpperCase()}.` : first).slice(0, 24);
}

export async function upsertUser(env, { id, email, name, display, picture }) {
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO users (id, email, name, display_name, picture, created_at, last_seen) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)
     ON CONFLICT(id) DO UPDATE SET email = excluded.email, name = excluded.name, picture = excluded.picture, last_seen = excluded.last_seen`
  ).bind(id, email || null, name || null, display, picture || null, now).run();
  return env.DB.prepare('SELECT id, display_name, picture FROM users WHERE id = ?1').bind(id).first();
}
