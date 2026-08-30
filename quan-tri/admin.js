const CHANGE_KEY = "dhf_admin_changed_ids_v2";
const SEED_OFFSET_KEY = "dhf_admin_seed_offset_v1";
const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0
});

const originalProducts = Array.isArray(window.recoveredProducts) ? window.recoveredProducts : [];
let products = originalProducts.map(cloneProduct);
let changedIds = new Set();
let selectedId = products[0]?.id || null;
let cloudReady = false;
let autoSeedAttempted = false;
let autoImageMigrationAttempted = false;

const list = document.querySelector("#adminProductList");
const form = document.querySelector("#productEditorForm");
const search = document.querySelector("#adminSearch");
const category = document.querySelector("#adminCategory");
const count = document.querySelector("#adminCount");
const status = document.querySelector("#adminStatus");
const preview = document.querySelector("#adminPreview");
const imageFile = document.querySelector("#productImageFile");
const productImagePreview = document.querySelector("#productImagePreview");
const statTotal = document.querySelector("#statTotal");
const statPriced = document.querySelector("#statPriced");
const statImages = document.querySelector("#statImages");
const statDraft = document.querySelector("#statDraft");
const reloadButton = document.querySelector("#reloadButton");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function imageSrc(image) {
  const value = String(image || "assets/images/products/ban-giam-doc.jpg");
  if (value.startsWith("http") || value.startsWith("/")) return value;
  return `../${value}`;
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
    return matchesCategory && matchesQuery && product.published !== false;
  });
}

function setStatus(text, type = "info") {
  if (!status) return;
  status.textContent = text;
  status.dataset.type = type;
}

function setBusy(isBusy) {
  form?.querySelectorAll("button, input, select, textarea").forEach((control) => {
    control.disabled = isBusy;
  });
  if (reloadButton) reloadButton.disabled = isBusy;
}

function updateStats() {
  const published = products.filter((item) => item.published !== false);
  statTotal.textContent = published.length.toLocaleString("vi-VN");
  statPriced.textContent = published.filter((item) => Number(item.price) > 0).length.toLocaleString("vi-VN");
  statImages.textContent = published.filter((item) => item.image).length.toLocaleString("vi-VN");
  statDraft.textContent = changedIds.size.toLocaleString("vi-VN");
}

function renderList() {
  const items = filteredProducts();
  const publishedCount = products.filter((item) => item.published !== false).length;
  if (count) count.textContent = `Hiển thị ${items.length.toLocaleString("vi-VN")} / ${publishedCount.toLocaleString("vi-VN")} sản phẩm`;
  if (!list) return;

  list.innerHTML = items.map((product) => `
    <button class="admin-product-item${String(product.id) === String(selectedId) ? " active" : ""}" type="button" data-id="${escapeHtml(product.id)}">
      <img src="${escapeHtml(imageSrc(product.image))}" alt="${escapeHtml(product.title || "Sản phẩm")}" loading="lazy">
      <span>
        <strong>${escapeHtml(product.title || "Sản phẩm chưa đặt tên")}</strong>
        <span>${escapeHtml(product.priceText || formatPrice(product.price))}</span>
        <small>${escapeHtml(product.code || "Chưa có mã")} · ${escapeHtml(product.badge || product.categoryPath || "Chưa phân loại")}</small>
      </span>
    </button>
  `).join("");
}

function selectedProduct() {
  return products.find((product) => String(product.id) === String(selectedId)) || products.find((product) => product.published !== false) || null;
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
  if (productImagePreview) productImagePreview.src = imageSrc(product.image);
  renderPreview(product);
}

function productFromForm(base = {}) {
  const price = parsePrice(form.elements.price.value);
  const title = form.elements.title.value.trim() || "Sản phẩm nội thất mới";
  const fallbackCode = base.code || `SP-${Date.now()}`;
  const code = form.elements.code.value.trim() || fallbackCode;
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
    popularity: Number(base.popularity) || products.length + 1,
    slug: base.slug || slugify([title, code].join("-")),
    published: true
  };
}

function renderPreview(product) {
  if (!preview) return;
  preview.innerHTML = `
    <article>
      <img src="${escapeHtml(imageSrc(product.image))}" alt="${escapeHtml(product.title || "Sản phẩm")}">
      <div>
        <h3>${escapeHtml(product.title || "Sản phẩm chưa đặt tên")}</h3>
        <strong>${escapeHtml(product.priceText || formatPrice(product.price))}</strong>
        <p>${escapeHtml(product.code || "Chưa có mã")} · ${escapeHtml(product.size || "Chưa có kích thước")}</p>
        <p>${escapeHtml(compact(product.description || "Chưa có mô tả", 180))}</p>
      </div>
    </article>
  `;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    const error = new Error(data?.error || `request_${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function resizeImageFile(file) {
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const maxSize = 1400;
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.84);
}

async function uploadSelectedImage(file) {
  if (!file) return;
  if (!cloudReady) {
    setStatus("Chưa kết nối dữ liệu nên chưa tải ảnh lên được.", "warn");
    return;
  }

  setBusy(true);
  setStatus("Đang tải ảnh lên...", "info");
  try {
    const dataUrl = await resizeImageFile(file);
    const data = await fetchJson("../api/upload-image", {
      method: "POST",
      body: JSON.stringify({ fileName: file.name, contentType: "image/jpeg", data: dataUrl })
    });
    form.elements.image.value = data.image;
    if (productImagePreview) productImagePreview.src = data.image;
    renderPreview(productFromForm(selectedProduct() || {}));
    setStatus("Đã tải ảnh lên. Nhập tên, giá rồi bấm Lưu lên web.", "success");
  } catch (error) {
    if (error.status === 401) {
      window.location.href = "../dang-nhap/";
      return;
    }
    const message = error.status === 503
      ? "Chưa cấu hình ImageKit. Thêm IMAGEKIT_PRIVATE_KEY trên Vercel rồi redeploy."
      : "Chưa tải được ảnh. Thử ảnh nhỏ hơn hoặc kiểm tra cấu hình ImageKit.";
    setStatus(message, "warn");
  } finally {
    setBusy(false);
    imageFile.value = "";
  }
}


function isLegacyLocalImage(image) {
  const value = String(image || "").trim();
  if (!value) return false;
  if (value.startsWith("http") || value.startsWith("//") || value.startsWith("data:")) return false;
  const clean = value.replace(/^\.\//, "").replace(/^\.\.\//, "");
  return clean.startsWith("assets/") || clean.startsWith("crawl-output/");
}

function legacyImageCount() {
  return products.filter((product) => product.published !== false && isLegacyLocalImage(product.image)).length;
}

async function autoMigrateLegacyImages() {
  const startingCount = legacyImageCount();
  if (!startingCount || autoImageMigrationAttempted) return false;
  autoImageMigrationAttempted = true;
  setBusy(true);

  try {
    let remaining = startingCount;
    let migratedTotal = 0;
    while (remaining > 0) {
      setStatus(`Đang đưa ảnh cũ lên ImageKit: còn khoảng ${remaining.toLocaleString("vi-VN")} ảnh...`, "info");
      const data = await fetchJson("../api/products-migrate-images", {
        method: "POST",
        body: JSON.stringify({ limit: 30 })
      });
      migratedTotal += Number(data.migrated || 0);
      remaining = Number(data.remaining || 0);

      if (Array.isArray(data.failed) && data.failed.length && Number(data.migrated || 0) === 0) {
        setStatus("Một số ảnh cũ chưa đưa lên ImageKit được. Web vẫn dùng ảnh local, bạn có thể thử Làm mới sau.", "warn");
        return false;
      }

      if (data.done) break;
    }

    setStatus(`Đã đưa ${migratedTotal.toLocaleString("vi-VN")} ảnh cũ lên ImageKit. Đang tải lại dữ liệu...`, "success");
    await loadProductsFromCloud(true);
    return true;
  } catch (error) {
    if (error.status === 401) {
      window.location.href = "../dang-nhap/";
      return true;
    }
    const message = error.status === 503
      ? "Chưa cấu hình ImageKit. Thêm IMAGEKIT_PRIVATE_KEY trên Vercel rồi redeploy."
      : "Chưa đưa ảnh cũ lên ImageKit được. Web vẫn dùng ảnh local, có thể thử lại sau.";
    setStatus(message, "warn");
    return false;
  } finally {
    setBusy(false);
  }
}
async function autoSeedLegacyProducts(startOffset = Number(localStorage.getItem(SEED_OFFSET_KEY) || 0)) {
  if (autoSeedAttempted) return;
  autoSeedAttempted = true;
  setBusy(true);
  let offset = Math.max(0, Number(startOffset) || 0);
  let total = originalProducts.length;
  try {
    while (offset !== null) {
      setStatus(`Lần đầu đang tự đưa sản phẩm cũ lên Firebase: ${offset.toLocaleString("vi-VN")}/${total.toLocaleString("vi-VN")}...`, "info");
      const data = await fetchJson("../api/products-seed", {
        method: "POST",
        body: JSON.stringify({ offset, limit: 60 })
      });
      total = Number(data.total || total);
      offset = data.nextOffset;
      if (offset !== null) localStorage.setItem(SEED_OFFSET_KEY, String(offset));
      else localStorage.removeItem(SEED_OFFSET_KEY);
      if (offset !== null) await wait(1200);
    }
    setStatus(`Đã tự đưa ${total.toLocaleString("vi-VN")} sản phẩm cũ lên Firebase. Đang tải lại dữ liệu...`, "success");
    await loadProductsFromCloud(true);
  } catch (error) {
    if (error.status === 401) {
      window.location.href = "../dang-nhap/";
      return;
    }
    const message = error.status === 429 ? "Firebase đang giới hạn tạm thời. Đợi 1-2 phút rồi bấm Làm mới để tiếp tục đồng bộ." : "Chưa tự đưa sản phẩm cũ lên Firebase được. Kiểm tra biến Firebase trên Vercel rồi redeploy.";
    setStatus(message, "warn");
  } finally {
    setBusy(false);
  }
}

async function loadProductsFromCloud(showSuccess = false) {
  setStatus("Đang tải dữ liệu sản phẩm...", "info");
  try {
    const data = await fetchJson("../api/products");
    cloudReady = true;
    if (Array.isArray(data.products) && data.products.length) {
      products = data.products.map(cloneProduct);
      selectedId = products[0]?.id || null;
      changedIds = new Set();
      updateStats();
      renderList();
      fillForm(selectedProduct());
      if (products.length < originalProducts.length && !autoSeedAttempted) {
        await autoSeedLegacyProducts(products.length);
        return;
      }
      if (legacyImageCount() && !autoImageMigrationAttempted) {
        await autoMigrateLegacyImages();
        return;
      }
      setStatus(showSuccess ? "Đã tải lại dữ liệu từ Firebase." : "Đã dùng dữ liệu live từ Firebase.", "success");
      return;
    }

    products = originalProducts.map(cloneProduct);
    selectedId = products[0]?.id || null;
    updateStats();
    renderList();
    fillForm(selectedProduct());
    await autoSeedLegacyProducts();
  } catch (error) {
    cloudReady = false;
    products = originalProducts.map(cloneProduct);
    selectedId = products[0]?.id || null;
    updateStats();
    renderList();
    fillForm(selectedProduct());
    if (error.status === 429) {
      cloudReady = true;
      setStatus("Firebase đang giới hạn đọc tạm thời. Web sẽ thử đồng bộ tiếp chậm hơn bằng dữ liệu dự phòng.", "warn");
      await wait(2500);
      await autoSeedLegacyProducts();
      return;
    }
    const message = error.status === 503
      ? "Chưa cấu hình Firebase trên Vercel. Thêm biến Firebase rồi redeploy, sản phẩm cũ sẽ tự đồng bộ."
      : "Chưa tải được Firebase, đang dùng dữ liệu dự phòng từ file cũ.";
    setStatus(message, "warn");
  }
}

async function saveCurrentProduct() {
  const existing = selectedProduct();
  const titleInput = form.elements.title.value.trim();
  const priceInput = parsePrice(form.elements.price.value);
  if (!titleInput || !priceInput) {
    setStatus("Nhập tối thiểu tên sản phẩm và giá bán trước khi lưu nhé.", "warn");
    return;
  }
  const updated = productFromForm(existing || {});
  if (!cloudReady) {
    setStatus("Chưa kết nối Firebase nên chưa lưu live được. Hãy cấu hình Firebase trên Vercel trước.", "warn");
    return;
  }

  setBusy(true);
  setStatus("Đang lưu sản phẩm lên web...", "info");
  try {
    const data = await fetchJson("../api/products", {
      method: "POST",
      body: JSON.stringify({ product: updated })
    });
    const saved = data.product || updated;
    const index = products.findIndex((product) => String(product.id) === String(saved.id));
    if (index >= 0) products[index] = saved;
    else products.unshift(saved);
    selectedId = saved.id;
    changedIds.add(String(saved.id));
    updateStats();
    renderList();
    fillForm(saved);
    setStatus(`Đã lưu lên web: ${saved.title}`, "success");
  } catch (error) {
    if (error.status === 401) {
      window.location.href = "../dang-nhap/";
      return;
    }
    setStatus("Chưa lưu được. Kiểm tra lại Firebase env vars hoặc thử đăng nhập lại.", "warn");
  } finally {
    setBusy(false);
  }
}

function newProduct() {
  const timestamp = Date.now();
  const product = {
    id: `new-${timestamp}`,
    title: "",
    code: `SP-${timestamp}`,
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
    popularity: products.length + 1,
    published: true
  };
  products.unshift(product);
  selectedId = product.id;
  renderList();
  fillForm(product);
  form.elements.title.focus();
  setStatus("Thêm sản phẩm mới: chọn ảnh, nhập tên, nhập giá rồi bấm Lưu lên web.", "success");
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
  renderList();
  fillForm(copy);
  setStatus("Đã nhân bản sản phẩm. Sửa thông tin rồi bấm Lưu lên web.", "success");
}

async function hideCurrentProduct() {
  const current = selectedProduct();
  if (!current) return;
  if (!cloudReady) {
    setStatus("Chưa kết nối Firebase nên chưa ẩn sản phẩm live được.", "warn");
    return;
  }
  const confirmed = window.confirm(`Ẩn "${current.title}" khỏi web? Có thể bật lại trong Firebase nếu cần.`);
  if (!confirmed) return;

  setBusy(true);
  setStatus("Đang ẩn sản phẩm...", "info");
  try {
    await fetchJson(`../api/products?id=${encodeURIComponent(current.id)}`, { method: "DELETE" });
    products = products.map((product) => String(product.id) === String(current.id) ? { ...product, published: false } : product);
    changedIds.add(String(current.id));
    selectedId = products.find((product) => product.published !== false)?.id || null;
    updateStats();
    renderList();
    fillForm(selectedProduct());
    setStatus("Đã ẩn sản phẩm khỏi dữ liệu live.", "success");
  } catch (error) {
    if (error.status === 401) {
      window.location.href = "../dang-nhap/";
      return;
    }
    setStatus("Chưa ẩn được sản phẩm. Kiểm tra Firebase hoặc thử đăng nhập lại.", "warn");
  } finally {
    setBusy(false);
  }
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

imageFile?.addEventListener("change", () => uploadSelectedImage(imageFile.files?.[0]));
search?.addEventListener("input", renderList);
category?.addEventListener("change", renderList);
document.querySelector("#newProductButton")?.addEventListener("click", newProduct);
document.querySelector("#duplicateButton")?.addEventListener("click", duplicateProduct);
document.querySelector("#deleteButton")?.addEventListener("click", hideCurrentProduct);
reloadButton?.addEventListener("click", () => loadProductsFromCloud(true));
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
    window.location.replace("../dang-nhap/");
    return;
  }

  document.body.classList.remove("admin-locked");
  updateStats();
  renderList();
  fillForm(selectedProduct());
  await loadProductsFromCloud();
}

bootAdmin();
