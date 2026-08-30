const { slugify } = require("./_catalog");

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

function safeImageFileName(value, fallback = "san-pham") {
  const text = String(value || fallback).replace(/\.[^.]+$/, "");
  return `${Date.now()}-${slugify(text)}.jpg`;
}

async function uploadToImageKit(fields, config = imageKitConfig()) {
  if (!imageKitConfigured(config)) {
    const error = new Error("imagekit_not_configured");
    error.statusCode = 503;
    throw error;
  }

  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => form.append(key, value));
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

  if (!data?.url && !data?.thumbnailUrl) {
    const error = new Error("imagekit_missing_url");
    error.statusCode = 502;
    throw error;
  }

  return data;
}

function uploadBase64Image({ base64, fileName }, config) {
  return uploadToImageKit({ file: base64, fileName }, config);
}

function uploadRemoteImage({ url, fileName }, config) {
  return uploadToImageKit({ file: url, fileName }, config);
}

module.exports = {
  imageKitConfig,
  imageKitConfigured,
  safeImageFileName,
  uploadBase64Image,
  uploadRemoteImage
};
