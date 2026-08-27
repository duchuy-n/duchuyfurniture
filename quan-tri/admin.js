const STORAGE_KEY = "dhf_admin_products_draft_v1";
const CHANGE_KEY = "dhf_admin_changed_ids_v1";
const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0
});


const originalProducts = Array.isArray(window.recoveredProducts) ? window.recoveredProducts : [];
const savedProducts = readJson(STORAGE_KEY, null);
const savedChangedIds = new Set(readJson(CHANGE_KEY, []));
let products = Array.isArray(savedProducts) ? savedProducts : originalProducts.map(cloneProduct);
let changedIds = savedChangedIds;
let selectedId = products[0]?.id || null;

const list = document.querySelector("#adminProductList");
const form = document.querySelector("#productEditorForm");
const search = document.querySelector("#adminSearch");
const category = document.querySelector("#adminCategory");
const count = document.querySelector("#adminCount");
const status = document.querySelector("#adminStatus");
const preview = document.querySelector("#adminPreview");
const statTotal = document.querySelector("#statTotal");
const statPriced = document.querySelector("#statPriced");
const statImages = document.querySelector("#statImages");
const statDraft = document.querySelector("#statDraft");

function readJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function cloneProduct(product) {
  return JSON.parse(JSON.stringify(product || {}));
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

function parsePrice(value) {
  const digits = String(value || "").replace(/[^0-9]/g, "");
  return digits ? Number(digits) : 0;
}

function formatPrice(value) {
  return Number(value) > 0 ? money.format(Number(value)).replace("₫", "VNĐ") : "Liên hệ";
}

function compact(value, limit = 110) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 3).replace(/\s+\S*$/, "")}...`;
}

function productSearchText(product) {
  return normalizeText([
    product.title,
    product.code,
    product.priceText,
    product.size,
    product.category,
    product.categoryPath,
    product.badge,
    product.description
  ].join(" "));
}

function filteredProducts() {
  const query = normalizeText(search?.value || "");
  const cat = category?.value || "all";
  return products.filter((product) => {
    const matchesCategory = cat === "all" || product.category === cat;
    const matchesQuery = !query || productSearchText(product).includes(query);
    return matchesCategory && matchesQuery;
  });
}

function setStatus(text, type = "info") {
  if (!status) return;
  status.textContent = text;
  status.dataset.type = type;
}

function updateStats() {
  statTotal.textContent = products.length.toLocaleString("vi-VN");
  statPriced.textContent = products.filter((item) => Number(item.price) > 0).length.toLocaleString("vi-VN");
  statImages.textContent = products.filter((item) => item.image).length.toLocaleString("vi-VN");
  statDraft.textContent = changedIds.size.toLocaleString("vi-VN");
}

function renderList() {
  const items = filteredProducts();
  if (count) count.textContent = `Hiển thị ${items.length.toLocaleString("vi-VN")} / ${products.length.toLocaleString("vi-VN")} sản phẩm`;
  if (!list) return;

  list.innerHTML = items.map((product) => `
    <button class="admin-product-item${String(product.id) === String(selectedId) ? " active" : ""}" type="button" data-id="${escapeHtml(product.id)}">
      <img src="../${escapeHtml(product.image || "assets/images/products/ban-giam-doc.jpg")}" alt="${escapeHtml(product.title || "Sản phẩm")}" loading="lazy">
      <span>
        <strong>${escapeHtml(product.title || "Sản phẩm chưa đặt tên")}</strong>
        <span>${escapeHtml(product.priceText || formatPrice(product.price))}</span>
        <small>${escapeHtml(product.code || "Chưa có mã")} · ${escapeHtml(product.badge || product.categoryPath || "Chưa phân loại")}</small>
      </span>
    </button>
  `).join("");
}

function selectedProduct() {
  return products.find((product) => String(product.id) === String(selectedId)) || products[0] || null;
}

function fillForm(product) {
  if (!form || !product) return;
  form.elements.title.value = product.title || "";
  form.elements.code.value = product.code || "";
  form.elements.price.value = product.price ? String(product.price) : "";
  form.elements.vatPrice.value = product.vatPrice || "";
  form.elements.category.value = product.category || "khac";
  form.elements.badge.value = product.badge || "";
  form.elements.size.value = product.size || "";
  form.elements.image.value = product.image || "";
  form.elements.categoryPath.value = product.categoryPath || "";
  form.elements.warranty.value = product.warranty || "";
  form.elements.description.value = product.description || "";
  form.elements.sourceUrl.value = product.sourceUrl || "";
  renderPreview(product);
}

function productFromForm(base = {}) {
  const price = parsePrice(form.elements.price.value);
  const title = form.elements.title.value.trim() || "Sản phẩm nội thất mới";
  const code = form.elements.code.value.trim() || `NEW-${Date.now()}`;
  return {
    ...base,
    id: base.id || `new-${Date.now()}`,
    title,
    code,
    price,
    priceText: formatPrice(price),
    vatPrice: form.elements.vatPrice.value.trim(),
    size: form.elements.size.value.trim() || "Liên hệ tư vấn kích thước",
    warranty: form.elements.warranty.value.trim() || "Sản phẩm bảo hành 12 tháng",
    description: form.elements.description.value.trim() || "Liên hệ Nội thất Đức Huy để được tư vấn chi tiết.",
    image: form.elements.image.value.trim() || "assets/images/products/ban-giam-doc.jpg",
    categoryPath: form.elements.categoryPath.value.trim() || "san pham noi that",
    category: form.elements.category.value || "khac",
    badge: form.elements.badge.value.trim() || "Chính hãng",
    sourceUrl: form.elements.sourceUrl.value.trim(),
    popularity: Number(base.popularity) || products.length + 1
  };
}

function renderPreview(product) {
  if (!preview) return;
  preview.innerHTML = `
    <article>
      <img src="../${escapeHtml(product.image || "assets/images/products/ban-giam-doc.jpg")}" alt="${escapeHtml(product.title || "Sản phẩm")}">
      <div>
        <h3>${escapeHtml(product.title || "Sản phẩm chưa đặt tên")}</h3>
        <strong>${escapeHtml(product.priceText || formatPrice(product.price))}</strong>
        <p>${escapeHtml(product.code || "Chưa có mã")} · ${escapeHtml(product.size || "Chưa có kích thước")}</p>
        <p>${escapeHtml(compact(product.description || "Chưa có mô tả", 180))}</p>
      </div>
    </article>
  `;
}

function persistDraft() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
  localStorage.setItem(CHANGE_KEY, JSON.stringify([...changedIds]));
  updateStats();
}

function saveCurrentProduct() {
  const existing = selectedProduct();
  const updated = productFromForm(existing || {});
  const index = products.findIndex((product) => String(product.id) === String(updated.id));
  if (index >= 0) products[index] = updated;
  else products.unshift(updated);
  selectedId = updated.id;
  changedIds.add(String(updated.id));
  persistDraft();
  renderList();
  fillForm(updated);
  setStatus(`Đã lưu nháp: ${updated.title}`, "success");
}

function newProduct() {
  const product = {
    id: `new-${Date.now()}`,
    title: "Sản phẩm nội thất mới",
    code: `NEW-${products.length + 1}`,
    price: 0,
    priceText: "Liên hệ",
    vatPrice: "",
    size: "Liên hệ tư vấn kích thước",
    warranty: "Sản phẩm bảo hành 12 tháng",
    description: "Liên hệ Nội thất Đức Huy để được tư vấn chi tiết.",
    image: "assets/images/products/ban-giam-doc.jpg",
    categoryPath: "san pham noi that",
    category: "khac",
    badge: "Chính hãng",
    sourceUrl: "",
    popularity: products.length + 1
  };
  products.unshift(product);
  selectedId = product.id;
  changedIds.add(String(product.id));
  persistDraft();
  renderList();
  fillForm(product);
  setStatus("Đã tạo sản phẩm mới trong nháp.", "success");
}

function duplicateProduct() {
  const current = selectedProduct();
  if (!current) return;
  const copy = cloneProduct(current);
  copy.id = `copy-${Date.now()}`;
  copy.title = `${copy.title || "Sản phẩm"} - bản sao`;
  copy.code = `${copy.code || "COPY"}-COPY`;
  products.unshift(copy);
  selectedId = copy.id;
  changedIds.add(String(copy.id));
  persistDraft();
  renderList();
  fillForm(copy);
  setStatus("Đã nhân bản sản phẩm sang bản nháp mới.", "success");
}

function deleteProduct() {
  const current = selectedProduct();
  if (!current) return;
  const confirmed = window.confirm(`Xóa "${current.title}" khỏi bản nháp? File gốc chưa bị thay đổi.`);
  if (!confirmed) return;
  products = products.filter((product) => String(product.id) !== String(current.id));
  changedIds.add(String(current.id));
  selectedId = products[0]?.id || null;
  persistDraft();
  renderList();
  fillForm(selectedProduct());
  setStatus("Đã xóa sản phẩm khỏi bản nháp.", "warn");
}

function resetDraft() {
  const confirmed = window.confirm("Xóa toàn bộ nháp trên trình duyệt và quay lại dữ liệu gốc?");
  if (!confirmed) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(CHANGE_KEY);
  products = originalProducts.map(cloneProduct);
  changedIds = new Set();
  selectedId = products[0]?.id || null;
  updateStats();
  renderList();
  fillForm(selectedProduct());
  setStatus("Đã khôi phục dữ liệu gốc từ products.js.", "success");
}

function exportProducts() {
  saveCurrentProduct();
  const content = `window.recoveredProducts = ${JSON.stringify(products, null, 2)};\n`;
  const blob = new Blob([content], { type: "text/javascript;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "products.updated.js";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
  setStatus("Đã xuất products.updated.js. Muốn áp dụng lên web thì thay nội dung products.js bằng file đó rồi deploy.", "success");
}

list?.addEventListener("click", (event) => {
  const button = event.target.closest(".admin-product-item");
  if (!button) return;
  selectedId = button.dataset.id;
  renderList();
  fillForm(selectedProduct());
});

form?.addEventListener("input", () => {
  renderPreview(productFromForm(selectedProduct() || {}));
});

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  saveCurrentProduct();
});

search?.addEventListener("input", renderList);
category?.addEventListener("change", renderList);
document.querySelector("#newProductButton")?.addEventListener("click", newProduct);
document.querySelector("#duplicateButton")?.addEventListener("click", duplicateProduct);
document.querySelector("#deleteButton")?.addEventListener("click", deleteProduct);
document.querySelector("#resetDraftButton")?.addEventListener("click", resetDraft);
document.querySelector("#exportButton")?.addEventListener("click", exportProducts);
document.querySelector("#logoutButton")?.addEventListener("click", async () => {
  try {
    await fetch("../api/logout", { method: "POST", credentials: "include" });
  } finally {
    window.location.href = "../dang-nhap/";
  }
});

async function bootAdmin() {
  setStatus("Đang kiểm tra phiên đăng nhập...", "info");
  try {
    const response = await fetch("../api/session", { credentials: "include" });
    if (!response.ok) {
      window.location.replace("../dang-nhap/");
      return;
    }
  } catch {
    setStatus("Chưa kết nối được API đăng nhập. Hãy chạy bằng Vercel hoặc dev server có hỗ trợ /api.", "warn");
    return;
  }

  updateStats();
  renderList();
  fillForm(selectedProduct());
  setStatus("Đã mở khu quản trị. Các thay đổi đang lưu nháp trên trình duyệt.", "success");
}

bootAdmin();
