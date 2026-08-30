const { readJson, verifySession } = require("./_auth");
const { listProducts, upsertProduct } = require("./_firestore");
const { safeImageFileName, uploadRemoteImage } = require("./_imagekit");

function isLegacyLocalImage(image) {
  const value = String(image || "").trim();
  if (!value) return false;
  if (/^(https?:)?\/\//i.test(value) || value.startsWith("data:")) return false;
  const clean = value.replace(/^\.\//, "").replace(/^\.\.\//, "");
  return clean.startsWith("assets/") || clean.startsWith("crawl-output/");
}

function requestOrigin(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  if (!host) {
    const error = new Error("missing_request_host");
    error.statusCode = 400;
    throw error;
  }
  const proto = req.headers["x-forwarded-proto"] || "https";
  return `${proto}://${host}`;
}

function publicImageUrl(origin, image) {
  const clean = String(image || "").trim().replace(/^\.\//, "").replace(/^\.\.\//, "");
  return new URL(clean, `${origin}/`).toString();
}

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
    const limit = Math.min(60, Math.max(5, Number(body.limit) || 30));
    const origin = requestOrigin(req);
    const products = await listProducts();
    const candidates = products.filter((product) => product.published !== false && isLegacyLocalImage(product.image));
    const selected = candidates.slice(0, limit);
    const migrated = [];
    const failed = [];

    for (const product of selected) {
      try {
        const sourceUrl = publicImageUrl(origin, product.image);
        const uploaded = await uploadRemoteImage({
          url: sourceUrl,
          fileName: safeImageFileName(product.code || product.title || product.id)
        });
        const updated = await upsertProduct({
          ...product,
          image: uploaded.url || uploaded.thumbnailUrl,
          imageSourceUrl: product.imageSourceUrl || sourceUrl,
          imageKitFileId: uploaded.fileId || "",
          imageKitFilePath: uploaded.filePath || ""
        });
        migrated.push({ id: updated.id, image: updated.image });
      } catch (error) {
        failed.push({ id: product.id, image: product.image, error: error.message || "image_migration_failed" });
      }
    }

    const remaining = Math.max(0, candidates.length - migrated.length - failed.length);
    return res.status(200).json({
      ok: true,
      totalLocal: candidates.length,
      attempted: selected.length,
      migrated: migrated.length,
      failed,
      remaining,
      done: remaining === 0
    });
  } catch (error) {
    return sendError(res, error);
  }
};
