const { assertSameOrigin, clearSessionCookie } = require("./_auth");

module.exports = function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  try {
    assertSameOrigin(req);
  } catch (error) {
    return res.status(error.statusCode || 403).json({ error: error.message });
  }

  res.setHeader("Set-Cookie", clearSessionCookie(req));
  return res.status(200).json({ ok: true });
};