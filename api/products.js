const { verifySession } = require("./_auth");
const { hideProduct, listProducts, readStaticProducts, upsertProduct } = require("./_firestore");

function sendError(res, error) {
  const status = error.statusCode || 500;
  return res.status(status).json({ error: error.message || "server_error" });
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      try {
        const products = await listProducts();
        return res.status(200).json({ ok: true, products });
      } catch (error) {
        if (error.statusCode === 429 || error.message === "firestore_rate_limited") {
          return res.status(200).json({ ok: true, fallback: true, reason: "firestore_rate_limited", products: readStaticProducts() });
        }
        throw error;
      }
    }

    const session = verifySession(req);
    if (!session) return res.status(401).json({ error: "not_authenticated" });

    if (req.method === "POST") {
      const product = await upsertProduct(req.body?.product || req.body || {});
      return res.status(200).json({ ok: true, product });
    }

    if (req.method === "DELETE") {
      const id = req.query?.id || req.url?.split("id=")[1];
      if (!id) return res.status(400).json({ error: "missing_product_id" });
      const product = await hideProduct(decodeURIComponent(String(id)));
      return res.status(200).json({ ok: true, product });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "method_not_allowed" });
  } catch (error) {
    return sendError(res, error);
  }
};
