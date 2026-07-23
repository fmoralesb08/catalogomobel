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

function normalizeProduct(product) {
  return {
    id: product.id,
    sku: product.sku || "",
    nombre: product.nombre || "Producto",
    categoria: product.categoria || "Otros",
    descripcion: product.descripcion || "",
    imagen: product.imagen || "",
    unidad: product.unidad || ""
  };
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
  document.getElementById("catalogGrid").innerHTML = Array.from({ length: 8 }, () => `
    <article class="product-card product-skeleton" aria-hidden="true">
      <div class="skeleton-image"></div>
      <div class="product-content">
        <div class="skeleton-line skeleton-small"></div>
        <div class="skeleton-line skeleton-title"></div>
        <div class="skeleton-line"></div>
        <div class="skeleton-line skeleton-button"></div>
      </div>
    </article>
  `).join("");
}

function renderFilters() {
  const holder = document.getElementById("catalogFilters");
  const categories = ["Todos", ...new Set(allProducts.map(product => product.categoria).filter(Boolean))];
  categories.sort((a, b) => a === "Todos" ? -1 : b === "Todos" ? 1 : a.localeCompare(b, "es", { sensitivity: "base" }));

  holder.innerHTML = categories.map(category => `
    <button class="filter-btn ${category === activeCategory ? "active" : ""}" data-category="${escapeHtml(category)}" type="button">
      ${escapeHtml(category)}
    </button>
  `).join("");

  holder.querySelectorAll(".filter-btn").forEach(button => {
    button.addEventListener("click", () => {
      activeCategory = button.dataset.category;
      visibleCount = PAGE_SIZE;
      renderFilters();
      applyFilters();
    });
  });
}

function productCard(product, index) {
  const detailUrl = `producto.html?id=${encodeURIComponent(product.id)}`;
  const message = `Hola, me interesa el producto: ${product.nombre}${product.sku ? ` (SKU: ${product.sku})` : ""}. ¿Me pueden dar información?`;
  const whatsappUrl = `https://wa.me/${MOBEL_CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`;
  const description = product.descripcion || (product.unidad ? `Presentación: ${product.unidad}` : "Solicita información y disponibilidad.");

  return `
    <article class="product-card">
      <a class="product-image" href="${detailUrl}">
        ${product.imagen
          ? `<img src="${escapeHtml(product.imagen)}" alt="${escapeHtml(product.nombre)}" loading="lazy" decoding="async">`
          : `<div class="image-placeholder" aria-hidden="true">🧴</div>`}
      </a>
      <div class="product-content">
        <div class="product-meta">
          <span>${escapeHtml(product.categoria)}</span>
          ${product.sku ? `<small>SKU ${escapeHtml(product.sku)}</small>` : ""}
        </div>
        <h3><a href="${detailUrl}">${escapeHtml(product.nombre)}</a></h3>
        <p>${escapeHtml(description)}</p>
        <div class="product-actions">
          <a class="btn btn-secondary" href="${detailUrl}">Ver producto</a>
          <a class="icon-btn" href="${whatsappUrl}" target="_blank" rel="noopener" aria-label="Consultar por WhatsApp">
            <i class="fa-brands fa-whatsapp"></i>
          </a>
        </div>
      </div>
    </article>
  `;
}

function applyFilters() {
  const query = normalizeText(document.getElementById("catalogSearch").value);
  filteredProducts = allProducts.filter(product => {
    const categoryMatch = activeCategory === "Todos" || product.categoria === activeCategory;
    const text = normalizeText(`${product.nombre} ${product.sku} ${product.categoria} ${product.descripcion}`);
    return categoryMatch && (!query || text.includes(query));
  });
  renderProducts();
}

function renderProducts() {
  const grid = document.getElementById("catalogGrid");
  const empty = document.getElementById("catalogEmpty");
  const count = document.getElementById("catalogCount");
  const loadMore = document.getElementById("loadMoreBtn");
  const visible = filteredProducts.slice(0, visibleCount);

  grid.innerHTML = visible.map(productCard).join("");
  empty.hidden = filteredProducts.length > 0;
  count.textContent = `${filteredProducts.length} producto${filteredProducts.length === 1 ? "" : "s"} encontrado${filteredProducts.length === 1 ? "" : "s"}`;
  loadMore.hidden = visibleCount >= filteredProducts.length;
}

async function loadCatalog() {
  renderSkeletons();
  try {
    const response = await fetch(`${MOBEL_CONFIG.apiUrl}/productos`, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Error ${response.status}`);
    const data = await response.json();
    allProducts = (data.productos || []).map(normalizeProduct).filter(product => product.id && product.nombre);

    const requestedCategory = new URLSearchParams(location.search).get("categoria");
    if (requestedCategory && allProducts.some(product => product.categoria === requestedCategory)) {
      activeCategory = requestedCategory;
    }

    renderFilters();
    applyFilters();
  } catch (error) {
    console.error(error);
    document.getElementById("catalogGrid").innerHTML = "";
    const empty = document.getElementById("catalogEmpty");
    empty.hidden = false;
    empty.textContent = "No fue posible cargar el catálogo. Intenta nuevamente en unos minutos.";
    document.getElementById("loadMoreBtn").hidden = true;
  }
}

document.getElementById("catalogSearch").addEventListener("input", () => {
  visibleCount = PAGE_SIZE;
  applyFilters();
});

document.getElementById("loadMoreBtn").addEventListener("click", () => {
  visibleCount += PAGE_SIZE;
  renderProducts();
});

document.getElementById("year").textContent = new Date().getFullYear();
setupMenu();
setupWhatsApp();
loadCatalog();
