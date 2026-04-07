import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "./pool.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.join(__dirname, "migrations");

async function ensureMigrationTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id VARCHAR(64) PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getAppliedMigrations() {
  const [rows] = await pool.query("SELECT id FROM schema_migrations");
  return new Set(rows.map((r) => r.id));
}

async function applyMigration(file) {
  const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const statement of statements) {
      await conn.query(statement);
    }
    await conn.query("INSERT INTO schema_migrations (id) VALUES (?)", [file]);
    await conn.commit();
    console.log(`Applied migration: ${file}`);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function main() {
  await ensureMigrationTable();
  const applied = await getAppliedMigrations();
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (!applied.has(file)) {
      await applyMigration(file);
    }
  }
  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
