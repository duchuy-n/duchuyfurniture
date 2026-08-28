const { verifySession } = require("./_auth");
const { batchUpsertProducts, readStaticProducts } = require("./_firestore");

function sendError(res, error) {
  const status = error.statusCode || 500;
  return res.status(status).json({ error: error.message || "server_error" });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const session = verifySession(req);
  if (!session) return res.status(401).json({ error: "not_authenticated" });

  try {
    const products = readStaticProducts();
    const written = await batchUpsertProducts(products);
    return res.status(200).json({ ok: true, written });
  } catch (error) {
    return sendError(res, error);
  }
};
