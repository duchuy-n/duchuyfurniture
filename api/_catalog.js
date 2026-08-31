const fs = require("fs");
const path = require("path");

const PRODUCTS_FILE = "products.js";
const SITEMAP_FILE = "sitemap.xml";
const DEFAULT_IMAGE = "assets/images/products/ban-giam-doc.jpg";
const SITE_URL = (process.env.SITE_URL || "https://duchuyfurniture.vercel.app").replace(/\/+$/, "");

function formatPrice(value) {
  if (!Number(value)) return "Liên hệ";
  return `${Number(value).toLocaleString("vi-VN")} VNĐ`;
}

function formatVatPrice(value) {
  const price = Number(value) || 0;
  if (!price) return "";
  return `${Math.round(price * 1.1).toLocaleString("vi-VN")} VNĐ (Đã bao gồm VAT)`;
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

function normalizeDetailPath(value) {
  const clean = String(value || "").replace(/^\/+/, "").replace(/index\.html$/i, "").replace(/\/+$/, "");
  return clean ? `${clean}/` : "";
}

function detailPathForProduct(product) {
  if (product.detailPath) return normalizeDetailPath(product.detailPath);
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
    priceText: formatPrice(price),
    vatPrice: formatVatPrice(price),
    size: String(product.size || "Liên hệ tư vấn kích thước"),
    warranty: String(product.warranty || "Sản phẩm bảo hành 12 tháng"),
    description: String(product.description || "Liên hệ Nội thất Đức Huy để được tư vấn chi tiết."),
    image: String(product.image || DEFAULT_IMAGE).replace(/^\/+/, ""),
    categoryPath: String(product.categoryPath || "san pham noi that"),
    category: String(product.category || "khac"),
    badge: String(product.badge || "Chính hãng"),
    sourceUrl: String(product.sourceUrl || ""),
    popularity: Number(product.popularity) || 0,
    published: product.published !== false,
    slug: product.slug || slugify([product.title, product.code].join("-")),
    detailPath: detailPathForProduct(product),
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

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function compactText(value, maxLength = 180) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).replace(/\s+\S*$/, "")}...`;
}

function cleanRelativePath(value) {
  return String(value || "").replace(/^\/+/, "");
}

function siteUrlFor(value = "") {
  const clean = cleanRelativePath(value);
  return clean ? `${SITE_URL}/${clean}` : `${SITE_URL}/`;
}

function imagePathForHtml(product) {
  const image = String(product.image || DEFAULT_IMAGE);
  if (/^https?:\/\//i.test(image)) return image;
  return `/${cleanRelativePath(image)}`;
}

function imageUrlForMeta(product) {
  const image = String(product.image || DEFAULT_IMAGE);
  if (/^https?:\/\//i.test(image)) return image;
  return siteUrlFor(image);
}

function productCategoryLabel(product) {
  if (product.category === "ban") return "Bàn văn phòng";
  if (product.category === "ghe") return "Ghế văn phòng";
  if (product.category === "tu") return "Tủ tài liệu";
  const pathLabel = String(product.categoryPath || "").split(/[>\/]/).map((item) => item.trim()).filter(Boolean).pop();
  return product.badge || pathLabel || "Sản phẩm nội thất";
}

function productDescription(product) {
  return compactText([
    `${product.title} mã ${product.code}, giá ${product.priceText}.`,
    product.size ? `Kích thước ${product.size}.` : "",
    product.warranty || "",
    product.description || ""
  ].filter(Boolean).join(" "), 170);
}

function jsonLdScript(data) {
  return JSON.stringify(data, null, 2).replace(/</g, "\\u003c");
}

function relatedProductsFor(product, products) {
  return sortProducts(products)
    .filter((item) => item.published !== false && String(item.id) !== String(product.id))
    .filter((item) => item.category === product.category || item.badge === product.badge)
    .slice(0, 6);
}

function relatedProductCard(product) {
  const href = `/${detailPathForProduct(product)}`;
  return `<article class="seo-product-card"><a class="seo-product-image" href="${escapeHtml(href)}"><img src="${escapeHtml(imagePathForHtml(product))}" alt="${escapeHtml(product.title)}" loading="lazy"></a><div><p class="seo-product-code">${escapeHtml(product.code)}</p><h2><a href="${escapeHtml(href)}">${escapeHtml(product.title)}</a></h2><strong>${escapeHtml(product.priceText || formatPrice(product.price))}</strong><span>${escapeHtml(product.size || "Liên hệ tư vấn kích thước")}</span><p>${escapeHtml(compactText(product.description || product.warranty || "Liên hệ để được tư vấn chi tiết.", 155))}</p></div></article>`;
}

function renderProductDetailHtml(product, products = []) {
  const detailPath = detailPathForProduct(product);
  const canonicalUrl = siteUrlFor(detailPath);
  const categoryLabel = productCategoryLabel(product);
  const description = productDescription(product);
  const related = relatedProductsFor(product, products);
  const relatedMarkup = related.length
    ? related.map(relatedProductCard).join("\n          ")
    : `<p>Liên hệ Đức Huy để được tư vấn thêm các mẫu cùng nhóm.</p>`;
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        "@id": `${canonicalUrl}#product`,
        name: product.title,
        image: [imageUrlForMeta(product)],
        description,
        sku: product.code,
        category: categoryLabel,
        brand: {
          "@type": "Brand",
          name: "Hòa Phát The One"
        },
        offers: {
          "@type": "Offer",
          priceCurrency: "VND",
          availability: "https://schema.org/InStock",
          url: canonicalUrl,
          price: Number(product.price) || 0
        }
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Trang chủ", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: categoryLabel, item: `${SITE_URL}/#products` },
          { "@type": "ListItem", position: 3, name: product.title, item: canonicalUrl }
        ]
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: `${product.title} có sẵn giá chưa?`,
            acceptedAnswer: {
              "@type": "Answer",
              text: `Sản phẩm đang hiển thị giá ${product.priceText}. Khách nên liên hệ Đức Huy để xác nhận tồn kho, VAT và phí giao lắp tại thời điểm mua.`
            }
          },
          {
            "@type": "Question",
            name: `Làm sao để mua ${product.code}?`,
            acceptedAnswer: {
              "@type": "Answer",
              text: `Khách có thể gọi hotline 0912 425 222, gửi mã ${product.code} và số lượng cần mua để được tư vấn báo giá nhanh.`
            }
          }
        ]
      }
    ]
  };

  return `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(product.title)} | Giá ${escapeHtml(product.priceText)} | Nội thất Đức Huy</title>
    <meta name="description" content="${escapeHtml(description)}">
    <meta property="og:title" content="${escapeHtml(product.title)} | Giá ${escapeHtml(product.priceText)} | Nội thất Đức Huy">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:image" content="${escapeHtml(imageUrlForMeta(product))}">
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Nội thất Đức Huy">
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
    <link rel="icon" href="/assets/images/logo-theone.jpg">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/styles.css">
    <script type="application/ld+json">${jsonLdScript(structuredData)}</script>
  </head>
  <body class="seo-body">
    <header class="seo-header">
      <a class="brand" href="/" aria-label="Nội thất Đức Huy"><img src="/assets/images/logo-theone.jpg" alt="Logo The One"><span><strong>Nội thất Đức Huy</strong><small>Hòa Phát The One chính hãng</small></span></a>
      <nav aria-label="Điều hướng trang"><a href="/">Trang chủ</a><a href="/thuong-hieu/hoa-phat/">Thương hiệu</a><a href="/#products">Sản phẩm</a><a href="/bai-viet/cach-chon-ban-ghe-van-phong-hoa-phat/">Tư vấn</a><a href="/#contact">Liên hệ</a></nav>
    </header>
    <main>
      <section class="product-detail-hero"><div class="container product-detail-grid"><div class="product-detail-media"><img src="${escapeHtml(imagePathForHtml(product))}" alt="${escapeHtml(product.title)}"></div><div class="product-detail-info"><p class="eyebrow">${escapeHtml(categoryLabel)}</p><h1>${escapeHtml(product.title)}</h1><p class="product-detail-code">Mã hàng: <strong>${escapeHtml(product.code)}</strong></p><strong class="product-detail-price">${escapeHtml(product.priceText)}</strong>${product.vatPrice ? `<p class="product-detail-vat">${escapeHtml(product.vatPrice)}</p>` : ""}<dl class="product-detail-specs"><div><dt>Kích thước</dt><dd>${escapeHtml(product.size || "Liên hệ tư vấn kích thước")}</dd></div><div><dt>Bảo hành</dt><dd>${escapeHtml(product.warranty || "Sản phẩm bảo hành 12 tháng")}</dd></div><div><dt>Vận chuyển</dt><dd>Liên hệ để được tư vấn giao lắp tại Hà Nội và khu vực lân cận.</dd></div></dl><div class="hero-actions"><a class="btn primary" href="tel:0912425222">Gọi báo giá</a><a class="btn secondary" href="mailto:noithatduchuy@gmail.com?subject=Hỏi báo giá ${encodeURIComponent(product.code)}">Gửi mã qua email</a></div></div></div></section>
      <section class="section seo-content"><div class="container seo-two-col"><article><p class="eyebrow">Thông tin sản phẩm</p><h2>${escapeHtml(product.title)} có gì cần chú ý?</h2><p>${escapeHtml(product.description || "Liên hệ Nội thất Đức Huy để được tư vấn chi tiết.")}</p><p>Khi đặt hàng, khách nên cung cấp mã <strong>${escapeHtml(product.code)}</strong>, số lượng, địa chỉ giao và thời gian cần nhận để Đức Huy kiểm tra tồn kho, báo giá và phương án vận chuyển.</p></article><aside><p class="eyebrow">Tư vấn mua hàng</p><h2>Liên hệ Đức Huy</h2><p>Hotline: <a href="tel:0912425222">0912 425 222</a></p><p>Email: <a href="mailto:noithatduchuy@gmail.com">noithatduchuy@gmail.com</a></p><a class="btn outline" href="/">Về catalog chính</a></aside></div></section>
      <section class="section seo-products"><div class="container"><div class="section-heading"><div><p class="eyebrow">Sản phẩm liên quan</p><h2>Các mẫu cùng nhóm</h2></div><a class="btn outline" href="/?search=${encodeURIComponent(categoryLabel)}#products">Xem thêm</a></div><div class="seo-product-grid related-product-grid">
          ${relatedMarkup}
        </div></div></section>
    </main>
    <div class="floating-cta" aria-label="Liên hệ nhanh"><a href="tel:0912425222">Gọi 0912 425 222</a><a href="https://zalo.me/0912425222" target="_blank" rel="noopener">Zalo</a><a href="mailto:noithatduchuy@gmail.com">Báo giá</a></div>
  </body>
</html>
`;
}

function detailFileForProduct(product, products) {
  return {
    path: `${detailPathForProduct(product)}index.html`,
    content: renderProductDetailHtml(product, products)
  };
}

function sitemapUrlBlock(url, { lastmod = new Date().toISOString().slice(0, 10), changefreq = "weekly", priority = "0.7" } = {}) {
  return `  <url>
    <loc>${escapeHtml(url)}</loc>
    <lastmod>${escapeHtml(lastmod)}</lastmod>
    <changefreq>${escapeHtml(changefreq)}</changefreq>
    <priority>${escapeHtml(priority)}</priority>
  </url>`;
}

function readStaticSitemapBlocks() {
  const sitemapPath = path.join(process.cwd(), SITEMAP_FILE);
  if (!fs.existsSync(sitemapPath)) {
    return [sitemapUrlBlock(`${SITE_URL}/`, { changefreq: "daily", priority: "1.0" })];
  }
  const current = fs.readFileSync(sitemapPath, "utf8");
  return Array.from(current.matchAll(/<url>[\s\S]*?<\/url>/g))
    .map((match) => match[0])
    .filter((block) => !block.includes(`${SITE_URL}/san-pham/`));
}

function renderSitemapXml(products) {
  const staticBlocks = readStaticSitemapBlocks();
  const productBlocks = sortProducts(products)
    .filter((product) => product.published !== false)
    .map((product) => sitemapUrlBlock(siteUrlFor(detailPathForProduct(product)), {
      lastmod: String(product.updatedAt || product.createdAt || new Date().toISOString()).slice(0, 10),
      changefreq: "weekly",
      priority: "0.8"
    }));
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticBlocks, ...productBlocks].join("\n")}
</urlset>
`;
}

function sitemapFileForProducts(products) {
  return {
    path: SITEMAP_FILE,
    content: renderSitemapXml(products)
  };
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

async function commitFilesToGithub(files, message) {
  const config = githubConfig();
  const base = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}`;
  const ref = await githubRequest(`${base}/git/ref/heads/${encodeURIComponent(config.branch)}`);
  const baseSha = ref.object?.sha;
  if (!baseSha) {
    const error = new Error("github_branch_not_found");
    error.statusCode = 502;
    throw error;
  }

  const baseCommit = await githubRequest(`${base}/git/commits/${encodeURIComponent(baseSha)}`);
  const treeEntries = [];

  for (const file of files) {
    if (file.delete) {
      treeEntries.push({
        path: cleanRelativePath(file.path),
        mode: "100644",
        type: "blob",
        sha: null
      });
      continue;
    }

    const blob = await githubRequest(`${base}/git/blobs`, {
      method: "POST",
      body: JSON.stringify({ content: file.content, encoding: "utf-8" })
    });
    treeEntries.push({
      path: cleanRelativePath(file.path),
      mode: "100644",
      type: "blob",
      sha: blob.sha
    });
  }

  const tree = await githubRequest(`${base}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: treeEntries })
  });
  const commit = await githubRequest(`${base}/git/commits`, {
    method: "POST",
    body: JSON.stringify({ message, tree: tree.sha, parents: [baseSha] })
  });
  await githubRequest(`${base}/git/refs/heads/${encodeURIComponent(config.branch)}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha })
  });
  return commit;
}

async function updateGithubCatalog(mutator, message) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const file = await readGithubProductsFile();
    const mutation = await mutator(file.products);
    const nextProducts = Array.isArray(mutation) ? mutation : mutation.products;
    const extraFiles = Array.isArray(mutation?.extraFiles) ? mutation.extraFiles : [];
    const files = [
      { path: PRODUCTS_FILE, content: serializeProductsJs(sortProducts(nextProducts)) },
      ...extraFiles
    ];

    try {
      const commit = await commitFilesToGithub(files, message);
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
  let savedProduct = null;
  const result = await updateGithubCatalog((products) => {
    const index = products.findIndex((item) => String(item.id) === String(product.id));
    const maxPopularity = products.reduce((max, item) => Math.max(max, Number(item.popularity) || 0), 0);
    const existing = index >= 0 ? products[index] : { popularity: maxPopularity + 1 };
    const normalized = normalizeProduct(product, existing);
    const next = [...products];
    if (index >= 0) next[index] = normalized;
    else next.unshift(normalized);
    savedProduct = normalized;
    return {
      products: next,
      extraFiles: [detailFileForProduct(normalized, next), sitemapFileForProducts(next)]
    };
  }, `Update product: ${title}`);
  return result.products.find((item) => String(item.id) === String(savedProduct?.id)) || savedProduct || normalizeProduct(product);
}

async function hideProduct(id) {
  return setProductPublished(id, false);
}

async function setProductPublished(id, published) {
  let changedProduct = null;
  await updateGithubCatalog((products) => {
    const next = products.map((product) => {
      if (String(product.id) !== String(id)) return product;
      changedProduct = normalizeProduct({ ...product, published }, product);
      return changedProduct;
    });
    if (!changedProduct) {
      const error = new Error("product_not_found");
      error.statusCode = 404;
      throw error;
    }
    const extraFiles = published
      ? [detailFileForProduct(changedProduct, next), sitemapFileForProducts(next)]
      : [
          { path: `${detailPathForProduct(changedProduct)}index.html`, delete: true },
          sitemapFileForProducts(next)
        ];
    return { products: next, extraFiles };
  }, `${published ? "Restore" : "Hide"} product: ${id}`);
  return changedProduct;
}

async function deleteProduct(id) {
  let deletedProduct = null;
  await updateGithubCatalog((products) => {
    const next = products.filter((product) => {
      if (String(product.id) !== String(id)) return true;
      deletedProduct = product;
      return false;
    });
    if (!deletedProduct) {
      const error = new Error("product_not_found");
      error.statusCode = 404;
      throw error;
    }
    return {
      products: next,
      extraFiles: [
        { path: `${detailPathForProduct(deletedProduct)}index.html`, delete: true },
        sitemapFileForProducts(next)
      ]
    };
  }, `Delete product: ${id}`);
  return deletedProduct;
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
  detailFileForProduct,
  renderSitemapXml,
  detailPathForProduct,
  formatPrice,
  formatVatPrice,
  githubConfigured,
  deleteProduct,
  hideProduct,
  listProducts: readStaticProducts,
  normalizeProduct,
  parseProductsJs,
  readStaticProducts,
  renderProductDetailHtml,
  serializeProductsJs,
  setProductPublished,
  slugify,
  upsertProduct
};
