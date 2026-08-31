const { readJson, verifySession, assertSameOrigin } = require("./_auth");
const { deleteProduct, hideProduct, listProducts, setProductPublished, upsertProduct } = require("./_catalog");

function sendError(res, error) {
  const status = error.statusCode || 500;
  return res.status(status).json({ error: error.message || "server_error" });
}

function queryValue(req, key) {
  if (req.query && Object.prototype.hasOwnProperty.call(req.query, key)) return req.query[key];
  try {
    return new URL(req.url || "", "http://localhost").searchParams.get(key);
  } catch {
    return undefined;
  }
}

function truthy(value) {
  return value === true || value === "1" || value === "true";
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const includeHidden = truthy(queryValue(req, "includeHidden"));
      if (includeHidden) {
        assertSameOrigin(req);
        const session = verifySession(req);
        if (!session) return res.status(401).json({ error: "not_authenticated" });
      }
      const products = listProducts({ includeHidden });
      return res.status(200).json({ ok: true, source: "static", products });
    }

    assertSameOrigin(req);
    const session = verifySession(req);
    if (!session) return res.status(401).json({ error: "not_authenticated" });

    if (req.method === "POST") {
      const body = await readJson(req);
      const product = await upsertProduct(body?.product || body || {});
      return res.status(200).json({ ok: true, product, deploy: "queued" });
    }

    if (req.method === "PATCH") {
      const body = await readJson(req);
      const id = body?.id || queryValue(req, "id");
      if (!id) return res.status(400).json({ error: "missing_product_id" });
      const product = await setProductPublished(String(id), body?.published !== false);
      return res.status(200).json({ ok: true, product, deploy: "queued" });
    }

    if (req.method === "DELETE") {
      const id = queryValue(req, "id");
      if (!id) return res.status(400).json({ error: "missing_product_id" });
      const hardDelete = truthy(queryValue(req, "hard"));
      const product = hardDelete ? await deleteProduct(decodeURIComponent(String(id))) : await hideProduct(decodeURIComponent(String(id)));
      return res.status(200).json({ ok: true, product, deleted: hardDelete, deploy: "queued" });
    }

    res.setHeader("Allow", "GET, POST, PATCH, DELETE");
    return res.status(405).json({ error: "method_not_allowed" });
  } catch (error) {
    return sendError(res, error);
  }
};
