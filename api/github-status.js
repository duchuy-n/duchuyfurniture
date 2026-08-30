const { verifySession } = require("./_auth");
const { checkGithubStatus } = require("./_catalog");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const session = verifySession(req);
  if (!session) return res.status(401).json({ error: "not_authenticated" });

  try {
    const status = await checkGithubStatus();
    return res.status(200).json({ ok: true, ...status });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      error: error.message || "server_error",
      details: error.details || undefined
    });
  }
};
