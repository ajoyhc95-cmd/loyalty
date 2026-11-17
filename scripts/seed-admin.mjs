import { createHmac, randomUUID, scryptSync } from "node:crypto";
import nextEnv from "@next/env";
import pg from "pg";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const sessionSecret = process.env.SESSION_SECRET;

if (!connectionString) throw new Error("Set DATABASE_URL before creating the first admin.");
if (!email || !password || password.length < 12) throw new Error("Set ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters.");
if (!sessionSecret || sessionSecret.length < 32) throw new Error("Set SESSION_SECRET to a random value of at least 32 characters.");

const pool = new pg.Pool({ connectionString, ssl: connectionString.includes("localhost") ? undefined : true });
const salt = createHmac("sha256", sessionSecret).update(randomUUID()).digest("hex").slice(0, 32);
const passwordHash = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;

try {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1 FOR UPDATE");
    if (existing.rowCount) throw new Error("An admin already exists; refusing to create another.");
    const userId = `ADM-${randomUUID().slice(0, 8).toUpperCase()}`;
    const inserted = await client.query(
      `INSERT INTO users (name, email, user_id, role, status, password_hash)
       VALUES ('Administrator', $1, $2, 'admin', 'active', $3) RETURNING id`,
      [email, userId, passwordHash],
    );
    await client.query(
      `INSERT INTO accounts (owner_user_id, account_type, account_number)
       VALUES ($1, 'admin_primary', $2), ($1, 'admin_secondary', $3)`,
      [inserted.rows[0].id, `AP-${randomUUID().slice(0, 8).toUpperCase()}`, `AS-${randomUUID().slice(0, 8).toUpperCase()}`],
    );
    await client.query("COMMIT");
    console.log(`Created initial administrator ${email} (${userId}).`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
