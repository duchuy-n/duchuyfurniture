const { assertSameOrigin, verifySession } = require("./_auth");
const { safeImageFileName, uploadBase64Image } = require("./_imagekit");

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_BODY_BYTES = 7 * 1024 * 1024;

function parseBody(req) {
  const contentLength = Number(req.headers?.["content-length"] || 0);
  if (contentLength > MAX_BODY_BYTES) {
    const error = new Error("image_too_large");
    error.statusCode = 413;
    return Promise.reject(error);
  }

  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  if (typeof req.body === "string") return Promise.resolve(JSON.parse(req.body || "{}"));
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        const error = new Error("image_too_large");
        error.statusCode = 413;
        reject(error);
        req.destroy?.();
        return;
      }
      chunks.push(chunk);
    });
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

function detectedImageType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return "";
}

function parseImage(body) {
  const fileName = String(body.fileName || "san-pham.jpg");
  const raw = String(body.data || "");
  const base64 = raw.includes(",") ? raw.split(",").pop() : raw;
  if (!/^[a-z0-9+/=\s]+$/i.test(base64)) {
    const error = new Error("invalid_image_data");
    error.statusCode = 400;
    throw error;
  }
  const buffer = Buffer.from(base64, "base64");
  const type = detectedImageType(buffer);

  if (!type) {
    const error = new Error("invalid_image_type");
    error.statusCode = 400;
    throw error;
  }

  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
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

  try {
    assertSameOrigin(req);
  } catch (error) {
    return res.status(error.statusCode || 403).json({ error: error.message });
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