import { app } from "./app.js";
import { db, migrate } from "./db.js";
await migrate();
const server = app.listen(process.env.PORT || 4000, process.env.HOST || "127.0.0.1" , () =>
  console.log("CampusFix API: http://localhost:4000"),
);
async function shutdown() {
  server.close(async () => {
    await db.end();
    process.exit(0);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
