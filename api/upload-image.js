const { verifySession } = require("./_auth");
const { safeImageFileName, uploadBase64Image } = require("./_imagekit");

function parseBody(req) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  if (typeof req.body === "string") return Promise.resolve(JSON.parse(req.body || "{}"));
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function parseImage(body) {
  const contentType = String(body.contentType || "");
  const fileName = String(body.fileName || "san-pham.jpg");
  const raw = String(body.data || "");
  const base64 = raw.includes(",") ? raw.split(",").pop() : raw;
  const buffer = Buffer.from(base64, "base64");

  if (!contentType.startsWith("image/")) {
    const error = new Error("invalid_image_type");
    error.statusCode = 400;
    throw error;
  }

  if (!buffer.length || buffer.length > 5 * 1024 * 1024) {
    const error = new Error("invalid_image_size");
    error.statusCode = 400;
    throw error;
  }

  return {
    base64,
    fileName: safeImageFileName(fileName)
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const session = verifySession(req);
  if (!session) return res.status(401).json({ error: "not_authenticated" });

  try {
    const body = await parseBody(req);
    const image = parseImage(body);
    const uploaded = await uploadBase64Image(image);

    return res.status(200).json({
      ok: true,
      fileId: uploaded.fileId,
      filePath: uploaded.filePath,
      image: uploaded.url || uploaded.thumbnailUrl
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || "upload_failed" });
  }
};
