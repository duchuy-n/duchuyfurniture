const {
  createSessionCookie,
  getConfig,
  missingConfig,
  readJson,
  sha256,
  timingSafeEqual
} = require("./_auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const config = getConfig();
  if (missingConfig(config)) {
    return res.status(503).json({ error: "auth_not_configured" });
  }

  try {
    const body = await readJson(req);
    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    const validUser = username === config.username;
    const validPassword = timingSafeEqual(sha256(password), config.passwordHash);

    if (!validUser || !validPassword) {
      return res.status(401).json({ error: "invalid_credentials" });
    }

    res.setHeader("Set-Cookie", createSessionCookie(username, req));
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(400).json({ error: "bad_request" });
  }
};
