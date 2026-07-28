const HOME_PRODUCT_LIMIT = 8;
let revealObserver;

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

function parseCSV(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const character = text[i];
    const next = text[i + 1];

    if (character === '"') {
      if (quoted && next === '"') {
        value += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") i++;
      row.push(value);

      if (row.some(item => String(item).trim() !== "")) rows.push(row);

      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  row.push(value);
  if (row.some(item => String(item).trim() !== "")) rows.push(row);

  return rows;
}

function csvToObjects(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) return [];

  const headers = rows[0].map(normalizeHeader);

  return rows.slice(1).map(row =>
    Object.fromEntries(headers.map((header, index) => [
      header,
      String(row[index] ?? "").trim()
    ]))
  );
}

function isTruthy(value, emptyDefault = false) {
  const normalized = normalizeText(value);
  if (!normalized) return emptyDefault;

  return [
    "true",
    "verdadero",
    "si",
    "1",
    "x",
    "activo",
    "visible",
    "mostrar",
    "destacado"
  ].includes(normalized);
}

function getPrice(product) {
  const raw = product.precio ?? product.price ?? product.precio_venta;

  if (raw === null || raw === undefined || raw === "") return null;

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

function normalizeImage(value = "") {
  const image = String(value).trim();
  if (!image) return "";
  if (/^https?:\/\//i.test(image)) return image;

  const clean = image
    .replace(/^\.?\//, "")
    .replace(/^img\/productos\//i, "")
    .replace(/^productos\//i, "");

  return `${MOBEL_CONFIG.imageBaseUrl}${encodeURI(clean)}`;
}

function normalizeProduct(product, index) {
  return {
    id: product.sku || product.id || `producto-${index + 1}`,
    nombre: product.nombre || product.producto || "Producto",
    categoria: product.categoria || "Otros",
    descripcion: product.descripcion || "",
    imagen: normalizeImage(
      product.imagen ||
      product.archivo_imagen_sugerido ||
      product.foto ||
      ""
    ),
    unidad: product.presentacion || product.unidad || "",
    precio: getPrice(product),
    destacado: isTruthy(product.destacado, false),
    mostrar: isTruthy(product.mostrar, true)
  };
}

async function fetchProducts() {
  const separator = MOBEL_CONFIG.sheetCsvUrl.includes("?") ? "&" : "?";
  const response = await fetch(
    `${MOBEL_CONFIG.sheetCsvUrl}${separator}v=${Date.now()}`,
    { cache: "no-store" }
  );

  if (!response.ok) throw new Error(`Error ${response.status}`);

  return csvToObjects(await response.text())
    .map(normalizeProduct)
    .filter(product => product.nombre && product.mostrar);
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
  }, {
    threshold: 0.08,
    rootMargin: "0px 0px -30px 0px"
  });

  elements.forEach(observeReveal);
}

function setupWhatsApp() {
  document.querySelectorAll("[data-whatsapp]").forEach(link => {
    link.href = `https://wa.me/${MOBEL_CONFIG.whatsappNumber}?text=${encodeURIComponent(MOBEL_CONFIG.defaultMessage)}`;
    link.target = "_blank";
    link.rel = "noopener";
  });
}

function getCategoryIcon(category) {
  const name = normalizeText(category);

  if (name.includes("detergente") || name.includes("liquido")) return "fa-pump-soap";
  if (name.includes("bano") || name.includes("higien") || name.includes("papel")) return "fa-toilet-paper";
  if (name.includes("guante") || name.includes("proteccion")) return "fa-mitten";
  if (name.includes("envase") || name.includes("atomizador")) return "fa-spray-can-sparkles";
  if (name.includes("escoba") || name.includes("trapeador")) return "fa-broom";
  if (name.includes("aromat")) return "fa-wind";
  if (name.includes("bolsa")) return "fa-bag-shopping";
  if (name.includes("cepillo") || name.includes("fibra")) return "fa-brush";
  if (name.includes("cesto") || name.includes("cubeta")) return "fa-bucket";
  if (name.includes("despachador")) return "fa-soap";
  if (name.includes("lavander")) return "fa-shirt";
  if (name.includes("automotriz")) return "fa-car";

  return "fa-box-open";
}

function injectCategoryStyles() {
  if (document.getElementById("mobel-category-styles")) return;

  const style = document.createElement("style");
  style.id = "mobel-category-styles";
  style.textContent = `
    #categoriesGrid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 18px;
    }

    .category-card-simple {
      position: relative;
      min-height: 185px;
      padding: 26px;
      border: 1px solid #e5eaf0;
      border-radius: 20px;
      background: #ffffff;
      color: #102d50;
      text-decoration: none;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: space-between;
      overflow: hidden;
      box-shadow: 0 8px 24px rgba(16, 45, 80, 0.06);
      transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
    }

    .category-card-simple::after {
      content: "";
      position: absolute;
      width: 105px;
      height: 105px;
      right: -38px;
      top: -38px;
      border-radius: 50%;
      background: rgba(88, 181, 45, 0.10);
      transition: transform 0.25s ease;
    }

    .category-card-simple:hover {
      transform: translateY(-5px);
      border-color: rgba(88, 181, 45, 0.55);
      box-shadow: 0 18px 38px rgba(16, 45, 80, 0.12);
    }

    .category-card-simple:hover::after {
      transform: scale(1.15);
    }

    .category-icon-simple {
      width: 52px;
      height: 52px;
      border-radius: 15px;
      background: #eef7e9;
      color: #55ad2c;
      display: grid;
      place-items: center;
      font-size: 23px;
      position: relative;
      z-index: 1;
    }

    .category-card-simple h3 {
      margin: 22px 0 7px;
      color: #102d50;
      font-size: 20px;
      line-height: 1.2;
    }

    .category-card-simple p {
      margin: 0;
      color: #6f7d8d;
      font-size: 14px;
    }

    .category-link-simple {
      margin-top: 18px;
      color: #102d50;
      font-size: 14px;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    @media (max-width: 980px) {
      #categoriesGrid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 560px) {
      #categoriesGrid {
        grid-template-columns: 1fr;
        gap: 14px;
      }

      .category-card-simple {
        min-height: 155px;
        padding: 22px;
      }
    }
  `;

  document.head.appendChild(style);
}

function renderCategories(products) {
  const holder = document.getElementById("categoriesGrid");
  if (!holder) return;

  injectCategoryStyles();

  const categoryCounts = products.reduce((counts, product) => {
    const category = String(product.categoria || "Otros").trim();
    counts[category] = (counts[category] || 0) + 1;
    return counts;
  }, {});

  const categories = Object.keys(categoryCounts)
    .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }))
    .slice(0, 8);

  holder.innerHTML = categories.map(category => {
    const total = categoryCounts[category];
    const productLabel = total === 1 ? "producto" : "productos";

    return `
      <a
        class="category-card-simple reveal"
        href="catalogo.html?categoria=${encodeURIComponent(category)}"
        aria-label="Ver productos de ${escapeHtml(category)}"
      >
        <div>
          <div class="category-icon-simple" aria-hidden="true">
            <i class="fa-solid ${getCategoryIcon(category)}"></i>
          </div>

          <h3>${escapeHtml(category)}</h3>
          <p>${total} ${productLabel}</p>
        </div>

        <span class="category-link-simple">
          Ver productos
          <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
        </span>
      </a>
    `;
  }).join("");

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
    const message = `Hola, me interesa el producto: ${product.nombre}. ¿Me pueden dar información?`;
    const whatsappUrl = `https://wa.me/${MOBEL_CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`;
    const description = product.descripcion || (
      product.unidad
        ? `Presentación: ${product.unidad}`
        : "Solicita información y disponibilidad."
    );

    const card = document.createElement("article");
    card.className = "product-card reveal";
    card.innerHTML = `
      <a class="product-image" href="${detailUrl}">
        ${product.imagen
          ? `<img
              src="${escapeHtml(product.imagen)}"
              alt="${escapeHtml(product.nombre)}"
              loading="${index < 2 ? "eager" : "lazy"}"
              decoding="async"
              onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
            ><div class="image-placeholder" style="display:none">🧴</div>`
          : `<div class="image-placeholder">🧴</div>`}
      </a>

      <div class="product-content">
        <div class="product-meta">
          <span>${escapeHtml(product.categoria)}</span>
        </div>

        <h3><a href="${detailUrl}">${escapeHtml(product.nombre)}</a></h3>

        <div class="product-price${product.precio === null ? " product-price-quote" : ""}">
          ${formatPrice(product.precio)}
        </div>

        <p>${escapeHtml(description)}</p>

        <div class="product-actions">
          <a class="btn btn-secondary" href="${detailUrl}">Ver producto</a>
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
    `;

    grid.appendChild(card);
    observeReveal(card);
  });
}

async function loadHomeProducts() {
  renderSkeletons();

  try {
    const products = await fetchProducts();
    const featured = products.filter(product => product.destacado);

    renderFeatured(featured.length ? featured : products);
    renderCategories(products);

    const count = document.getElementById("productCount");
    if (count) count.textContent = `+${products.length}`;
  } catch (error) {
    console.error(error);

    const grid = document.getElementById("productsGrid");
    if (grid) grid.innerHTML = "";

    const empty = document.getElementById("emptyState");
    if (empty) {
      empty.hidden = false;
      empty.textContent = "No fue posible cargar los productos destacados.";
    }
  }
}

function setupUseCategoriesCarousel() {
  const track = document.getElementById("useCategoriesTrack");
  const previous = document.querySelector(".use-carousel-prev");
  const next = document.querySelector(".use-carousel-next");

  if (!track || !previous || !next) return;

  const updateButtons = () => {
    const maxScroll = track.scrollWidth - track.clientWidth;
    previous.disabled = track.scrollLeft <= 4;
    next.disabled = track.scrollLeft >= maxScroll - 4;
  };

  const move = direction => {
    track.scrollBy({
      left: direction * Math.max(track.clientWidth * 0.65, 280),
      behavior: "smooth"
    });
  };

  previous.addEventListener("click", () => move(-1));
  next.addEventListener("click", () => move(1));
  track.addEventListener("scroll", updateButtons, { passive: true });
  window.addEventListener("resize", updateButtons);
  requestAnimationFrame(updateButtons);
}

function setupMenu() {
  const toggle = document.getElementById("menuToggle");
  const nav = document.getElementById("mainNav");

  if (!toggle || !nav) return;

  toggle.addEventListener("click", () => {
    nav.classList.toggle("open");
    toggle.setAttribute(
      "aria-expanded",
      String(nav.classList.contains("open"))
    );
  });

  nav.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => nav.classList.remove("open"));
  });
}

const year = document.getElementById("year");
if (year) year.textContent = new Date().getFullYear();

setupScrollAnimations();
setupMenu();
setupWhatsApp();
setupUseCategoriesCarousel();
loadHomeProducts();
