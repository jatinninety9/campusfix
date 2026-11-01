import pg from "pg";
import { runMigrations } from "./migrations.js";
export const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
export async function migrate() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('student','staff','admin'))
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS issues (
      id SERIAL PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
      category TEXT NOT NULL, location TEXT NOT NULL, priority TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'open', reporter_id INTEGER NOT NULL REFERENCES users(id),
      assignee_id INTEGER REFERENCES users(id), resolution TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_at TIMESTAMPTZ, due_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '3 days'
    );
    CREATE TABLE IF NOT EXISTS supports (
      issue_id INTEGER REFERENCES issues(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY(issue_id,user_id)
    );
  `);
return runMigrations(db);
}
