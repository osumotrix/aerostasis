import { json, bad, sameOrigin, getCookie, sha256, SESSION_COOKIE, sessionCookie } from '../../_lib.js';
export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return bad('Cross-site request refused', 403);
  const token = getCookie(request, SESSION_COOKIE);
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE id = ?1').bind(await sha256(token)).run();
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie('', 0) });
}
