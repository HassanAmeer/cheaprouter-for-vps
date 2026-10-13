/** Seed reseller.db (also runs automatically on first DB open). */
import { getDb } from "../src/lib/db";

const db = getDb();
const users = db.prepare("SELECT email, role FROM users ORDER BY id").all();
const plans = db.prepare("SELECT name, token_budget, rpm_limit, validity_days FROM plans").all();
console.log("users:", JSON.stringify(users));
console.log("plans:", JSON.stringify(plans));
console.log("seed ok:", db.prepare("SELECT COUNT(*) AS n FROM users").get());
