const {
  assertSameOrigin,
  createSessionCookie,
  getConfig,
  missingConfig,
  readJson,
  sha256,
  timingSafeEqual
} = require("./_auth");

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 8;
const attempts = new Map();

function clientKey(req, username) {
  const forwarded = String(req.headers?.["x-forwarded-for"] || "").split(",")[0].trim();
  const ip = forwarded || req.socket?.remoteAddress || "unknown";
  return `${ip}:${String(username || "").toLowerCase()}`;
}

function getAttemptState(key) {
  const now = Date.now();
  const state = attempts.get(key);
  if (!state || state.resetAt <= now) return { count: 0, resetAt: now + LOGIN_WINDOW_MS };
  return state;
}

function recordFailedAttempt(key) {
  const state = getAttemptState(key);
  state.count += 1;
  attempts.set(key, state);
  return state;
}

function clearAttempts(key) {
  attempts.delete(key);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  try {
    assertSameOrigin(req);
  } catch (error) {
    return res.status(error.statusCode || 403).json({ error: error.message });
  }

  const config = getConfig();
  if (missingConfig(config)) {
    return res.status(503).json({ error: "auth_not_configured" });
  }

  try {
    const body = await readJson(req);
    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    const key = clientKey(req, username);
    const currentAttempts = getAttemptState(key);

    if (currentAttempts.count >= MAX_LOGIN_ATTEMPTS) {
      res.setHeader("Retry-After", String(Math.ceil((currentAttempts.resetAt - Date.now()) / 1000)));
      return res.status(429).json({ error: "too_many_login_attempts" });
    }

    const validUser = username === config.username;
    const validPassword = timingSafeEqual(sha256(password), config.passwordHash);

    if (!validUser || !validPassword) {
      recordFailedAttempt(key);
      return res.status(401).json({ error: "invalid_credentials" });
    }

    clearAttempts(key);
    res.setHeader("Set-Cookie", createSessionCookie(username, req));
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(400).json({ error: "bad_request" });
  }
};