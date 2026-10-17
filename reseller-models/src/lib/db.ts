import type BetterSqlite3 from "better-sqlite3";
import * as nodeModule from "node:module";
import fs from "node:fs";
import path from "node:path";
import { hashPassword } from "./crypto";

const esmRequire = nodeModule.createRequire(
  process.argv[1] && process.argv[1] !== "[eval]"
    ? process.argv[1]
    : `${process.cwd()}/package.json`
);

function getDatabaseConstructor(): any {
  return Reflect.apply(esmRequire, undefined, ["better-sqlite3"]);
}

export interface User {
  id: number;
  email: string;
  name: string;
  password_hash: string;
  role: "admin" | "user";
  status: "active" | "banned";
  created_at: string;
}

export interface Plan {
  id: number;
  name: string;
  price: number;
  description: string;
  features: string[];
  token_budget: number | null;
  rpm_limit: number | null;
  validity_days: number | null;
  models: string[] | null;
  is_popular: number;
  created_at: string;
}

export interface Subscription {
  id: number;
  user_id: number;
  plan_id: number;
  cheaprouter_api_key: string | null;
  tokens_used: number;
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

const globalForDb = globalThis as unknown as {
  __reseller_db?: BetterSqlite3.Database;
};

export function dbPath(): string {
  return (
    process.env.RESELLER_DB_PATH ??
    path.join(process.cwd(), "data", "reseller.db")
  );
}

export function getDb(): BetterSqlite3.Database {
  if (globalForDb.__reseller_db) return globalForDb.__reseller_db;
  const file = dbPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const Database = getDatabaseConstructor();
  const instance = new Database(file);
  instance.pragma("journal_mode = WAL");
  ensureSchema(instance);
  ensureSeeded(instance);
  globalForDb.__reseller_db = instance;
  return instance;
}

function ensureSchema(handle: BetterSqlite3.Database): void {
  handle.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL DEFAULT '',
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'banned')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      price REAL NOT NULL DEFAULT 0,
      description TEXT NOT NULL DEFAULT '',
      features TEXT NOT NULL DEFAULT '[]',
      token_budget INTEGER,
      rpm_limit INTEGER,
      validity_days INTEGER,
      models TEXT,
      is_popular INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS user_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      plan_id INTEGER NOT NULL,
      cheaprouter_api_key TEXT,
      tokens_used INTEGER NOT NULL DEFAULT 0,
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

  // Safe incremental migration for existing databases:
  const checkColumn = (table: string, col: string): boolean => {
    try {
      const cols = handle.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
      return cols.some((c) => c.name === col);
    } catch {
      return false;
    }
  };

  if (!checkColumn("plans", "price")) {
    handle.exec("ALTER TABLE plans ADD COLUMN price REAL NOT NULL DEFAULT 0");
  }
  if (!checkColumn("plans", "description")) {
    handle.exec("ALTER TABLE plans ADD COLUMN description TEXT NOT NULL DEFAULT ''");
  }
  if (!checkColumn("plans", "features")) {
    handle.exec("ALTER TABLE plans ADD COLUMN features TEXT NOT NULL DEFAULT '[]'");
  }
  if (!checkColumn("plans", "is_popular")) {
    handle.exec("ALTER TABLE plans ADD COLUMN is_popular INTEGER NOT NULL DEFAULT 0");
  }
  if (!checkColumn("users", "status")) {
    handle.exec("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
  }
  if (!checkColumn("user_subscriptions", "tokens_used")) {
    handle.exec("ALTER TABLE user_subscriptions ADD COLUMN tokens_used INTEGER NOT NULL DEFAULT 0");
  }
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

function parseStringArray(raw: unknown): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function rowToPlan(row: Record<string, unknown>): Plan {
  return {
    id: row.id as number,
    name: row.name as string,
    price: Number(row.price ?? 0),
    description: (row.description as string) || "",
    features: parseStringArray(row.features),
    token_budget: (row.token_budget as number | null) ?? null,
    rpm_limit: (row.rpm_limit as number | null) ?? null,
    validity_days: (row.validity_days as number | null) ?? null,
    models: parseModels(row.models),
    is_popular: Number(row.is_popular ?? 0),
    created_at: row.created_at as string,
  };
}

/** Idempotent seed: default plans + settings + admin/user accounts. */
export function ensureSeeded(handle: BetterSqlite3.Database): void {
  const seedPlans = [
    {
      name: "Free",
      price: 0,
      description: "Ideal for testing models and casual development with high-speed endpoints.",
      features: JSON.stringify([
        "10 Million Free Tokens",
        "Free & WebChat Models Access",
        "10 Requests / Minute Limit",
        "Pay-as-you-go compatible",
        "Community Discord Support",
      ]),
      token_budget: 10_000_000,
      rpm_limit: 10,
      validity_days: 7,
      models: null as string[] | null,
      is_popular: 0,
    },
    {
      name: "Pro",
      price: 15,
      description: "Best for developers and power users wanting full access to all 370+ AI models.",
      features: JSON.stringify([
        "50 Million High-Speed Tokens",
        "All 370+ AI Models & Combos",
        "60 Requests / Minute Limit",
        "Bring Your Own Key (BYOK) Vault",
        "Instant Fallback & Auto-Failover",
        "Priority Support Channel",
      ]),
      token_budget: 50_000_000,
      rpm_limit: 60,
      validity_days: 30,
      models: null,
      is_popular: 1,
    },
    {
      name: "Premium",
      price: 39,
      description: "For teams, high-throughput agents, and production applications.",
      features: JSON.stringify([
        "150 Million Priority Tokens",
        "Highest Throughput Tier (180 RPM)",
        "Zero-Cold-Start Fast Track",
        "Unlimited BYOK Providers",
        "Custom Routing & Strict Fallbacks",
        "24/7 VIP Dedicated Support",
      ]),
      token_budget: 150_000_000,
      rpm_limit: 180,
      validity_days: 30,
      models: null,
      is_popular: 0,
    },
  ];

  const updateOrInsertPlan = handle.prepare(
    `INSERT INTO plans (name, price, description, features, token_budget, rpm_limit, validity_days, models, is_popular)
     VALUES (@name, @price, @description, @features, @token_budget, @rpm_limit, @validity_days, @models, @is_popular)
     ON CONFLICT(name) DO UPDATE SET
       price = excluded.price,
       description = CASE WHEN plans.description = '' THEN excluded.description ELSE plans.description END,
       features = CASE WHEN plans.features = '[]' THEN excluded.features ELSE plans.features END,
       token_budget = COALESCE(plans.token_budget, excluded.token_budget),
       rpm_limit = COALESCE(plans.rpm_limit, excluded.rpm_limit),
       validity_days = COALESCE(plans.validity_days, excluded.validity_days),
       is_popular = excluded.is_popular`
  );
  for (const p of seedPlans) {
    updateOrInsertPlan.run({
      ...p,
      models: p.models ? JSON.stringify(p.models) : null,
    });
  }

  // Ensure default Admin account exists with password '1234'
  const adminPasswordHash = hashPassword("1234");
  const adminExists = handle.prepare("SELECT id FROM users WHERE email = 'admin'").get() as { id: number } | undefined;
  if (adminExists) {
    handle.prepare("UPDATE users SET password_hash = ?, role = 'admin', status = 'active' WHERE id = ?").run(adminPasswordHash, adminExists.id);
  } else {
    handle.prepare(
      `INSERT INTO users (email, name, password_hash, role, status)
       VALUES ('admin', 'Administrator', ?, 'admin', 'active')`
    ).run(adminPasswordHash);
  }

  // Seed demo test users if not present
  const seedUsers = [
    { email: "user1@gmail.com", name: "User One", password: "1234", role: "user" },
    { email: "user2@gmail.com", name: "User Two", password: "1234", role: "user" },
  ];
  const insertUser = handle.prepare(
    `INSERT OR IGNORE INTO users (email, name, password_hash, role, status)
     VALUES (@email, @name, @password_hash, @role, 'active')`
  );
  for (const u of seedUsers) {
    insertUser.run({ email: u.email, name: u.name, password_hash: hashPassword(u.password), role: u.role });
  }

  // Ensure every user has a default subscription
  const free = handle.prepare("SELECT id FROM plans WHERE name = 'Free'").get() as { id: number } | undefined;
  if (free) {
    const users = handle.prepare("SELECT id FROM users WHERE role = 'user'").all() as Array<{ id: number }>;
    const insertSub = handle.prepare(
      `INSERT OR IGNORE INTO user_subscriptions (user_id, plan_id, expires_at)
       VALUES (?, ?, datetime('now', '+7 days'))`
    );
    for (const u of users) insertSub.run(u.id, free.id);
  }

  // Seed default branding & configuration settings
  const defaultSettings: Record<string, string> = {
    site_name: "UnoRouter",
    site_logo: "",
    hero_title: "UNIFIED CRTT",
    hero_subtitle: "Connect to 226+ AI models through one unified API key. Build apps and run agents with auto-failover, lowest latency, and pay-as-you-go pricing.",
    hero_cta_text: "GET STARTED",
    currency_symbol: "$",
    discord_url: "https://discord.gg",
    contact_email: "support@unorouter.com",
    footer_text: "The unified high-speed AI proxy & router. One endpoint, 370+ AI models, auto-failover, and Bring Your Own Key support.",
    cheaproute_url: process.env.CHEAPROUTE_URL ?? "http://localhost:20128",
  };

  const insertSetting = handle.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
  for (const [k, v] of Object.entries(defaultSettings)) {
    insertSetting.run(k, v);
  }
}

export function getSetting(key: string, defaultValue = ""): string {
  try {
    const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
    return row ? row.value : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function getAllSettings(): Record<string, string> {
  try {
    const rows = getDb().prepare("SELECT key, value FROM settings").all() as Array<{ key: string; value: string }>;
    const out: Record<string, string> = {};
    for (const r of rows) {
      out[r.key] = r.value;
    }
    return out;
  } catch {
    return {};
  }
}

export function setSetting(key: string, value: string): void {
  getDb()
    .prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, value);
}

export function setSettingsBulk(settings: Record<string, string>): void {
  const db = getDb();
  const stmt = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
  db.transaction(() => {
    for (const [k, v] of Object.entries(settings)) {
      stmt.run(k, String(v));
    }
  })();
}
