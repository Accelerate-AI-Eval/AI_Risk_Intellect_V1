import fs from "node:fs";
import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "../database/db.js";

/** Resolves to `<backend>/drizzle` when `npm run db:migrate` is run from the backend package. */
const migrationsFolder = path.resolve(process.cwd(), "drizzle");

async function main() {
  const journalPath = path.join(migrationsFolder, "meta", "_journal.json");
  if (!fs.existsSync(journalPath)) {
    console.error(
      `Missing migrations journal at ${journalPath}. Run "npm run db:generate" from the backend package first.`,
    );
    process.exit(1);
  }
  console.log("Running database migrations...");
  await migrate(db, { migrationsFolder });
  console.log("Migrations completed.");
  await pool.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("Migration failed:", err);
  await pool.end();
  process.exit(1);
});
