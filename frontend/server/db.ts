import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required. Configure PostgreSQL before starting the backend.");
}

const needsSsl = process.env.PG_SSL === "true" || process.env.NODE_ENV === "production";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(pool, { schema });
