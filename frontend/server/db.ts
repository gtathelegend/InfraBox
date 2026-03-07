import { drizzle } from "drizzle-orm/node-postgres";
import { drizzle as drizzleSQLite } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

const isDevelopment = process.env.NODE_ENV === "development";

if (!isDevelopment && !process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

let db: any;
if (isDevelopment) {
  const sqlite = new Database("dev.db");
  db = drizzleSQLite(sqlite, { schema });
} else {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle(pool, { schema });
}

export { db };
