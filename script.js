const slides = Array.from(document.querySelectorAll(".hero-slide"));
let slideIndex = 0;

function showSlide(nextIndex) {
  if (!slides.length) return;
  slides[slideIndex].classList.remove("active");
  slideIndex = nextIndex % slides.length;
  slides[slideIndex].classList.add("active");
}

if (slides.length > 1) {
  setInterval(() => showSlide(slideIndex + 1), 5000);
}

const navToggle = document.querySelector(".nav-toggle");
const navLinks = document.querySelector(".nav-links");

function closeNavMenu() {
  navLinks?.classList.remove("open");
  navToggle?.setAttribute("aria-expanded", "false");
}

navToggle?.addEventListener("click", () => {
  const isOpen = navLinks.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

navLinks?.addEventListener("click", (event) => {
  if (event.target.matches("a")) {
    closeNavMenu();
  }
});

document.addEventListener("click", (event) => {
  if (!navLinks?.classList.contains("open")) return;
  const target = event.target;
  if (target instanceof Element && (navLinks.contains(target) || navToggle?.contains(target))) return;
  closeNavMenu();
});

const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0
});

function formatPrice(value, fallback = "Liên hệ") {
  return Number(value) > 0 ? money.format(Number(value)) : fallback;
}

function normalizeText(value) {
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

function compactText(value, maxLength = 185) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).replace(/\s+\S*$/, "")}...`;
}

const productGrid = document.querySelector("#productGrid");
const recoveredProducts = Array.isArray(window.recoveredProducts) ? window.recoveredProducts : [];
const tabs = Array.from(document.querySelectorAll(".category-tab"));
const search = document.querySelector("#productSearch");
const sort = document.querySelector("#productSort");
const productCount = document.querySelector("#productCount");
const productNote = document.querySelector("#productNote");
const emptyProducts = document.querySelector("#emptyProducts");
const loadMoreProducts = document.querySelector("#loadMoreProducts");
const catalogMenu = document.querySelector("#catalogMenu");
const PAGE_SIZE = 24;
let activeFilter = "all";
let activeMenuQuery = "";
let visibleLimit = PAGE_SIZE;
let matchingProducts = [];

const catalogShortcuts = [
  { label: "Tất cả sản phẩm", filter: "all", query: "" },
  { label: "Bàn làm việc", filter: "ban", query: "bàn làm việc" },
  { label: "Bàn họp văn phòng", filter: "ban", query: "bàn họp" },
  { label: "Bàn giám đốc", filter: "ban", query: "giám đốc" },
  { label: "Ghế văn phòng", filter: "ghe", query: "ghế" },
  { label: "Tủ tài liệu", filter: "tu", query: "tủ tài liệu" },
  { label: "Tủ sắt văn phòng", filter: "tu", query: "tủ sắt" },
  { label: "Két bạc an toàn", filter: "khac", query: "két" },
  { label: "Nội thất trường học", filter: "khac", query: "trường học" },
  { label: "Giá sách, kệ file", filter: "tu", query: "giá" },
  { label: "Vách ngăn văn phòng", filter: "khac", query: "vách ngăn" },
  { label: "Sản phẩm ống thép", filter: "khac", query: "ống thép" }
];

function searchableProduct(product) {
  return normalizeText([
    product.title,
    product.code,
    product.priceText,
    product.size,
    product.description,
    product.categoryPath,
    product.badge
  ].join(" "));
}

function productCardMarkup(product, index) {
  const title = product.title || "Sản phẩm nội thất";
  const code = product.code || "Đang cập nhật";
  const priceText = product.priceText || formatPrice(product.price);
  const size = product.size || "Liên hệ tư vấn kích thước";
  const description = compactText(product.description || product.warranty || "Liên hệ để được tư vấn chi tiết.");
  const categoryPath = product.categoryPath || "Sản phẩm Hòa Phát";
  const image = product.image || "assets/images/products/ban-giam-doc.jpg";
  const badge = product.badge || "Chính hãng";
  const category = product.category || "khac";

  return `
    <article class="product-card" data-category="${escapeHtml(category)}" data-name="${escapeHtml(title)}" data-title="${escapeHtml(title)}" data-description="${escapeHtml(description)}" data-price="${Number(product.price) || 0}" data-code="${escapeHtml(code)}" data-spec="${escapeHtml(size)}" data-badge="${escapeHtml(badge)}" data-popularity="${product.popularity || index}" data-vat="${escapeHtml(product.vatPrice || "")}" data-warranty="${escapeHtml(product.warranty || "")}" data-source="${escapeHtml(product.sourceUrl || "")}" tabindex="0">
      <div class="product-card-media">
        <img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" loading="lazy">
        <span class="product-badge">${escapeHtml(badge)}</span>
        <div class="product-hover">
          <strong>${escapeHtml(priceText)}</strong>
          <span>${escapeHtml(code)} · ${escapeHtml(size)}</span>
          <div class="product-actions">
            <a href="tel:0912425222">Gọi báo giá</a>
            <button type="button" data-quick-view>Xem nhanh</button>
          </div>
        </div>
      </div>
      <div class="product-price-row">
        <span class="product-price">${escapeHtml(priceText)}</span>
        <span class="product-code">${escapeHtml(code)}</span>
      </div>
      <h3>${escapeHtml(title)}</h3>
      <div class="product-spec-line">${escapeHtml(size)}</div>
      <p>${escapeHtml(description)}</p>
      <span class="product-category-path">${escapeHtml(categoryPath)}</span>
    </article>
  `;
}

function countShortcutProducts(shortcut) {
  const query = normalizeText(shortcut.query || "");
  return recoveredProducts.filter((product) => {
    const categoryMatches = shortcut.filter === "all" || product.category === shortcut.filter;
    return categoryMatches && (!query || searchableProduct(product).includes(query));
  }).length;
}

function buildCatalogMenu() {
  if (!catalogMenu) return;
  const shortcutsWithCounts = catalogShortcuts
    .map((item) => ({ ...item, count: countShortcutProducts(item) }))
    .filter((item) => item.filter === "all" || item.count > 0);

  catalogMenu.innerHTML = `
    <h3>Danh mục SP Hòa Phát</h3>
    ${shortcutsWithCounts.map((item) => `<button type="button" data-menu-filter="${escapeHtml(item.filter)}" data-menu-query="${escapeHtml(item.query)}"><span>${escapeHtml(item.label)}</span><small>${item.count}</small></button>`).join("")}
  `;

  catalogMenu.querySelectorAll("button[data-menu-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.menuFilter || "all";
      activeMenuQuery = button.dataset.menuQuery || "";
      if (search) search.value = activeMenuQuery;
      tabs.forEach((tab) => tab.classList.toggle("active", (tab.dataset.filter || "all") === activeFilter));
      catalogMenu.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
      renderCatalog(true);
      document.querySelector("#products")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  catalogMenu.querySelector("button")?.classList.add("active");
}

function sortedProducts(products) {
  const value = sort?.value || "featured";
  return [...products].sort((a, b) => {
    if (value === "price-asc") return Number(a.price) - Number(b.price);
    if (value === "price-desc") return Number(b.price) - Number(a.price);
    if (value === "name") return (a.title || "").localeCompare(b.title || "", "vi");
    return Number(b.popularity) - Number(a.popularity);
  });
}

function filteredProducts() {
  const query = normalizeText((search?.value || activeMenuQuery || "").trim());
  return recoveredProducts.filter((product) => {
    const matchesCategory = activeFilter === "all" || product.category === activeFilter;
    const matchesSearch = !query || searchableProduct(product).includes(query);
    return matchesCategory && matchesSearch;
  });
}

function updateProductStatus() {
  const shown = Math.min(visibleLimit, matchingProducts.length);
  const query = (search?.value || "").trim();
  const filterLabel = tabs.find((tab) => (tab.dataset.filter || "all") === activeFilter)?.textContent.trim() || "Tất cả";

  if (productCount) {
    productCount.textContent = matchingProducts.length
      ? `Đang hiển thị ${shown}/${matchingProducts.length} sản phẩm`
      : "Không có sản phẩm phù hợp";
  }

  if (productNote) {
    productNote.textContent = query
      ? `Lọc theo "${query}" trong nhóm ${filterLabel.toLowerCase()}.`
      : `Dữ liệu khôi phục: ${recoveredProducts.length} sản phẩm có ảnh, giá và thông tin cơ bản.`;
  }

  if (emptyProducts) emptyProducts.hidden = matchingProducts.length > 0;

  if (loadMoreProducts) {
    const remaining = matchingProducts.length - visibleLimit;
    loadMoreProducts.hidden = remaining <= 0;
    loadMoreProducts.textContent = remaining > 0 ? `Xem thêm ${Math.min(PAGE_SIZE, remaining)} sản phẩm` : "Đã hiển thị hết";
  }
}

function renderCatalog(resetLimit = true) {
  if (!productGrid) return;
  if (resetLimit) visibleLimit = PAGE_SIZE;
  matchingProducts = sortedProducts(filteredProducts());
  productGrid.innerHTML = matchingProducts.slice(0, visibleLimit).map(productCardMarkup).join("");
  updateProductStatus();
}

const modal = document.querySelector("#productModal");
const modalImage = document.querySelector("#modalImage");
const modalBadge = document.querySelector("#modalBadge");
const modalTitle = document.querySelector("#modalTitle");
const modalPrice = document.querySelector("#modalPrice");
const modalDesc = document.querySelector("#modalDesc");
const modalCode = document.querySelector("#modalCode");
const modalSpec = document.querySelector("#modalSpec");

function openProductModal(card) {
  if (!modal) return;
  const image = card.querySelector("img");
  modalImage.src = image?.getAttribute("src") || "";
  modalImage.alt = image?.alt || card.dataset.title || "Sản phẩm";
  modalBadge.textContent = card.dataset.badge || "Chính hãng";
  modalTitle.textContent = card.dataset.title || "Sản phẩm";
  modalPrice.textContent = formatPrice(Number(card.dataset.price || 0), card.querySelector(".product-price")?.textContent || "Liên hệ");
  modalDesc.textContent = card.dataset.vat
    ? `${card.dataset.description || "Liên hệ để được tư vấn chi tiết."} Giá VAT: ${card.dataset.vat}. ${card.dataset.warranty || ""}`.trim()
    : card.dataset.description || "Liên hệ để được tư vấn chi tiết.";
  modalCode.textContent = card.dataset.code || "Đang cập nhật";
  modalSpec.textContent = card.dataset.spec || "Đang cập nhật";
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeProductModal() {
  modal?.classList.remove("open");
  modal?.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

productGrid?.addEventListener("click", (event) => {
  const quickView = event.target.closest("[data-quick-view]");
  if (!quickView) return;
  const card = event.target.closest(".product-card");
  if (card) openProductModal(card);
});

productGrid?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  const card = event.target.closest(".product-card");
  if (card) openProductModal(card);
});

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((item) => item.classList.remove("active"));
    tab.classList.add("active");
    activeFilter = tab.dataset.filter || "all";
    activeMenuQuery = "";
    if (search) search.value = "";
    catalogMenu?.querySelectorAll("button").forEach((item) => item.classList.remove("active"));
    renderCatalog(true);
  });
});

search?.addEventListener("input", () => {
  activeMenuQuery = "";
  catalogMenu?.querySelectorAll("button").forEach((item) => item.classList.remove("active"));
  renderCatalog(true);
});

sort?.addEventListener("change", () => renderCatalog(true));

loadMoreProducts?.addEventListener("click", () => {
  visibleLimit += PAGE_SIZE;
  renderCatalog(false);
});

document.querySelectorAll("[data-close-modal]").forEach((control) => {
  control.addEventListener("click", closeProductModal);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  closeProductModal();
  closeNavMenu();
});

buildCatalogMenu();
renderCatalog(true);


