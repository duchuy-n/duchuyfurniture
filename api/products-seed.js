const { readJson, verifySession } = require("./_auth");
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
    const body = req.body === undefined ? {} : await readJson(req);
    const allProducts = readStaticProducts();
    const offset = Math.max(0, Number(body.offset) || 0);
    const limit = Math.min(30, Math.max(5, Number(body.limit) || 20));
    const chunk = allProducts.slice(offset, offset + limit);
    const written = chunk.length ? await batchUpsertProducts(chunk) : 0;
    const nextOffset = offset + written;

    return res.status(200).json({
      ok: true,
      written,
      total: allProducts.length,
      nextOffset: nextOffset < allProducts.length ? nextOffset : null,
      done: nextOffset >= allProducts.length
    });
  } catch (error) {
    return sendError(res, error);
  }
};
