// Server operator only: supply JSON on stdin, never passwords in command arguments.
import { readFileSync } from "node:fs";
import { z } from "zod";
import { db } from "./db.js";
import { hashPassword } from "./password.js";

try {
  const input = z
    .object({
      name: z.string().trim().min(2).max(80),
      email: z
        .email()
        .max(254)
        .transform((value) => value.toLowerCase()),
      password: z.string().min(12).max(128),
      role: z.enum(["admin", "staff"]),
    })
    .strict()
    .parse(JSON.parse(readFileSync(0, "utf8")));
  const result = await db.query(
    "INSERT INTO users(name,email,password,role) VALUES($1,$2,$3,$4) ON CONFLICT(email) DO NOTHING RETURNING email,role",
    [input.name, input.email, hashPassword(input.password), input.role],
  );
  if (!result.rowCount)
    throw new Error("That email already exists; no account was changed.");
  console.log(
    `Created ${result.rows[0].role} account: ${result.rows[0].email}`,
  );
} catch (error) {
  console.error(
    error instanceof z.ZodError
      ? "Invalid account input. Use a valid email, admin/staff role, name, and a 12–128 character password."
      : error instanceof SyntaxError
        ? "Supply valid account JSON on standard input."
        : error.message,
  );
  process.exitCode = 1;
} finally {
  await db.end();
}
