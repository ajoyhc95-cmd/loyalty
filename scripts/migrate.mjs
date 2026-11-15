import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadEnvConfig } from "@next/env";
import pg from "pg";

loadEnvConfig(process.cwd());
const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
if (!connectionString) throw new Error("Set DATABASE_URL (Vercel Marketplace PostgreSQL connection string) first.");

const pool = new pg.Pool({ connectionString, ssl: connectionString.includes("localhost") ? undefined : true });
try {
  const schema = await readFile(resolve("db", "schema.sql"), "utf8");
  await pool.query(schema);
  console.log("Database schema is up to date.");
} finally {
  await pool.end();
}
