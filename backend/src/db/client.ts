import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

const connectionString = process.env.DATABASE_URL!;
// Managed Postgres hosts used for free deployment (Neon, Supabase, Render's
// managed Postgres, etc.) require SSL, but `pg` doesn't reliably parse
// `sslmode=require` out of the connection string on its own — without this,
// connecting to those hosts fails outright. Local/Docker Postgres has no
// sslmode in its URL, so this only kicks in when it's actually needed.
const pool = new Pool({
  connectionString,
  ssl: connectionString.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(pool, { schema });
