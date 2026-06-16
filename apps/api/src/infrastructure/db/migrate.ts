import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const url = process.env["DATABASE_URL"];
if (!url) throw new Error("DATABASE_URL is required");

// onnotice suppresses PostgreSQL NOTICE messages (e.g. "column already exists,
// skipping") so the process exits 0 on idempotent IF NOT EXISTS migrations.
const sql = postgres(url, { max: 1, onnotice: () => {} });
const db = drizzle(sql);

await migrate(db, {
  migrationsFolder: path.join(__dirname, "migrations"),
});

await sql.end();
