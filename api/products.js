const { readJson, verifySession } = require("./_auth");
const { hideProduct, listProducts, upsertProduct } = require("./_catalog");

function sendError(res, error) {
  const status = error.statusCode || 500;
  return res.status(status).json({ error: error.message || "server_error", details: error.details || undefined });
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const products = listProducts();
      return res.status(200).json({ ok: true, source: "static", products });
    }

    const session = verifySession(req);
    if (!session) return res.status(401).json({ error: "not_authenticated" });

    if (req.method === "POST") {
      const body = await readJson(req);
      const product = await upsertProduct(body?.product || body || {});
      return res.status(200).json({ ok: true, product, deploy: "queued" });
    }

    if (req.method === "DELETE") {
      const id = req.query?.id || req.url?.split("id=")[1];
      if (!id) return res.status(400).json({ error: "missing_product_id" });
      const product = await hideProduct(decodeURIComponent(String(id)));
      return res.status(200).json({ ok: true, product, deploy: "queued" });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "method_not_allowed" });
  } catch (error) {
    return sendError(res, error);
  }
};
