import { json, bad, sameOrigin, readJson, currentUser } from '../_lib.js';

// Cloud save: one saved company per player, so a game can continue on another device.
export async function onRequestGet({ request, env }) {
  const user = await currentUser(env, request);
  if (!user) return bad('Please sign in', 401);
  const row = await env.DB.prepare('SELECT day, data, updated_at FROM saves WHERE user_id = ?1').bind(user.id).first();
  return json({ save: row ? { day: row.day, data: JSON.parse(row.data), updatedAt: row.updated_at } : null });
}

export async function onRequestPut({ request, env }) {
  if (!sameOrigin(request)) return bad('Cross-site request refused', 403);
  const user = await currentUser(env, request);
  if (!user) return bad('Please sign in', 401);
  let b;
  try { b = await readJson(request, 400000); } catch { return bad('Save too large or invalid', 413); }
  const day = Math.round(Number(b.data && b.data.day));
  if (!Number.isFinite(day) || day < 1 || day > 5000) return bad('Invalid save');
  await env.DB.prepare(
    `INSERT INTO saves (user_id, day, data, updated_at) VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT(user_id) DO UPDATE SET day = excluded.day, data = excluded.data, updated_at = excluded.updated_at`
  ).bind(user.id, day, JSON.stringify(b.data), Date.now()).run();
  return json({ ok: true });
}

export async function onRequestDelete({ request, env }) {
  if (!sameOrigin(request)) return bad('Cross-site request refused', 403);
  const user = await currentUser(env, request);
  if (!user) return bad('Please sign in', 401);
  await env.DB.prepare('DELETE FROM saves WHERE user_id = ?1').bind(user.id).run();
  return json({ ok: true });
}
