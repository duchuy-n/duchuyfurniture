const { verifySession } = require("./_auth");
const { slugify } = require("./_firestore");

const IMAGEKIT_UPLOAD_URL = "https://upload.imagekit.io/api/v1/files/upload";

function normalizeFolder(value) {
  const folder = String(value || "/duchuy-products").trim() || "/duchuy-products";
  return folder.startsWith("/") ? folder : `/${folder}`;
}

function imageKitConfig() {
  return {
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY || "",
    folder: normalizeFolder(process.env.IMAGEKIT_FOLDER)
  };
}

function imageKitConfigured(config = imageKitConfig()) {
  return Boolean(config.privateKey);
}

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

  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const safeName = slugify(fileName.replace(/\.[^.]+$/, ""));
  return {
    base64,
    contentType,
    fileName: `${Date.now()}-${safeName}.${ext}`
  };
}

async function uploadToImageKit(image, config) {
  const form = new FormData();
  form.append("file", image.base64);
  form.append("fileName", image.fileName);
  form.append("folder", config.folder);
  form.append("useUniqueFileName", "true");
  form.append("tags", "duchuy,product");

  const response = await fetch(IMAGEKIT_UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.privateKey}:`).toString("base64")}`
    },
    body: form
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const error = new Error(data?.message || "imagekit_upload_failed");
    error.statusCode = response.status;
    throw error;
  }

  return data;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const session = verifySession(req);
  if (!session) return res.status(401).json({ error: "not_authenticated" });

  const config = imageKitConfig();
  if (!imageKitConfigured(config)) return res.status(503).json({ error: "imagekit_not_configured" });

  try {
    const body = await parseBody(req);
    const image = parseImage(body);
    const uploaded = await uploadToImageKit(image, config);
    const imageUrl = uploaded.url || uploaded.thumbnailUrl;

    if (!imageUrl) {
      const error = new Error("imagekit_missing_url");
      error.statusCode = 502;
      throw error;
    }

    return res.status(200).json({
      ok: true,
      fileId: uploaded.fileId,
      filePath: uploaded.filePath,
      image: imageUrl
    });
  } catch (error) {
    const message = error.statusCode === 503 ? error.message : (error.message || "upload_failed");
    return res.status(error.statusCode || 500).json({ error: message });
  }
};
