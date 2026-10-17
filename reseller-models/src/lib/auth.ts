import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getDb, type User } from "./db";
import { hashPassword, verifyPassword } from "./crypto";

export const SESSION_COOKIE = "reseller_session";
const SESSION_TTL_DAYS = 7;

export interface SessionUser {
  id: number;
  email: string;
  name: string;
  role: "admin" | "user";
}

/** Find a user by email OR username (admin logs in with `admin`). */
export function findUser(login: string): User | undefined {
  return getDb().prepare("SELECT * FROM users WHERE email = ?").get(login.trim()) as
    | User
    | undefined;
}

export function createUser(email: string, name: string, password: string, planId?: number): User {
  const db = getDb();
  const info = db
    .prepare("INSERT INTO users (email, name, password_hash, role, status) VALUES (?, ?, ?, 'user', 'active')")
    .run(email.trim(), name.trim() || email.trim(), hashPassword(password));

  let targetPlanId = planId;
  if (!targetPlanId) {
    const free =
      (db.prepare("SELECT id FROM plans WHERE name = 'Free'").get() as { id: number } | undefined) ??
      (db.prepare("SELECT id FROM plans ORDER BY price ASC LIMIT 1").get() as { id: number } | undefined);
    targetPlanId = free?.id;
  }

  if (targetPlanId) {
    const plan = db.prepare("SELECT validity_days FROM plans WHERE id = ?").get(targetPlanId) as
      | { validity_days: number | null }
      | undefined;
    const expiresClause =
      plan?.validity_days && plan.validity_days > 0
        ? `datetime('now', '+${plan.validity_days} days')`
        : "NULL";
    db.prepare(
      `INSERT INTO user_subscriptions (user_id, plan_id, expires_at) VALUES (?, ?, ${expiresClause})`
    ).run(info.lastInsertRowid, targetPlanId);
  }
  return db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid) as User;
}

export function verifyLogin(login: string, password: string): SessionUser | null {
  const user = findUser(login);
  if (!user || !verifyPassword(password, user.password_hash)) return null;
  if (user.status === "banned") return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export function createSession(userId: number): string {
  const token = randomBytes(32).toString("hex");
  getDb()
    .prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+7 days'))")
    .run(token, userId);
  return token;
}

export function destroySession(token: string): void {
  getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export function getSessionUser(token: string | undefined): SessionUser | null {
  if (!token) return null;
  const row = getDb()
    .prepare(
      `SELECT u.id, u.email, u.name, u.role FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > datetime('now') AND (u.status IS NULL OR u.status != 'banned')`
    )
    .get(token) as SessionUser | undefined;
  return row ?? null;
}

export async function sessionFromCookies(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  return getSessionUser(cookieStore.get(SESSION_COOKIE)?.value);
}

export async function requireUser(): Promise<SessionUser> {
  const user = await sessionFromCookies();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") throw new Error("Forbidden");
  return user;
}
