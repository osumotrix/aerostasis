import { json, bad, sameOrigin, readJson, verifyGoogleToken, defaultDisplayName, upsertUser, createSession, publicUser } from '../../_lib.js';

// Exchange a Google Identity Services credential for an Aerostasis session cookie.
export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return bad('Cross-site request refused', 403);
  if (!env.GOOGLE_CLIENT_ID) return bad('Google sign-in is not configured', 503);
  let body;
  try { body = await readJson(request, 8000); } catch { return bad('Invalid request'); }
  let p;
  try { p = await verifyGoogleToken(body.credential, env.GOOGLE_CLIENT_ID); }
  catch (e) { console.log('google verify failed', e.message); return bad('Google sign-in could not be verified. Please try again.', 401); }
  if (p.email && p.email_verified === false) return bad('Please verify your Google email address first', 401);
  const user = await upsertUser(env, { id: 'g:' + p.sub, email: p.email, name: p.name, display: defaultDisplayName(p), picture: p.picture });
  const cookie = await createSession(env, user.id);
  return json({ user: publicUser(user) }, 200, { 'set-cookie': cookie });
}
