const fs = require("fs");
const path = require("path");

const PRODUCTS_FILE = "products.js";

function formatPrice(value) {
  if (!Number(value)) return "Liên hệ";
  return `${Number(value).toLocaleString("vi-VN")} VNĐ`;
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

function sortProducts(products) {
  return [...products].sort((a, b) => Number(b.popularity || 0) - Number(a.popularity || 0));
}

function parseProductsJs(text) {
  const match = String(text || "").match(/window\.recoveredProducts\s*=\s*(\[[\s\S]*\]);?\s*$/);
  if (!match) throw new Error("products_js_parse_failed");
  return JSON.parse(match[1]);
}

function serializeProductsJs(products) {
  return `window.recoveredProducts = ${JSON.stringify(products, null, 2)};\n`;
}

function readStaticProducts({ includeHidden = false } = {}) {
  const productsPath = path.join(process.cwd(), PRODUCTS_FILE);
  const products = parseProductsJs(fs.readFileSync(productsPath, "utf8"));
  return sortProducts(includeHidden ? products : products.filter((product) => product.published !== false));
}

function githubConfig() {
  return {
    token: process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "",
    owner: process.env.GITHUB_OWNER || "duchuy-n",
    repo: process.env.GITHUB_REPO || "duchuyfurniture",
    branch: process.env.GITHUB_BRANCH || "main"
  };
}

function githubConfigured(config = githubConfig()) {
  return Boolean(config.token && config.owner && config.repo && config.branch);
}

function githubHeaders(config = githubConfig()) {
  return {
    Authorization: `Bearer ${config.token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "duchuyfurniture-admin"
  };
}

async function githubRequest(url, options = {}) {
  const config = githubConfig();
  if (!githubConfigured(config)) {
    const error = new Error("github_not_configured");
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(url, {
    ...options,
    headers: { ...githubHeaders(config), ...(options.headers || {}) }
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const error = new Error(response.status === 409 ? "github_conflict" : `github_${response.status}`);
    error.statusCode = response.status === 409 ? 409 : 502;
    error.details = data;
    throw error;
  }

  return data;
}

async function fetchGithubRawFile(downloadUrl) {
  const config = githubConfig();
  const response = await fetch(downloadUrl, {
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/vnd.github.raw",
      "User-Agent": "duchuyfurniture-admin"
    }
  });

  if (!response.ok) {
    const error = new Error(`github_raw_${response.status}`);
    error.statusCode = 502;
    throw error;
  }

  return response.text();
}

async function readGithubProductsFile() {
  const config = githubConfig();
  const url = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${PRODUCTS_FILE}?ref=${encodeURIComponent(config.branch)}`;
  const data = await githubRequest(url);
  let content = "";

  if (data.encoding === "base64" && data.content) {
    content = Buffer.from(String(data.content).replace(/\s/g, ""), "base64").toString("utf8");
  } else if (data.download_url) {
    content = await fetchGithubRawFile(data.download_url);
  }

  if (!content) {
    const error = new Error("github_products_empty");
    error.statusCode = 502;
    error.details = { encoding: data.encoding || "", size: data.size || 0, hasDownloadUrl: Boolean(data.download_url) };
    throw error;
  }

  try {
    return { sha: data.sha, content, products: parseProductsJs(content) };
  } catch (error) {
    error.details = { encoding: data.encoding || "", size: data.size || 0, contentStart: content.slice(0, 40) };
    throw error;
  }
}

async function commitProductsToGithub(products, message, sha) {
  const config = githubConfig();
  const url = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${PRODUCTS_FILE}`;
  const content = serializeProductsJs(sortProducts(products));
  const body = {
    message,
    content: Buffer.from(content, "utf8").toString("base64"),
    branch: config.branch,
    sha
  };
  const data = await githubRequest(url, { method: "PUT", body: JSON.stringify(body) });
  return data.commit;
}

async function updateGithubCatalog(mutator, message) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const file = await readGithubProductsFile();
    const nextProducts = await mutator(file.products);
    try {
      const commit = await commitProductsToGithub(nextProducts, message, file.sha);
      return { products: sortProducts(nextProducts).filter((product) => product.published !== false), commit };
    } catch (error) {
      if (error.message === "github_conflict" && attempt === 0) continue;
      throw error;
    }
  }
  const error = new Error("github_conflict");
  error.statusCode = 409;
  throw error;
}

async function upsertProduct(product) {
  const title = String(product?.title || "Sản phẩm nội thất").trim();
  const result = await updateGithubCatalog((products) => {
    const index = products.findIndex((item) => String(item.id) === String(product.id));
    const maxPopularity = products.reduce((max, item) => Math.max(max, Number(item.popularity) || 0), 0);
    const existing = index >= 0 ? products[index] : { popularity: maxPopularity + 1 };
    const normalized = normalizeProduct(product, existing);
    const next = [...products];
    if (index >= 0) next[index] = normalized;
    else next.unshift(normalized);
    return next;
  }, `Update product: ${title}`);
  return result.products.find((item) => String(item.id) === String(product.id)) || normalizeProduct(product);
}

async function hideProduct(id) {
  let hiddenProduct = null;
  await updateGithubCatalog((products) => {
    const next = products.map((product) => {
      if (String(product.id) !== String(id)) return product;
      hiddenProduct = normalizeProduct({ ...product, published: false }, product);
      return hiddenProduct;
    });
    if (!hiddenProduct) {
      const error = new Error("product_not_found");
      error.statusCode = 404;
      throw error;
    }
    return next;
  }, `Hide product: ${id}`);
  return hiddenProduct;
}

async function checkGithubStatus() {
  const config = githubConfig();
  const configured = githubConfigured(config);
  const tokenLooksFineGrained = config.token.startsWith("github_pat_");
  const result = {
    configured,
    tokenLooksFineGrained,
    owner: config.owner,
    repo: config.repo,
    branch: config.branch,
    canReadProductsFile: false,
    productCount: 0
  };

  if (!configured) return result;

  try {
    const file = await readGithubProductsFile();
    result.canReadProductsFile = true;
    result.productCount = file.products.length;
    return result;
  } catch (error) {
    error.details = {
      ...(error.details || {}),
      configured,
      tokenLooksFineGrained,
      owner: config.owner,
      repo: config.repo,
      branch: config.branch
    };
    throw error;
  }
}
module.exports = {
  checkGithubStatus,
  githubConfigured,
  hideProduct,
  listProducts: readStaticProducts,
  normalizeProduct,
  parseProductsJs,
  readStaticProducts,
  serializeProductsJs,
  slugify,
  upsertProduct
};
