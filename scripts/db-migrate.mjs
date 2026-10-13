#!/usr/bin/env node
/**
 * Tiny idempotent migration runner.
 * Applies db/schema.sql (and any future db/migrations/*.sql) once per file,
 * tracked in public.schema_migrations.
 *
 * Usage: DATABASE_URL=postgres://... npm run db:migrate
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const schemaPath = join(root, "db", "schema.sql");
const migrationsDir = join(root, "db", "migrations");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1 });

async function ensureMigrationsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `;
}

async function appliedIds() {
  const rows = await sql`SELECT id FROM public.schema_migrations`;
  return new Set(rows.map((r) => r.id));
}

async function applyFile(id, absolutePath) {
  const body = readFileSync(absolutePath, "utf8");
  console.log(`Applying ${id}...`);
  await sql.begin(async (tx) => {
    await tx.unsafe(body);
    await tx`INSERT INTO public.schema_migrations (id) VALUES (${id})`;
  });
  console.log(`  OK: ${id}`);
}

async function main() {
  await ensureMigrationsTable();
  const done = await appliedIds();

  const files = [];
  if (existsSync(schemaPath)) {
    files.push({ id: "000_schema.sql", path: schemaPath });
  }
  if (existsSync(migrationsDir)) {
    for (const name of readdirSync(migrationsDir).sort()) {
      if (name.endsWith(".sql")) {
        files.push({ id: name, path: join(migrationsDir, name) });
      }
    }
  }

  let applied = 0;
  for (const f of files) {
    if (done.has(f.id)) {
      console.log(`Skip (already applied): ${f.id}`);
      continue;
    }
    await applyFile(f.id, f.path);
    applied += 1;
  }

  console.log(applied === 0 ? "Nothing to migrate." : `Applied ${applied} migration(s).`);
  await sql.end({ timeout: 5 });
}

main().catch(async (err) => {
  console.error(err);
  try {
    await sql.end({ timeout: 1 });
  } catch {
    /* ignore */
  }
  process.exit(1);
});
