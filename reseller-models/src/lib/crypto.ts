import { createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

function secret(): Buffer {
  const raw = process.env.RESELLER_KEY_SECRET ?? "";
  if (raw.length < 32) {
    throw new Error(
      "RESELLER_KEY_SECRET must be set (32+ chars). Generate with: openssl rand -hex 32"
    );
  }
  // Derive a fixed 32-byte key from the configured secret.
  return scryptSync(raw, "reseller-models:v1", 32);
}

/** Password hashing (scrypt, same parameters everywhere). Stored as `saltHex$hashHex`. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32);
  return `${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split("$");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), 32);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** AES-256-GCM encrypt a BYOK key at rest. Returns `ivHex:cipherHex:tagHex`. */
export function encryptKey(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secret(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return `${iv.toString("hex")}:${enc.toString("hex")}:${cipher.getAuthTag().toString("hex")}`;
}

export function decryptKey(payload: string): string {
  const [ivHex, cipherHex, tagHex] = payload.split(":");
  if (!ivHex || !cipherHex || !tagHex) throw new Error("Malformed encrypted key");
  const decipher = createDecipheriv("aes-256-gcm", secret(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(cipherHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

/** Public-safe masked reference (`sk-ant-api...3a9f`) for display + pause matching. */
export function maskKey(key: string): string {
  const clean = key.trim();
  if (clean.length <= 10) return `${clean.slice(0, 4)}...${clean.slice(-2)}`;
  return `${clean.slice(0, 10)}...${clean.slice(-4)}`;
}
