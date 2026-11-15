import { Pool } from "pg";

const globalForPg = globalThis as typeof globalThis & { loyaltyPool?: Pool };
let localPool: Pool | undefined;

function getPool() {
  if (localPool) return localPool;
  if (globalForPg.loyaltyPool) {
    localPool = globalForPg.loyaltyPool;
    return localPool;
  }

  const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error("Missing DATABASE_URL. Connect a PostgreSQL database in the Vercel Marketplace.");
  }
  localPool = new Pool({
    connectionString,
    max: process.env.VERCEL ? 1 : 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
    ssl: connectionString.includes("localhost") ? undefined : true,
  });

  if (process.env.NODE_ENV !== "production") globalForPg.loyaltyPool = localPool;
  return localPool;
}

export const db = new Proxy({} as Pool, {
  get(_target, property) {
    const pool = getPool();
    const value = Reflect.get(pool, property, pool);
    return typeof value === "function" ? value.bind(pool) : value;
  },
});
