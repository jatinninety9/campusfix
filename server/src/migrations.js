import { readdir, readFile } from "node:fs/promises";

export async function runMigrations(pool) {
  const directory = new URL("./migrations/", import.meta.url);
  const files = (await readdir(directory))
    .filter(name => /^\d+_[a-z0-9_]+\.sql$/i.test(name))
    .sort();

  const client = await pool.connect();
  const applied = [];

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [72641001]);

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    for (const filename of files) {
      const existing = await client.query(
        "SELECT version FROM schema_migrations WHERE version=$1",
        [filename],
      );

      if (existing.rowCount) continue;

      const sql = await readFile(new URL(filename, directory), "utf8");
      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations(version) VALUES($1)",
        [filename],
      );
      applied.push(filename);
    }

    await client.query("COMMIT");
    return applied;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
