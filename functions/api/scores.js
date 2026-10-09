import { json, bad, sameOrigin, readJson, currentUser } from '../_lib.js';

const better = (a, b) => (a.valuation - b.valuation) || (a.stars - b.stars) || (a.days - b.days);

async function rankOf(env, s) {
  const r = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM scores WHERE valuation > ?1 OR (valuation = ?1 AND stars > ?2) OR (valuation = ?1 AND stars = ?2 AND days > ?3)'
  ).bind(s.valuation, s.stars, s.days).first();
  return (r ? r.n : 0) + 1;
}

// Leaderboard: the top 50 plus the signed-in player's own row and rank.
export async function onRequestGet({ request, env }) {
  const user = await currentUser(env, request);
  const { results } = await env.DB.prepare(
    `SELECT s.user_id AS id, u.display_name AS name, u.picture AS avatar, s.fbo_name AS fbo, s.valuation, s.stars, s.days, s.quiz
     FROM scores s JOIN users u ON u.id = s.user_id ORDER BY s.valuation DESC, s.stars DESC, s.days DESC LIMIT 50`
  ).all();
  const total = (await env.DB.prepare('SELECT COUNT(*) AS n FROM scores').first()).n;
  let me = null;
  if (user) {
    me = await env.DB.prepare(
      `SELECT s.user_id AS id, u.display_name AS name, u.picture AS avatar, s.fbo_name AS fbo, s.valuation, s.stars, s.days, s.quiz
       FROM scores s JOIN users u ON u.id = s.user_id WHERE s.user_id = ?1`
    ).bind(user.id).first();
    if (me) me.rank = await rankOf(env, me);
  }
  return json({ rows: results, total, me });
}

// Post a run. Only the player's best run (by valuation, then stars, then days) is kept.
export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return bad('Cross-site request refused', 403);
  const user = await currentUser(env, request);
  if (!user) return bad('Please sign in to post a score', 401);
  let b;
  try { b = await readJson(request, 4000); } catch { return bad('Invalid request'); }
  const int = (v) => Math.round(Number(v));
  const s = { valuation: int(b.valuation), stars: int(b.stars), days: int(b.days), quiz: int(b.quiz), rev: int(b.rev), flights: int(b.flights) };
  if (!Number.isFinite(s.valuation) || ['stars', 'days', 'quiz', 'rev', 'flights'].some((k) => !Number.isFinite(s[k]) || s[k] < 0)) return bad('Invalid score');
  // Basic plausibility checks. The game runs in the browser, so these limit obvious tampering rather than prevent it.
  if (s.days < 1 || s.days > 5000 || s.stars > s.days * 3 || s.quiz > Math.ceil(s.days / 5) * 3 || Math.abs(s.valuation) > 5e9 || s.flights > s.days * 40)
    return bad('Score rejected as implausible', 422);
  const fbo = String(b.fboName || '').slice(0, 22);
  const prev = await env.DB.prepare('SELECT valuation, stars, days FROM scores WHERE user_id = ?1').bind(user.id).first();
  let kept = false;
  if (!prev || better(s, prev) > 0) {
    await env.DB.prepare(
      `INSERT INTO scores (user_id, valuation, stars, days, quiz, rev, flights, fbo_name, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
       ON CONFLICT(user_id) DO UPDATE SET valuation = excluded.valuation, stars = excluded.stars, days = excluded.days, quiz = excluded.quiz,
       rev = excluded.rev, flights = excluded.flights, fbo_name = excluded.fbo_name, updated_at = excluded.updated_at`
    ).bind(user.id, s.valuation, s.stars, s.days, s.quiz, s.rev, s.flights, fbo, Date.now()).run();
    kept = true;
  }
  const best = kept ? s : prev;
  const total = (await env.DB.prepare('SELECT COUNT(*) AS n FROM scores').first()).n;
  return json({ kept, rank: await rankOf(env, best), total });
}
