import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const DATABASE_USER = process.env.DATABASE_USER ?? "postgres";
const DATABASE_PASSWORD = process.env.DATABASE_PASSWORD ?? "Postgresql123";
const DATABASE_HOST = process.env.DATABASE_HOST ?? "localhost";
const DATABASE_PORT = process.env.DATABASE_PORT ?? "5432";
const DATABASE_NAME = process.env.DATABASE_NAME ?? "ai_risk_empty_db";

const DATABASE_URI = `postgresql://${DATABASE_USER}:${DATABASE_PASSWORD}@${DATABASE_HOST}:${DATABASE_PORT}/${DATABASE_NAME}`;

const pool = new Pool({
  connectionString: DATABASE_URI,
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle Postgres client", err);
});

export const db = drizzle(pool);
export { pool };

export async function initDB() {
  try {
    await db.execute(sql`SELECT 1 AS connected`);
    // logger.info("Database connected successfully");
    console.log("Database connected successfully")
  } catch (err) {
    console.log("Database connection failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err; // stop server if DB fails
  }
}
