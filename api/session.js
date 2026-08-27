const { missingConfig, verifySession } = require("./_auth");

module.exports = function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  if (missingConfig()) {
    return res.status(503).json({ error: "auth_not_configured" });
  }

  const session = verifySession(req);
  if (!session) {
    return res.status(401).json({ error: "not_authenticated" });
  }

  return res.status(200).json({ ok: true, user: session.sub, expiresAt: session.exp });
};
