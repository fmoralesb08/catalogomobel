const PAGE_SIZE = 24;
let allProducts = [];
let filteredProducts = [];
let visibleCount = PAGE_SIZE;
let activeCategory = "Todos";

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;"
  })[character]);
}

function normalizeText(value = "") {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function normalizeHeader(value = "") {
  return normalizeText(value).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
function parseCategories(value = "") {
  const categories = String(value)
    .split("|")
    .map(category => category.trim())
    .filter(Boolean);

  return categories.length ? [...new Set(categories)] : ["Otros"];
}

function formatCategories(categories = []) {
  return categories.join(" · ");
}


function parseCSV(text) {
  const rows = [];
  let row = [], value = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i], next = text[i + 1];
    if (char === '"') {
      if (quoted && next === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value); value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i++;
      row.push(value);
      if (row.some(cell => String(cell).trim() !== "")) rows.push(row);
      row = []; value = "";
    } else value += char;
  }
  row.push(value);
  if (row.some(cell => String(cell).trim() !== "")) rows.push(row);
  return rows;
}

function csvToObjects(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map(normalizeHeader);
  return rows.slice(1).map(row => Object.fromEntries(headers.map((header, i) => [header, String(row[i] ?? "").trim()])));
}

function isTruthy(value, emptyDefault = false) {
  const normalized = normalizeText(value);
  if (!normalized) return emptyDefault;
  return ["true", "verdadero", "si", "1", "x", "activo", "visible", "mostrar", "destacado"].includes(normalized);
}

function getPrice(product) {
  const raw = product.precio ?? product.price ?? product.precio_venta;
  if (raw === null || raw === undefined || raw === "") return null;
  const value = Number(String(raw).replace(/,/g, "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(value) ? value : null;
}

function formatPrice(value) {
  return value === null ? "Cotizar" : new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);
}

function normalizeImage(value = "") {
  const image = String(value).trim();
  if (!image) return "";
  if (/^https?:\/\//i.test(image)) return image;
  const clean = image.replace(/^\.?\//, "").replace(/^img\/productos\//i, "").replace(/^productos\//i, "");
  return `${MOBEL_CONFIG.imageBaseUrl}${encodeURI(clean)}`;
}

function normalizeProduct(product, index) {
  return {
    id: product.sku || product.id || `producto-${index + 1}`,
    nombre: product.nombre || product.producto || "Producto",
    categorias: parseCategories(product.categoria || product.category || "Otros"),
    categoria: parseCategories(product.categoria || product.category || "Otros")[0],
    descripcion: product.descripcion || product.description || "",
    imagen: normalizeImage(product.imagen || product.archivo_imagen_sugerido || product.foto || product.image || ""),
    unidad: product.presentacion || product.unidad || product.medida || "",
    precio: getPrice(product),
    destacado: isTruthy(product.destacado, false),
    mostrar: isTruthy(product.mostrar, true)
  };
}

async function fetchProducts() {
  const separator = MOBEL_CONFIG.sheetCsvUrl.includes("?") ? "&" : "?";
  const response = await fetch(`${MOBEL_CONFIG.sheetCsvUrl}${separator}v=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Error ${response.status}`);
  const products = csvToObjects(await response.text()).map(normalizeProduct);
  return products.filter(product => product.nombre && product.mostrar);
}

function setupWhatsApp() {
  document.querySelectorAll("[data-whatsapp]").forEach(link => {
    link.href = `https://wa.me/${MOBEL_CONFIG.whatsappNumber}?text=${encodeURIComponent(MOBEL_CONFIG.defaultMessage)}`;
    link.target = "_blank";
    link.rel = "noopener";
  });
}

function setupMenu() {
  const toggle = document.getElementById("menuToggle");
  const nav = document.getElementById("mainNav");
  if (!toggle || !nav) return;
  toggle.addEventListener("click", () => {
    nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(nav.classList.contains("open")));
  });
}

function renderSkeletons() {
  const grid = document.getElementById("catalogGrid");
  if (!grid) return;
  grid.innerHTML = Array.from({ length: 8 }, () => `
    <article class="product-card product-skeleton" aria-hidden="true">
      <div class="skeleton-image"></div><div class="product-content">
      <div class="skeleton-line skeleton-small"></div><div class="skeleton-line skeleton-title"></div>
      <div class="skeleton-line"></div><div class="skeleton-line skeleton-button"></div></div>
    </article>`).join("");
}

function renderFilters() {
  const holder = document.getElementById("catalogFilters");
  if (!holder) return;
  const categories = ["Todos", ...new Set(
    allProducts.flatMap(product => product.categorias || [product.categoria]).filter(Boolean)
  )];
  categories.sort((a, b) => a === "Todos" ? -1 : b === "Todos" ? 1 : a.localeCompare(b, "es", { sensitivity: "base" }));
  holder.innerHTML = categories.map(category => `<button class="filter-btn ${category === activeCategory ? "active" : ""}" data-category="${escapeHtml(category)}" type="button">${escapeHtml(category)}</button>`).join("");
  holder.querySelectorAll(".filter-btn").forEach(button => button.addEventListener("click", () => {
    activeCategory = button.dataset.category;
    visibleCount = PAGE_SIZE;
    renderFilters();
    applyFilters();
  }));
}

function productCard(product) {
  const detailUrl = `producto.html?id=${encodeURIComponent(product.id)}`;
  const message = `Hola, me interesa el producto: ${product.nombre}. ¿Me pueden dar información?`;
  const whatsappUrl = `https://wa.me/${MOBEL_CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`;
  const description = product.descripcion || (product.unidad ? `Presentación: ${product.unidad}` : "Solicita información y disponibilidad.");
  return `<article class="product-card">
    <a class="product-image" href="${detailUrl}">${product.imagen
      ? `<img src="${escapeHtml(product.imagen)}" alt="${escapeHtml(product.nombre)}" loading="lazy" decoding="async" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="image-placeholder" aria-hidden="true" style="display:none">🧴</div>`
      : `<div class="image-placeholder" aria-hidden="true">🧴</div>`}</a>
    <div class="product-content"><div class="product-meta"><span>${escapeHtml(formatCategories(product.categorias))}</span></div>
    <h3><a href="${detailUrl}">${escapeHtml(product.nombre)}</a></h3>
    <div class="product-price${product.precio === null ? " product-price-quote" : ""}">${formatPrice(product.precio)}</div>
    <p>${escapeHtml(description)}</p><div class="product-actions"><a class="btn btn-secondary" href="${detailUrl}">Ver producto</a>
    <a class="icon-btn" href="${whatsappUrl}" target="_blank" rel="noopener" aria-label="Consultar por WhatsApp"><i class="fa-brands fa-whatsapp"></i></a></div></div>
  </article>`;
}

function applyFilters() {
  const query = normalizeText(document.getElementById("catalogSearch")?.value || "");
  filteredProducts = allProducts.filter(product => {
    const categoryMatch = activeCategory === "Todos" || (product.categorias || []).includes(activeCategory);
    const text = normalizeText(`${product.nombre} ${formatCategories(product.categorias)} ${product.descripcion} ${product.unidad}`);
    return categoryMatch && (!query || text.includes(query));
  });
  renderProducts();
}

function renderProducts() {
  const grid = document.getElementById("catalogGrid");
  const empty = document.getElementById("catalogEmpty");
  const count = document.getElementById("catalogCount");
  const loadMore = document.getElementById("loadMoreBtn");
  if (!grid || !empty || !count || !loadMore) return;
  const visible = filteredProducts.slice(0, visibleCount);
  grid.innerHTML = visible.map(productCard).join("");
  empty.hidden = filteredProducts.length > 0;
  count.textContent = `${filteredProducts.length} producto${filteredProducts.length === 1 ? "" : "s"} encontrado${filteredProducts.length === 1 ? "" : "s"}`;
  loadMore.hidden = visibleCount >= filteredProducts.length;
}

async function loadCatalog() {
  renderSkeletons();
  try {
    allProducts = await fetchProducts();
    const params = new URLSearchParams(location.search);
    const requestedCategory = params.get("categoria");
    const requestedSearch = params.get("buscar");
    if (requestedCategory && allProducts.some(product => (product.categorias || []).includes(requestedCategory))) {
      activeCategory = requestedCategory;
    }
    const searchInput = document.getElementById("catalogSearch");
    if (requestedSearch && searchInput) searchInput.value = requestedSearch;
    renderFilters();
    applyFilters();
  } catch (error) {
    console.error("Error al cargar Google Sheets:", error);
    const grid = document.getElementById("catalogGrid");
    const empty = document.getElementById("catalogEmpty");
    const loadMore = document.getElementById("loadMoreBtn");
    if (grid) grid.innerHTML = "";
    if (empty) { empty.hidden = false; empty.textContent = "No fue posible cargar el catálogo. Revisa que Google Sheets esté publicado en la web."; }
    if (loadMore) loadMore.hidden = true;
  }
}

document.getElementById("catalogSearch")?.addEventListener("input", () => { visibleCount = PAGE_SIZE; applyFilters(); });
document.getElementById("loadMoreBtn")?.addEventListener("click", () => { visibleCount += PAGE_SIZE; renderProducts(); });
const year = document.getElementById("year"); if (year) year.textContent = new Date().getFullYear();
setupMenu(); setupWhatsApp(); loadCatalog();
