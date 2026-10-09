import { json, bad, sameOrigin, readJson, currentUser, publicUser } from '../_lib.js';

export async function onRequestGet({ request, env }) {
  return json({ user: publicUser(await currentUser(env, request)) });
}

// Change the name shown on the leaderboard.
export async function onRequestPatch({ request, env }) {
  if (!sameOrigin(request)) return bad('Cross-site request refused', 403);
  const user = await currentUser(env, request);
  if (!user) return bad('Please sign in', 401);
  let body;
  try { body = await readJson(request, 2000); } catch { return bad('Invalid request'); }
  const name = String(body.displayName || '').replace(/\s+/g, ' ').trim();
  if (!/^[\p{L}\p{N} .'\-]{2,24}$/u.test(name)) return bad('Use 2 to 24 letters, numbers, spaces, full stops, hyphens or apostrophes');
  await env.DB.prepare('UPDATE users SET display_name = ?1 WHERE id = ?2').bind(name, user.id).run();
  return json({ user: { ...publicUser(user), name } });
}
