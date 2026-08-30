(() => {
  const PAGE_CONFIG = {
    "/thuong-hieu/hoa-phat/": { query: "hòa phát" },
    "/thuong-hieu/the-one/": { query: "the one" },
    "/thuong-hieu/noi-that-190/": { query: "190" },
    "/thuong-hieu/fami/": { query: "fami" },
    "/thuong-hieu/ck190/": { query: "ck190" },
    "/danh-muc/ban-ghe-van-phong-ha-noi/": { query: "bàn ghế văn phòng" },
    "/danh-muc/ban-lam-viec-hoa-phat/": { query: "bàn làm việc", category: "ban" },
    "/danh-muc/ghe-van-phong-hoa-phat/": { query: "ghế", category: "ghe" },
    "/danh-muc/tu-tai-lieu-hoa-phat/": { query: "tủ tài liệu", category: "tu" },
    "/danh-muc/ket-sat-hoa-phat/": { query: "két", category: "khac" },
    "/danh-muc/ban-hop-hoa-phat/": { query: "bàn họp", category: "ban" },
    "/danh-muc/ban-giam-doc-hoa-phat/": { query: "giám đốc", category: "ban" },
    "/danh-muc/noi-that-truong-hoc/": { query: "trường học", category: "khac" },
    "/danh-muc/vach-ngan-van-phong/": { query: "vách ngăn", category: "khac" }
  };

  const path = `${window.location.pathname.replace(/\/+$/, "")}/`;
  const config = PAGE_CONFIG[path];
  const grid = document.querySelector(".seo-product-grid");
  if (!config || !grid || !Array.isArray(window.recoveredProducts)) return;

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/đ/g, "d")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function compactText(value, maxLength = 155) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 3).replace(/\s+\S*$/, "")}...`;
  }

  function slugify(value) {
    return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "san-pham";
  }

  function productUrl(product) {
    if (product.detailPath) return `/${String(product.detailPath).replace(/^\/+/, "")}`;
    return `/san-pham/${slugify([product.title, product.code, product.id].filter(Boolean).join("-"))}/`;
  }

  function imageUrl(product) {
    const image = String(product.image || "assets/images/products/ban-giam-doc.jpg");
    if (/^https?:\/\//i.test(image)) return image;
    return `/${image.replace(/^\/+/, "")}`;
  }

  function searchable(product) {
    return normalize([product.title, product.code, product.description, product.categoryPath, product.badge, product.category].join(" "));
  }

  function matchesConfig(product) {
    if (product.published === false) return false;
    const query = normalize(config.query);
    const text = searchable(product);
    const categoryOk = !config.category || product.category === config.category;
    if (query === "ban ghe van phong") {
      return product.category === "ban" || product.category === "ghe" || text.includes("ban") || text.includes("ghe");
    }
    if (query === "the one") {
      return categoryOk && (text.includes("the one") || text.includes("hoa phat"));
    }
    return categoryOk && text.includes(query);
  }

  function relevantProducts() {
    const products = window.recoveredProducts.filter(matchesConfig);
    const fallback = config.category
      ? window.recoveredProducts.filter((product) => product.published !== false && product.category === config.category)
      : [];
    return (products.length ? products : fallback)
      .sort((a, b) => (Number(b.popularity) || 0) - (Number(a.popularity) || 0))
      .slice(0, 24);
  }

  function productCard(product) {
    const title = product.title || "Sản phẩm nội thất";
    const code = product.code || "Đang cập nhật";
    const price = product.priceText || "Liên hệ";
    const size = product.size || "Liên hệ tư vấn kích thước";
    const description = compactText(product.description || product.warranty || "Liên hệ để được tư vấn chi tiết.");
    const href = productUrl(product);
    return `<article class="seo-product-card"><a class="seo-product-image" href="${escapeHtml(href)}"><img src="${escapeHtml(imageUrl(product))}" alt="${escapeHtml(title)}" loading="lazy"></a><div><p class="seo-product-code">${escapeHtml(code)}</p><h2><a href="${escapeHtml(href)}">${escapeHtml(title)}</a></h2><strong>${escapeHtml(price)}</strong><span>${escapeHtml(size)}</span><p>${escapeHtml(description)}</p></div></article>`;
  }

  const products = relevantProducts();
  if (!products.length) return;
  grid.innerHTML = products.map(productCard).join("\n");
})();