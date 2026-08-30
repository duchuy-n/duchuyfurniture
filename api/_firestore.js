const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const FIRESTORE_SCOPE = "https://www.googleapis.com/auth/datastore";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
let cachedToken = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(response, attempt) {
  const retryAfter = Number(response.headers.get("retry-after") || 0);
  if (retryAfter > 0) return Math.min(retryAfter * 1000, 8000);
  return Math.min(8000, 500 * 2 ** attempt);
}

function shouldRetryFirestoreStatus(status) {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function firestoreConfig() {
  return {
    projectId: process.env.FIREBASE_PROJECT_ID || "",
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || "",
    privateKey: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY || "")
  };
}

function firestoreConfigured(config = firestoreConfig()) {
  return Boolean(config.projectId && config.clientEmail && config.privateKey);
}

function normalizePrivateKey(value) {
  let key = String(value || "").trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  key = key.replace(/\\n/g, "\n").replace(/\r\n/g, "\n");

  const begin = "-----BEGIN PRIVATE KEY-----";
  const end = "-----END PRIVATE KEY-----";
  if (key.includes(begin) && key.includes(end) && !key.includes("\n")) {
    const start = key.indexOf(begin) + begin.length;
    const finish = key.indexOf(end);
    const body = key.slice(start, finish).replace(/\s+/g, "");
    const lines = body.match(/.{1,64}/g) || [];
    key = `${begin}\n${lines.join("\n")}\n${end}\n`;
  }

  return key;
}

function assertValidPrivateKey(privateKey) {
  try {
    crypto.createPrivateKey(privateKey);
  } catch {
    const error = new Error("firebase_private_key_invalid");
    error.statusCode = 503;
    throw error;
  }
}

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

async function getAccessToken() {
  const config = firestoreConfig();
  if (!firestoreConfigured(config)) {
    const error = new Error("firestore_not_configured");
    error.statusCode = 503;
    throw error;
  }

  assertValidPrivateKey(config.privateKey);

  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt - 60 > now) return cachedToken.accessToken;

  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: config.clientEmail,
    scope: FIRESTORE_SCOPE,
    aud: TOKEN_URL,
    exp: now + 3600,
    iat: now
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;
  let signature;
  try {
    signature = crypto.createSign("RSA-SHA256").update(unsigned).sign(config.privateKey, "base64url");
  } catch {
    const error = new Error("firebase_private_key_invalid");
    error.statusCode = 503;
    throw error;
  }
  const assertion = `${unsigned}.${signature}`;

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });

  if (!response.ok) {
    const error = new Error("token_request_failed");
    error.statusCode = 502;
    throw error;
  }

  const data = await response.json();
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: now + Number(data.expires_in || 3600)
  };
  return cachedToken.accessToken;
}

function firestoreBaseUrl() {
  const { projectId } = firestoreConfig();
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents`;
}

async function firestoreFetch(url, options = {}) {
  const maxAttempts = Number(options.maxAttempts || 5);
  const fetchOptions = { ...options };
  delete fetchOptions.maxAttempts;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const token = await getAccessToken();
    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(fetchOptions.headers || {})
      }
    });

    if (response.ok) {
      if (response.status === 204) return null;
      return response.json();
    }

    if (shouldRetryFirestoreStatus(response.status) && attempt < maxAttempts - 1) {
      await sleep(retryDelayMs(response, attempt));
      continue;
    }

    const error = new Error(response.status === 429 ? "firestore_rate_limited" : `firestore_${response.status}`);
    error.statusCode = response.status;
    try {
      error.details = await response.json();
    } catch {
      error.details = null;
    }
    throw error;
  }

  const error = new Error("firestore_retry_failed");
  error.statusCode = 503;
  throw error;
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "san-pham";
}

function documentIdForProduct(product) {
  const id = String(product.id || product.code || product.title || Date.now()).trim();
  return slugify(id).slice(0, 120);
}

function detailPathForProduct(product) {
  if (product.detailPath) return product.detailPath;
  return `san-pham/${slugify([product.title, product.code, product.id].join("-"))}/`;
}

function normalizeProduct(input, existing = {}) {
  const product = { ...existing, ...(input || {}) };
  const id = String(product.id || product.code || `new-${Date.now()}`);
  const price = Number(product.price) || 0;
  const now = new Date().toISOString();
  return {
    id,
    title: String(product.title || "Sản phẩm nội thất").trim(),
    code: String(product.code || id).trim(),
    price,
    priceText: product.priceText || formatPrice(price),
    vatPrice: String(product.vatPrice || ""),
    size: String(product.size || "Liên hệ tư vấn kích thước"),
    warranty: String(product.warranty || "Sản phẩm bảo hành 12 tháng"),
    description: String(product.description || "Liên hệ Nội thất Đức Huy để được tư vấn chi tiết."),
    image: String(product.image || "assets/images/products/ban-giam-doc.jpg"),
    categoryPath: String(product.categoryPath || "san pham noi that"),
    category: String(product.category || "khac"),
    badge: String(product.badge || "Chính hãng"),
    sourceUrl: String(product.sourceUrl || ""),
    popularity: Number(product.popularity) || 0,
    published: product.published !== false,
    slug: product.slug || slugify([product.title, product.code].join("-")),
    detailPath: product.detailPath || detailPathForProduct(product),
    createdAt: product.createdAt || now,
    updatedAt: now
  };
}

function formatPrice(value) {
  if (!Number(value)) return "Liên hệ";
  return `${Number(value).toLocaleString("vi-VN")} VNĐ`;
}

function toValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    if (Number.isInteger(value)) return { integerValue: String(value) };
    return { doubleValue: value };
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toValue) } };
  if (typeof value === "object") return { mapValue: { fields: toFields(value) } };
  return { stringValue: String(value) };
}

function toFields(object) {
  return Object.fromEntries(Object.entries(object || {}).map(([key, value]) => [key, toValue(value)]));
}

function fromValue(value) {
  if (!value || Object.prototype.hasOwnProperty.call(value, "nullValue")) return null;
  if (Object.prototype.hasOwnProperty.call(value, "booleanValue")) return value.booleanValue;
  if (Object.prototype.hasOwnProperty.call(value, "integerValue")) return Number(value.integerValue);
  if (Object.prototype.hasOwnProperty.call(value, "doubleValue")) return Number(value.doubleValue);
  if (Object.prototype.hasOwnProperty.call(value, "stringValue")) return value.stringValue;
  if (Object.prototype.hasOwnProperty.call(value, "timestampValue")) return value.timestampValue;
  if (value.arrayValue) return (value.arrayValue.values || []).map(fromValue);
  if (value.mapValue) return fromFields(value.mapValue.fields || {});
  return null;
}

function fromFields(fields) {
  return Object.fromEntries(Object.entries(fields || {}).map(([key, value]) => [key, fromValue(value)]));
}

function productFromDocument(document) {
  const product = fromFields(document.fields || {});
  if (!product.id && document.name) product.id = document.name.split("/").pop();
  return product;
}

function sortProducts(products) {
  return [...products].sort((a, b) => Number(b.popularity || 0) - Number(a.popularity || 0));
}

async function listProducts() {
  const products = [];
  let pageToken = "";
  do {
    const url = new URL(`${firestoreBaseUrl()}/products`);
    url.searchParams.set("pageSize", "300");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const data = await firestoreFetch(url.toString());
    products.push(...(data.documents || []).map(productFromDocument).filter((product) => product.published !== false));
    pageToken = data.nextPageToken || "";
  } while (pageToken);
  return sortProducts(products);
}

async function upsertProduct(product) {
  const normalized = normalizeProduct(product);
  const documentId = documentIdForProduct(normalized);
  const url = `${firestoreBaseUrl()}/products/${encodeURIComponent(documentId)}`;
  await firestoreFetch(url, {
    method: "PATCH",
    body: JSON.stringify({ fields: toFields(normalized) })
  });
  return normalized;
}

async function hideProduct(id) {
  const url = `${firestoreBaseUrl()}/products/${encodeURIComponent(documentIdForProduct({ id }))}`;
  const data = await firestoreFetch(url);
  const product = normalizeProduct({ ...productFromDocument(data), published: false });
  await firestoreFetch(url, {
    method: "PATCH",
    body: JSON.stringify({ fields: toFields(product) })
  });
  return product;
}

async function batchUpsertProducts(products) {
  const chunks = [];
  for (let i = 0; i < products.length; i += 60) chunks.push(products.slice(i, i + 60));
  let written = 0;
  for (const chunk of chunks) {
    const writes = chunk.map((product) => {
      const normalized = normalizeProduct(product);
      return {
        update: {
          name: `${firestoreBaseUrl().replace("https://firestore.googleapis.com/v1/", "")}/products/${documentIdForProduct(normalized)}`,
          fields: toFields(normalized)
        }
      };
    });
    await firestoreFetch(`${firestoreBaseUrl().replace("/documents", "/documents:batchWrite")}`, {
      method: "POST",
      body: JSON.stringify({ writes })
    });
    written += chunk.length;
    if (chunks.length > 1) await sleep(250);
  }
  return written;
}

function readStaticProducts() {
  const productsPath = path.join(process.cwd(), "products.js");
  const text = fs.readFileSync(productsPath, "utf8");
  const match = text.match(/window\.recoveredProducts\s*=\s*(\[[\s\S]*\]);?\s*$/);
  if (!match) throw new Error("products_js_parse_failed");
  return JSON.parse(match[1]).map((product) => normalizeProduct(product));
}

module.exports = {
  batchUpsertProducts,
  firestoreConfigured,
  hideProduct,
  listProducts,
  normalizeProduct,
  readStaticProducts,
  getAccessToken,
  slugify,
  upsertProduct
};
