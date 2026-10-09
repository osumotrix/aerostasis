-- Aerostasis D1 schema. Apply with: npx wrangler d1 execute aerostasis --remote --file=schema.sql
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT, name TEXT, display_name TEXT NOT NULL, picture TEXT, created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS scores (user_id TEXT PRIMARY KEY, valuation INTEGER NOT NULL DEFAULT 0, stars INTEGER NOT NULL DEFAULT 0, days INTEGER NOT NULL DEFAULT 0, quiz INTEGER NOT NULL DEFAULT 0, rev INTEGER NOT NULL DEFAULT 0, flights INTEGER NOT NULL DEFAULT 0, fbo_name TEXT, updated_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_scores_rank ON scores(valuation DESC, stars DESC, days DESC);
CREATE TABLE IF NOT EXISTS saves (user_id TEXT PRIMARY KEY, day INTEGER NOT NULL, data TEXT NOT NULL, updated_at INTEGER NOT NULL);
