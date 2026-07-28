const PAGE_SIZE = 24;

let allProducts = [];
let filteredProducts = [];
let visibleCount = PAGE_SIZE;
let activeCategory = "Todos";

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#039;",
    '"': "&quot;"
  })[character]);
}

function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeHeader(value = "") {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getPrice(product) {
  const raw =
    product.precio ??
    product.price ??
    product.precioVenta ??
    product.precio_venta ??
    product.venta ??
    product.public_price;

  if (raw === null || raw === undefined || raw === "") {
    return null;
  }

  const value = Number(
    String(raw)
      .replace(/,/g, "")
      .replace(/[^0-9.-]/g, "")
  );

  return Number.isFinite(value) ? value : null;
}

function formatPrice(value) {
  return value === null
    ? "Cotizar"
    : new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN"
      }).format(value);
}

function parseCSV(csvText) {
  const rows = [];
  let currentRow = [];
  let currentValue = "";
  let insideQuotes = false;

  for (let index = 0; index < csvText.length; index++) {
    const character = csvText[index];
    const nextCharacter = csvText[index + 1];

    if (character === '"') {
      if (insideQuotes && nextCharacter === '"') {
        currentValue += '"';
        index++;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (character === "," && !insideQuotes) {
      currentRow.push(currentValue);
      currentValue = "";
      continue;
    }

    if (
      (character === "\n" || character === "\r") &&
      !insideQuotes
    ) {
      if (character === "\r" && nextCharacter === "\n") {
        index++;
      }

      currentRow.push(currentValue);

      if (currentRow.some(value => String(value).trim() !== "")) {
        rows.push(currentRow);
      }

      currentRow = [];
      currentValue = "";
      continue;
    }

    currentValue += character;
  }

  currentRow.push(currentValue);

  if (currentRow.some(value => String(value).trim() !== "")) {
    rows.push(currentRow);
  }

  return rows;
}

function csvToObjects(csvText) {
  const rows = parseCSV(csvText);

  if (rows.length < 2) {
    return [];
  }

  const headers = rows[0].map(normalizeHeader);

  return rows.slice(1).map(row => {
    const item = {};

    headers.forEach((header, index) => {
      item[header] = String(row[index] ?? "").trim();
    });

    return item;
  });
}

function shouldShowProduct(value) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return true;
  }

  return [
    "true",
    "si",
    "1",
    "x",
    "mostrar",
    "activo",
    "visible"
  ].includes(normalizedValue);
}

function normalizeImage(imageValue = "") {
  const image = String(imageValue).trim();

  if (!image) {
    return "";
  }

  if (/^https?:\/\//i.test(image)) {
    return image;
  }

  const cleanImage = image
    .replace(/^\.?\//, "")
    .replace(/^productos\//, "");

  if (cleanImage.startsWith("img/")) {
    return `/${encodeURI(cleanImage)}`;
  }

  return `${MOBEL_CONFIG.imageBaseUrl}${encodeURI(cleanImage)}`;
}

function normalizeProduct(product, index) {
  return {
    id:
      product.sku ||
      product.id ||
      `producto-${index + 1}`,

    nombre:
      product.nombre ||
      product.producto ||
      "Producto",

    categoria:
      product.categoria ||
      product.category ||
      "Otros",

    descripcion:
      product.descripcion ||
      product.description ||
      "",

    imagen: normalizeImage(
      product.imagen ||
      product.image ||
      product.foto ||
      ""
    ),

    unidad:
      product.presentacion ||
      product.unidad ||
      product.medida ||
      "",

    precio: getPrice(product),

    mostrar: shouldShowProduct(product.mostrar)
  };
}

function setupWhatsApp() {
  document.querySelectorAll("[data-whatsapp]").forEach(link => {
    link.href =
      `https://wa.me/${MOBEL_CONFIG.whatsappNumber}` +
      `?text=${encodeURIComponent(MOBEL_CONFIG.defaultMessage)}`;

    link.target = "_blank";
    link.rel = "noopener";
  });
}

function setupMenu() {
  const toggle = document.getElementById("menuToggle");
  const nav = document.getElementById("mainNav");

  if (!toggle || !nav) {
    return;
  }

  toggle.addEventListener("click", () => {
    nav.classList.toggle("open");

    toggle.setAttribute(
      "aria-expanded",
      String(nav.classList.contains("open"))
    );
  });
}

function renderSkeletons() {
  document.getElementById("catalogGrid").innerHTML =
    Array.from({ length: 8 }, () => `
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

  const categories = [
    "Todos",
    ...new Set(
      allProducts
        .map(product => product.categoria)
        .filter(Boolean)
    )
  ];

  categories.sort((a, b) => {
    if (a === "Todos") {
      return -1;
    }

    if (b === "Todos") {
      return 1;
    }

    return a.localeCompare(b, "es", {
      sensitivity: "base"
    });
  });

  holder.innerHTML = categories.map(category => `
    <button
      class="filter-btn ${category === activeCategory ? "active" : ""}"
      data-category="${escapeHtml(category)}"
      type="button"
    >
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

function productCard(product) {
  const detailUrl =
    `producto.html?id=${encodeURIComponent(product.id)}`;

  const message =
    `Hola, me interesa el producto: ${product.nombre}. ` +
    "¿Me pueden dar información?";

  const whatsappUrl =
    `https://wa.me/${MOBEL_CONFIG.whatsappNumber}` +
    `?text=${encodeURIComponent(message)}`;

  const description =
    product.descripcion ||
    (
      product.unidad
        ? `Presentación: ${product.unidad}`
        : "Solicita información y disponibilidad."
    );

  return `
    <article class="product-card">
      <a class="product-image" href="${detailUrl}">
        ${
          product.imagen
            ? `
              <img
                src="${escapeHtml(product.imagen)}"
                alt="${escapeHtml(product.nombre)}"
                loading="lazy"
                decoding="async"
              >
            `
            : `
              <div class="image-placeholder" aria-hidden="true">
                🧴
              </div>
            `
        }
      </a>

      <div class="product-content">
        <div class="product-meta">
          <span>${escapeHtml(product.categoria)}</span>
        </div>

        <h3>
          <a href="${detailUrl}">
            ${escapeHtml(product.nombre)}
          </a>
        </h3>

        <div class="product-price${
          product.precio === null
            ? " product-price-quote"
            : ""
        }">
          ${formatPrice(product.precio)}
        </div>

        <p>${escapeHtml(description)}</p>

        <div class="product-actions">
          <a class="btn btn-secondary" href="${detailUrl}">
            Ver producto
          </a>

          <a
            class="icon-btn"
            href="${whatsappUrl}"
            target="_blank"
            rel="noopener"
            aria-label="Consultar por WhatsApp"
          >
            <i class="fa-brands fa-whatsapp"></i>
          </a>
        </div>
      </div>
    </article>
  `;
}

function applyFilters() {
  const searchInput =
    document.getElementById("catalogSearch");

  const query = normalizeText(searchInput.value);

  filteredProducts = allProducts.filter(product => {
    const categoryMatch =
      activeCategory === "Todos" ||
      product.categoria === activeCategory;

    const searchableText = normalizeText(
      `${product.nombre} ${product.categoria} ${product.descripcion} ${product.unidad}`
    );

    return (
      categoryMatch &&
      (!query || searchableText.includes(query))
    );
  });

  renderProducts();
}

function renderProducts() {
  const grid = document.getElementById("catalogGrid");
  const empty = document.getElementById("catalogEmpty");
  const count = document.getElementById("catalogCount");
  const loadMore = document.getElementById("loadMoreBtn");

  const visibleProducts =
    filteredProducts.slice(0, visibleCount);

  grid.innerHTML =
    visibleProducts.map(productCard).join("");

  empty.hidden = filteredProducts.length > 0;

  count.textContent =
    `${filteredProducts.length} producto` +
    `${filteredProducts.length === 1 ? "" : "s"} encontrado` +
    `${filteredProducts.length === 1 ? "" : "s"}`;

  loadMore.hidden =
    visibleCount >= filteredProducts.length;
}

async function loadCatalog() {
  renderSkeletons();

  try {
    const separator =
      MOBEL_CONFIG.sheetCsvUrl.includes("?")
        ? "&"
        : "?";

    const response = await fetch(
      `${MOBEL_CONFIG.sheetCsvUrl}${separator}actualizacion=${Date.now()}`,
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error(`Error ${response.status}`);
    }

    const csvText = await response.text();
    const sheetProducts = csvToObjects(csvText);

    allProducts = sheetProducts
      .map(normalizeProduct)
      .filter(product =>
        product.nombre &&
        product.mostrar
      );

    const queryParams =
      new URLSearchParams(location.search);

    const requestedCategory =
      queryParams.get("categoria");

    const requestedSearch =
      queryParams.get("buscar");

    if (
      requestedCategory &&
      allProducts.some(
        product =>
          product.categoria === requestedCategory
      )
    ) {
      activeCategory = requestedCategory;
    }

    if (requestedSearch) {
      document.getElementById("catalogSearch").value =
        requestedSearch;
    }

    renderFilters();
    applyFilters();
  } catch (error) {
    console.error("Error al cargar Google Sheets:", error);

    document.getElementById("catalogGrid").innerHTML = "";

    const empty =
      document.getElementById("catalogEmpty");

    empty.hidden = false;

    empty.textContent =
      "No fue posible cargar el catálogo. Revisa que Google Sheets esté publicado en la web.";

    document.getElementById("loadMoreBtn").hidden = true;
  }
}

document
  .getElementById("catalogSearch")
  .addEventListener("input", () => {
    visibleCount = PAGE_SIZE;
    applyFilters();
  });

document
  .getElementById("loadMoreBtn")
  .addEventListener("click", () => {
    visibleCount += PAGE_SIZE;
    renderProducts();
  });

document.getElementById("year").textContent =
  new Date().getFullYear();

setupMenu();
setupWhatsApp();
loadCatalog();