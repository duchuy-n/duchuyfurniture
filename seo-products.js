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
    "/danh-muc/vach-ngan-van-phong/": { query: "vách ngăn", category: "khac" },
    "/danh-muc/tu-sat-van-phong/": { query: "tủ sắt", category: "tu" },
    "/danh-muc/tu-go-van-phong/": { query: "tủ gỗ", category: "tu" },
    "/danh-muc/ghe-xoay-van-phong/": { query: "ghế xoay", category: "ghe" },
    "/danh-muc/ghe-luoi-van-phong/": { query: "ghế lưới", category: "ghe" },
    "/danh-muc/ghe-hop-van-phong/": { query: "ghế họp", category: "ghe" },
    "/danh-muc/tu-ho-so-van-phong/": { query: "tủ hồ sơ", category: "tu" },
    "/danh-muc/ban-hoc-sinh/": { query: "bàn học sinh", category: "khac" },
    "/danh-muc/ban-cafe-van-phong/": { query: "bàn cafe", category: "ban" },
    "/danh-muc/gia-sat-van-phong/": { query: "giá sắt", fallback: false },
    "/danh-muc/tu-quan-ao/": { query: "tủ quần áo", aliases: ["tủ quần áo", "tủ để đồ", "locker"], category: "tu", fallback: false },
    "/danh-muc/ghe-chan-quy/": { query: "ghế chân quỳ", aliases: ["ghế chân quỳ", "chân quỳ", "ghế họp chân quỳ"] },
    "/danh-muc/san-pham-inox/": { query: "inox" },
    "/danh-muc/ban-an-hoa-phat/": { query: "bàn ăn" },
    "/danh-muc/noi-that-hoi-truong/": { query: "hội trường" },
    "/danh-muc/ban-vi-tinh/": { query: "bàn vi tính" },
    "/danh-muc/hoc-di-dong/": { query: "hộc di động" },
    "/danh-muc/ghe-gap-hoa-phat/": { query: "ghế gấp" },
    "/danh-muc/ghe-da-van-phong/": { query: "ghế da" },
    "/danh-muc/san-pham-ong-thep/": { query: "ống thép" },
    "/danh-muc/tu-lanh-dao/": { query: "tủ lãnh đạo" }
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
    const queries = Array.isArray(config.aliases) && config.aliases.length ? config.aliases.map(normalize) : [query];
    return categoryOk && queries.some((item) => item && text.includes(item));
  }

  function relevantProducts() {
    const products = window.recoveredProducts.filter(matchesConfig);
    const fallback = config.category
      ? window.recoveredProducts.filter((product) => product.published !== false && product.category === config.category)
      : [];
    const useFallback = config.fallback !== false;
    return (products.length || !useFallback ? products : fallback)
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