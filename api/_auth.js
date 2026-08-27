const crypto = require("crypto");

const COOKIE_NAME = "dhf_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function sign(payload, secret) {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function getConfig() {
  return {
    username: process.env.ADMIN_USERNAME || "admin",
    passwordHash: process.env.ADMIN_PASSWORD_SHA256 || "",
    secret: process.env.ADMIN_SESSION_SECRET || ""
  };
}

function missingConfig(config = getConfig()) {
  return !config.passwordHash || !config.secret;
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function timingSafeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function createSessionCookie(username, req) {
  const config = getConfig();
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(JSON.stringify({ sub: username, iat: now, exp: now + SESSION_TTL_SECONDS }));
  const token = `${payload}.${sign(payload, config.secret)}`;
  const proto = req.headers["x-forwarded-proto"] || "http";
  const secure = proto === "https" ? "; Secure" : "";
  return `${COOKIE_NAME}=${token}; Max-Age=${SESSION_TTL_SECONDS}; Path=/; HttpOnly; SameSite=Lax${secure}`;
}

function clearSessionCookie() {
  return `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`;
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(header.split(";").map((item) => item.trim().split("=")).filter((item) => item[0]));
}

function verifySession(req) {
  const config = getConfig();
  if (missingConfig(config)) return null;
  const token = parseCookies(req)[COOKIE_NAME];
  if (!token || !token.includes(".")) return null;

  const [payload, signature] = token.split(".");
  const expected = sign(payload, config.secret);
  if (!timingSafeEqual(signature, expected)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}

async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

module.exports = {
  clearSessionCookie,
  createSessionCookie,
  getConfig,
  missingConfig,
  readJson,
  sha256,
  timingSafeEqual,
  verifySession
};
