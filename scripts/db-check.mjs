// One-off verification of the applied schema. Run: node scripts/db-check.mjs
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "dotenv";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

const connectionString =
  process.env.DIRECT_URL || process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

await client.connect();

const tables = await client.query(
  `select table_name from information_schema.tables
   where table_schema='public' and table_name in ('batches','products','orders')
   order by table_name;`,
);
console.log("Tables:", tables.rows.map((r) => r.table_name).join(", ") || "none");

const orderCols = await client.query(
  `select column_name from information_schema.columns
   where table_schema='public' and table_name='orders'
     and column_name in ('item_payment_reference','shipping_payment_reference');`,
);
console.log(
  "Payment ref columns:",
  orderCols.rows.map((r) => r.column_name).join(", ") || "none",
);

const rls = await client.query(
  `select tablename, count(*)::int as policies from pg_policies
   where schemaname='public' group by tablename order by tablename;`,
);
console.log("RLS policies:", rls.rows.map((r) => `${r.tablename}=${r.policies}`).join(", "));

const bucket = await client.query(
  `select id, public from storage.buckets where id='product-images';`,
);
console.log(
  "Storage bucket:",
  bucket.rows[0] ? `product-images (public=${bucket.rows[0].public})` : "MISSING",
);

await client.end();
