import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { hashPassword } from "./crypto";

export interface User {
  id: number;
  email: string;
  name: string;
  password_hash: string;
  role: "admin" | "user";
  created_at: string;
}

export interface Plan {
  id: number;
  name: string;
  token_budget: number | null;
  rpm_limit: number | null;
  validity_days: number | null;
  models: string[] | null;
  created_at: string;
}

export interface Subscription {
  id: number;
  user_id: number;
  plan_id: number;
  cheaprouter_api_key: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface ByokKey {
  id: number;
  user_id: number;
  provider_id: string;
  masked_key: string;
  encrypted_key: string;
  is_paused: number;
  created_at: string;
}

let db: Database.Database | null = null;

export function dbPath(): string {
  return (
    process.env.RESELLER_DB_PATH ??
    path.join(process.cwd(), "data", "reseller.db")
  );
}

export function getDb(): Database.Database {
  if (db) return db;
  const file = dbPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  db = new Database(file);
  db.pragma("journal_mode = WAL");
  ensureSchema(db);
  ensureSeeded(db);
  return db;
}

function ensureSchema(handle: Database.Database): void {
  handle.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL DEFAULT '',
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      token_budget INTEGER,
      rpm_limit INTEGER,
      validity_days INTEGER,
      models TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS user_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      plan_id INTEGER NOT NULL,
      cheaprouter_api_key TEXT,
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (plan_id) REFERENCES plans(id)
    );
    CREATE TABLE IF NOT EXISTS user_byok_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      provider_id TEXT NOT NULL,
      masked_key TEXT NOT NULL,
      encrypted_key TEXT NOT NULL,
      is_paused INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_byok_user ON user_byok_keys(user_id);
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
}

function parseModels(raw: unknown): string[] | null {
  if (raw == null) return null;
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed.map(String) : null;
  } catch {
    return null;
  }
}

export function rowToPlan(row: Record<string, unknown>): Plan {
  return {
    id: row.id as number,
    name: row.name as string,
    token_budget: (row.token_budget as number | null) ?? null,
    rpm_limit: (row.rpm_limit as number | null) ?? null,
    validity_days: (row.validity_days as number | null) ?? null,
    models: parseModels(row.models),
    created_at: row.created_at as string,
  };
}

/** Idempotent seed: default plans + the three pre-seeded accounts. */
export function ensureSeeded(handle: Database.Database): void {
  const seedPlans = [
    { name: "Free", token_budget: 10_000_000, rpm_limit: 10, validity_days: 7, models: null as string[] | null },
    { name: "Pro", token_budget: 50_000_000, rpm_limit: 30, validity_days: 30, models: null },
    { name: "Premium", token_budget: 100_000_000, rpm_limit: 120, validity_days: null, models: null },
  ];
  const insertPlan = handle.prepare(
    `INSERT OR IGNORE INTO plans (name, token_budget, rpm_limit, validity_days, models)
     VALUES (@name, @token_budget, @rpm_limit, @validity_days, @models)`
  );
  for (const p of seedPlans) {
    insertPlan.run({ ...p, models: p.models ? JSON.stringify(p.models) : null });
  }

  const seedUsers = [
    { email: "admin", name: "Administrator", password: "1234", role: "admin" },
    { email: "user1@gmail.com", name: "User One", password: "1234", role: "user" },
    { email: "user2@gmail.com", name: "User Two", password: "1234", role: "user" },
  ];
  const insertUser = handle.prepare(
    `INSERT OR IGNORE INTO users (email, name, password_hash, role)
     VALUES (@email, @name, @password_hash, @role)`
  );
  for (const u of seedUsers) {
    insertUser.run({ email: u.email, name: u.name, password_hash: hashPassword(u.password), role: u.role });
  }

  // Every non-admin user gets the Free plan when they have no subscription.
  const free = handle.prepare("SELECT id FROM plans WHERE name = 'Free'").get() as { id: number };
  const users = handle.prepare("SELECT id FROM users WHERE role = 'user'").all() as Array<{ id: number }>;
  const insertSub = handle.prepare(
    `INSERT OR IGNORE INTO user_subscriptions (user_id, plan_id, expires_at)
     VALUES (?, ?, datetime('now', '+7 days'))`
  );
  for (const u of users) insertSub.run(u.id, free.id);

  const settings = handle.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
  settings.run("cheaproute_url", process.env.CHEAPROUTE_URL ?? "http://localhost:20128");
}
