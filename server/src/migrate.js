import { db, migrate } from "./db.js";

try {
  const applied = await migrate();
  console.log(
    applied.length
      ? `Applied migrations: ${applied.join(", ")}`
      : "No pending migrations.",
  );
} finally {
  await db.end();
}
