const categoryData = [
  { nombre: "Líquidos", imagen: "https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?auto=format&fit=crop&w=900&q=82" },
  { nombre: "Escobas y Trapeadores", imagen: "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=900&q=82" },
  { nombre: "Aromatizantes", imagen: "https://images.unsplash.com/photo-1603712725038-e9334ae8f39f?auto=format&fit=crop&w=900&q=82" },
  { nombre: "Despachadores", imagen: "https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=900&q=82" },
  { nombre: "Bolsas", imagen: "https://images.unsplash.com/photo-1591193686104-fddba4d0e4d8?auto=format&fit=crop&w=900&q=82" },
  { nombre: "Cepillos y fibras", imagen: "https://images.unsplash.com/photo-1563453392212-326f5e854473?auto=format&fit=crop&w=900&q=82" },
  { nombre: "Cestos y cubetas", imagen: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=900&q=82" },
  { nombre: "Higiénicos", imagen: "https://images.unsplash.com/photo-1584556812952-905ffd0c611a?auto=format&fit=crop&w=900&q=82" }
];

let allProducts = [];
let activeCategory = "Todos";

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
    precio: Number(product.precio || 0),
    stock: Number(product.stock || 0),
    unidad: product.unidad || ""
  };
}

async function loadProducts() {
  const grid = document.getElementById("productsGrid");
  grid.innerHTML = '<p class="empty-state">Cargando productos...</p>';

  try {
    const response = await fetch(`${MOBEL_CONFIG.apiUrl}/productos`);
    if (!response.ok) throw new Error(`Error ${response.status}`);

    const data = await response.json();
    allProducts = (data.productos || []).map(normalizeProduct).filter(product => product.id && product.nombre);

    const count = document.getElementById("productCount");
    if (count) count.textContent = `+${allProducts.length}`;

    renderCategories();
    render();
  } catch (error) {
    console.error("No fue posible cargar los productos:", error);
    grid.innerHTML = '<p class="empty-state">No fue posible cargar el catálogo. Intenta nuevamente en unos minutos.</p>';
  }
}

function setupWhatsApp() {
  document.querySelectorAll("[data-whatsapp]").forEach(link => {
    link.href = `https://wa.me/${MOBEL_CONFIG.whatsappNumber}?text=${encodeURIComponent(MOBEL_CONFIG.defaultMessage)}`;
    link.target = "_blank";
    link.rel = "noopener";
  });
}

function availableCategories() {
  return [...new Set(allProducts.map(product => product.categoria).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
}

function categoryImage(categoryName) {
  const normalized = categoryName.toLowerCase();
  const match = categoryData.find(category => normalized.includes(category.nombre.toLowerCase().split(" ")[0]));
  return match?.imagen || categoryData[0].imagen;
}

function renderCategories() {
  const holder = document.getElementById("categoriesGrid");
  const categories = availableCategories().slice(0, 8);

  holder.innerHTML = categories.map((category, index) => `
    <article class="category-card reveal" data-category="${escapeHtml(category)}" style="animation-delay:${index * 45}ms">
      <img src="${categoryImage(category)}" alt="${escapeHtml(category)}" loading="lazy">
      <span class="category-arrow">→</span>
      <div class="category-card-content">
        <h3>${escapeHtml(category)}</h3>
        <span>Ver productos</span>
      </div>
    </article>
  `).join("");

  holder.querySelectorAll(".category-card").forEach(card => {
    card.addEventListener("click", () => {
      activeCategory = card.dataset.category;
      render();
      document.getElementById("productos").scrollIntoView({ behavior: "smooth" });
    });
  });
}

function renderFilters() {
  const categories = ["Todos", ...availableCategories()];
  const holder = document.getElementById("categoryFilters");
  holder.innerHTML = "";

  categories.forEach(category => {
    const button = document.createElement("button");
    button.className = `filter-btn ${category === activeCategory ? "active" : ""}`;
    button.textContent = category;
    button.addEventListener("click", () => {
      activeCategory = category;
      render();
    });
    holder.appendChild(button);
  });
}

function renderProducts() {
  const query = document.getElementById("searchInput").value.trim().toLowerCase();
  const filtered = allProducts.filter(product => {
    const categoryMatch = activeCategory === "Todos" || product.categoria === activeCategory;
    const text = `${product.nombre} ${product.sku} ${product.categoria} ${product.descripcion}`.toLowerCase();
    return categoryMatch && text.includes(query);
  });

  const grid = document.getElementById("productsGrid");
  const empty = document.getElementById("emptyState");
  grid.innerHTML = "";
  empty.hidden = filtered.length > 0;

  filtered.forEach((product, index) => {
    const message = `Hola, me interesa el producto: ${product.nombre}${product.sku ? ` (SKU: ${product.sku})` : ""}. ¿Me pueden dar información?`;
    const whatsappUrl = `https://wa.me/${MOBEL_CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`;
    const detailUrl = `producto.html?id=${encodeURIComponent(product.id)}`;
    const description = product.descripcion || (product.unidad ? `Presentación: ${product.unidad}` : "Solicita información y disponibilidad.");

    const card = document.createElement("article");
    card.className = "product-card reveal";
    card.style.animationDelay = `${Math.min(index, 20) * 35}ms`;
    card.innerHTML = `
      <a class="product-image" href="${detailUrl}" aria-label="Ver ${escapeHtml(product.nombre)}">
        ${product.imagen
          ? `<img src="${escapeHtml(product.imagen)}" alt="${escapeHtml(product.nombre)}" loading="lazy" />`
          : '<div class="image-placeholder">🧴</div>'}
      </a>
      <div class="product-content">
        <span class="product-category">${escapeHtml(product.categoria)}</span>
        <h3><a href="${detailUrl}">${escapeHtml(product.nombre)}</a></h3>
        <p>${escapeHtml(description)}</p>
        <a class="btn btn-primary" href="${whatsappUrl}" target="_blank" rel="noopener">Solicitar información</a>
      </div>`;
    grid.appendChild(card);
  });
}

function render() {
  renderFilters();
  renderProducts();
}

document.getElementById("searchInput").addEventListener("input", renderProducts);
document.getElementById("year").textContent = new Date().getFullYear();
document.getElementById("menuToggle").addEventListener("click", () => {
  const nav = document.getElementById("mainNav");
  nav.classList.toggle("open");
  document.getElementById("menuToggle").setAttribute("aria-expanded", nav.classList.contains("open"));
});
document.querySelectorAll("#mainNav a").forEach(link => link.addEventListener("click", () => document.getElementById("mainNav").classList.remove("open")));

setupWhatsApp();
loadProducts();
