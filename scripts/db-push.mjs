// Applies supabase/schema.sql to your Postgres database over a connection
// string. Run with:  npm run db:push
//
// Requires SUPABASE_DB_URL in .env.local (or the environment). Get it from the
// Supabase dashboard → Project Settings → Database → Connection string (URI).
// It looks like:
//   postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres
// This is a SECRET — it's in .env.local, which is gitignored.
//
// The schema is written to be idempotent (create if not exists / drop policy
// if exists / add column if not exists), so it's safe to run repeatedly.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "dotenv";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local then .env (first wins).
config({ path: join(__dirname, "..", ".env.local") });
config({ path: join(__dirname, "..", ".env") });

// Prefer a direct/session connection for DDL (handles multi-statement scripts
// cleanly). Fall back to the pooled/transaction URL or the legacy var name.
const connectionString =
  process.env.DIRECT_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.DATABASE_URL;
if (!connectionString) {
  console.error(
    "\n✖ No database URL set. Add DIRECT_URL (session pooler, port 5432) —\n" +
      "  or DATABASE_URL / SUPABASE_DB_URL — to .env.local, then run\n" +
      "  `npm run db:push` again.\n",
  );
  process.exit(1);
}

const schemaPath = join(__dirname, "..", "supabase", "schema.sql");
const sql = readFileSync(schemaPath, "utf8");

const client = new pg.Client({
  connectionString,
  // Supabase requires SSL; allow the managed cert chain.
  ssl: { rejectUnauthorized: false },
});

try {
  console.log("→ Connecting to database…");
  await client.connect();
  console.log("→ Applying supabase/schema.sql…");
  await client.query(sql);
  console.log("✓ Schema applied successfully.");
} catch (err) {
  console.error("\n✖ Failed to apply schema:\n", err.message, "\n");
  process.exitCode = 1;
} finally {
  await client.end();
}
