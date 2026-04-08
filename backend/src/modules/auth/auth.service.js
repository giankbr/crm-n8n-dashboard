import crypto from "crypto";
import { config } from "../../config.js";
import { pool } from "../../db/pool.js";

function base64UrlEncode(value) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value) {
  return crypto.createHmac("sha256", config.auth.tokenSecret).update(value).digest("base64url");
}

function safeEqual(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function parseUsers() {
  return String(config.auth.users)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [username, password, role = "operator"] = item.split(":").map((part) => part.trim());
      return { username, password, role };
    })
    .filter((user) => user.username && user.password);
}

function hashPassword(plain, salt = crypto.randomBytes(16).toString("hex")) {
  const derived = crypto.scryptSync(plain, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

function verifyPassword(plain, storedHash) {
  if (!storedHash || !storedHash.startsWith("scrypt$")) return false;
  const parts = storedHash.split("$");
  if (parts.length !== 3) return false;
  const salt = parts[1];
  const expected = parts[2];
  const actual = crypto.scryptSync(plain, salt, 64).toString("hex");
  return safeEqual(actual, expected);
}

export async function ensureAdminUsersSeeded() {
  const users = parseUsers();
  for (const user of users) {
    const passwordHash = hashPassword(user.password);
    await pool.query(
      `INSERT INTO admin_users (username, password_hash, role, is_active)
       VALUES (?, ?, ?, TRUE)
       ON DUPLICATE KEY UPDATE role = VALUES(role), is_active = TRUE`,
      [user.username, passwordHash, user.role === "admin" ? "admin" : "operator"]
    );
  }
}

export async function loginDashboardUser(username, password) {
  await ensureAdminUsersSeeded();
  const [rows] = await pool.query(
    `SELECT username, password_hash, role, is_active
     FROM admin_users
     WHERE username = ?
     LIMIT 1`,
    [username]
  );
  const user = rows[0];
  if (!user || !user.is_active) return null;
  if (!verifyPassword(password, user.password_hash)) return null;

  const nowSec = Math.floor(Date.now() / 1000);
  const exp = nowSec + config.auth.tokenTtlHours * 60 * 60;
  const payload = {
    sub: String(user.username),
    role: String(user.role),
    iat: nowSec,
    exp
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload);
  const token = `${encodedPayload}.${signature}`;

  return {
    token,
    user: { username: payload.sub, role: payload.role, exp }
  };
}

export function verifyDashboardToken(token) {
  if (!token || !token.includes(".")) return null;
  const [payloadPart, signaturePart] = token.split(".");
  if (!payloadPart || !signaturePart) return null;
  const expectedSignature = sign(payloadPart);
  if (!safeEqual(signaturePart, expectedSignature)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(payloadPart));
    if (!payload?.sub || !payload?.role || !payload?.exp) return null;
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp < nowSec) return null;
    return { username: payload.sub, role: payload.role, exp: payload.exp };
  } catch {
    return null;
  }
}
