const categoryData = [
  { nombre: "Líquidos", imagen: "https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?auto=format&fit=crop&w=900&q=72" },
  { nombre: "Escobas y Trapeadores", imagen: "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=900&q=72" },
  { nombre: "Aromatizantes", imagen: "https://images.unsplash.com/photo-1603712725038-e9334ae8f39f?auto=format&fit=crop&w=900&q=72" },
  { nombre: "Despachadores", imagen: "https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=900&q=72" },
  { nombre: "Bolsas", imagen: "https://images.unsplash.com/photo-1591193686104-fddba4d0e4d8?auto=format&fit=crop&w=900&q=72" },
  { nombre: "Cepillos y fibras", imagen: "https://images.unsplash.com/photo-1563453392212-326f5e854473?auto=format&fit=crop&w=900&q=72" },
  { nombre: "Cestos y cubetas", imagen: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=900&q=72" },
  { nombre: "Higiénicos", imagen: "https://images.unsplash.com/photo-1584556812952-905ffd0c611a?auto=format&fit=crop&w=900&q=72" }
];

const HOME_PRODUCT_LIMIT = 8;
let revealObserver;

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;"
  })[character]);
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

function observeReveal(element) {
  if (!element) return;
  if (revealObserver) revealObserver.observe(element);
  else element.classList.add("in-view");
}

function setupScrollAnimations() {
  const elements = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    elements.forEach(element => element.classList.add("in-view"));
    return;
  }
  revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in-view");
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: "0px 0px -30px 0px" });
  elements.forEach(observeReveal);
}

function setupWhatsApp() {
  document.querySelectorAll("[data-whatsapp]").forEach(link => {
    link.href = `https://wa.me/${MOBEL_CONFIG.whatsappNumber}?text=${encodeURIComponent(MOBEL_CONFIG.defaultMessage)}`;
    link.target = "_blank";
    link.rel = "noopener";
  });
}

function categoryImage(categoryName) {
  const normalized = String(categoryName).toLowerCase();
  const match = categoryData.find(item => normalized.includes(item.nombre.toLowerCase().split(" ")[0]));
  return match?.imagen || categoryData[0].imagen;
}

function renderCategories(products) {
  const holder = document.getElementById("categoriesGrid");
  if (!holder) return;

  const available = [...new Set(products.map(product => product.categoria).filter(Boolean))];
  const chosen = categoryData.map(item => item.nombre).filter(name =>
    available.some(category => category.toLowerCase().includes(name.toLowerCase().split(" ")[0]))
  );
  const categories = (chosen.length ? chosen : available).slice(0, 8);

  holder.innerHTML = categories.map(category => `
    <a class="category-card reveal" href="catalogo.html?categoria=${encodeURIComponent(category)}">
      <img src="${escapeHtml(categoryImage(category))}" alt="${escapeHtml(category)}" loading="lazy" decoding="async">
      <div><h3>${escapeHtml(category)}</h3><span>Ver productos <i class="fa-solid fa-arrow-right"></i></span></div>
    </a>
  `).join("");

  holder.querySelectorAll(".reveal").forEach(observeReveal);
}

function renderSkeletons() {
  const grid = document.getElementById("productsGrid");
  if (!grid) return;
  grid.innerHTML = Array.from({ length: HOME_PRODUCT_LIMIT }, () => `
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

function renderFeatured(products) {
  const grid = document.getElementById("productsGrid");
  const empty = document.getElementById("emptyState");
  if (!grid) return;

  const featured = products.slice(0, HOME_PRODUCT_LIMIT);
  grid.innerHTML = "";
  if (empty) empty.hidden = featured.length > 0;

  featured.forEach((product, index) => {
    const detailUrl = `producto.html?id=${encodeURIComponent(product.id)}`;
    const message = `Hola, me interesa el producto: ${product.nombre}${product.sku ? ` (SKU: ${product.sku})` : ""}. ¿Me pueden dar información?`;
    const whatsappUrl = `https://wa.me/${MOBEL_CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`;
    const description = product.descripcion || (product.unidad ? `Presentación: ${product.unidad}` : "Solicita información y disponibilidad.");

    const card = document.createElement("article");
    card.className = "product-card reveal";
    card.innerHTML = `
      <a class="product-image" href="${detailUrl}">
        ${product.imagen
          ? `<img src="${escapeHtml(product.imagen)}" alt="${escapeHtml(product.nombre)}" loading="${index < 2 ? "eager" : "lazy"}" decoding="async">`
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
    `;
    grid.appendChild(card);
    observeReveal(card);
  });
}

async function loadHomeProducts() {
  renderSkeletons();
  try {
    const response = await fetch(`${MOBEL_CONFIG.apiUrl}/productos`, {
      headers: { Accept: "application/json" }
    });
    if (!response.ok) throw new Error(`Error ${response.status}`);
    const data = await response.json();
    const products = (data.productos || []).map(normalizeProduct).filter(product => product.id && product.nombre);

    const count = document.getElementById("productCount");
    if (count) count.textContent = `+${products.length}`;

    renderFeatured(products);
    setTimeout(() => renderCategories(products), 0);
  } catch (error) {
    console.error(error);
    const grid = document.getElementById("productsGrid");
    if (grid) grid.innerHTML = "";
    const empty = document.getElementById("emptyState");
    if (empty) empty.hidden = false;
  }
}

function setupMenu() {
  const toggle = document.getElementById("menuToggle");
  const nav = document.getElementById("mainNav");
  if (!toggle || !nav) return;
  toggle.addEventListener("click", () => {
    nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(nav.classList.contains("open")));
  });
  nav.querySelectorAll("a").forEach(link => link.addEventListener("click", () => nav.classList.remove("open")));
}

document.getElementById("year").textContent = new Date().getFullYear();
setupScrollAnimations();
setupMenu();
setupWhatsApp();
loadHomeProducts();
