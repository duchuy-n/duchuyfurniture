const { getAccessToken } = require("./_firestore");

function storageBucket() {
  return process.env.FIREBASE_STORAGE_BUCKET || "";
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const bucket = storageBucket();
  const name = String(req.query?.name || "");
  if (!bucket) return res.status(503).json({ error: "storage_not_configured" });
  if (!name.startsWith("product-images/") || name.includes("..")) return res.status(400).json({ error: "invalid_image_name" });

  try {
    const token = await getAccessToken();
    const url = `https://storage.googleapis.com/download/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(name)}?alt=media`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) return res.status(response.status).json({ error: "image_not_found" });

    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader("Content-Type", response.headers.get("content-type") || "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.status(200).send(buffer);
  } catch (error) {
    return res.status(500).json({ error: error.message || "image_proxy_failed" });
  }
};
