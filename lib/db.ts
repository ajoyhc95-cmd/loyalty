import { Pool } from "pg";

const globalForPg = globalThis as typeof globalThis & { loyaltyPool?: Pool };

function createPool() {
  const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error("Missing DATABASE_URL. Connect a PostgreSQL database in the Vercel Marketplace.");
  }
  return new Pool({
    connectionString,
    max: process.env.VERCEL ? 1 : 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
    ssl: connectionString.includes("localhost") ? undefined : true,
  });
}

export const db = globalForPg.loyaltyPool ?? createPool();

if (process.env.NODE_ENV !== "production") globalForPg.loyaltyPool = db;
