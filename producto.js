function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;"
  })[character]);
}


function getPrice(product) {
  const raw = product.precio ?? product.price ?? product.precioVenta ?? product.precio_venta ?? product.venta ?? product.public_price;
  if (raw === null || raw === undefined || raw === "") return null;
  const value = Number(String(raw).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(value) ? value : null;
}

function formatPrice(value) {
  return value === null
    ? "Cotizar"
    : new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);
}

async function loadProduct() {
  const holder = document.getElementById("productDetail");
  const id = new URLSearchParams(window.location.search).get("id");

  if (!id || !/^\d+$/.test(id)) {
    holder.innerHTML = '<p class="empty-state">Producto no válido.</p>';
    return;
  }

  try {
    const response = await fetch(`${MOBEL_CONFIG.apiUrl}/productos/${id}`);
    if (response.status === 404) throw new Error("Producto no encontrado");
    if (!response.ok) throw new Error(`Error ${response.status}`);

    const data = await response.json();
    const product = data.producto;
    document.title = `${product.nombre} | MOBEL`;

    const message = `Hola, me interesa el producto: ${product.nombre}. ¿Me pueden dar información?`;
    const whatsappUrl = `https://wa.me/${MOBEL_CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`;
    document.getElementById("headerWhatsapp").href = whatsappUrl;

    holder.innerHTML = `
      <div class="product-detail-media">
        ${product.imagen
          ? `<img src="${escapeHtml(product.imagen)}" alt="${escapeHtml(product.nombre)}">`
          : '<div class="image-placeholder product-detail-placeholder">🧴</div>'}
      </div>
      <div class="product-detail-content">
        <span class="product-category">${escapeHtml(product.categoria || "Producto")}</span>
        <h1>${escapeHtml(product.nombre)}</h1>
        <div class="product-detail-price${getPrice(product) === null ? " product-price-quote" : ""}">${formatPrice(getPrice(product))}</div>
        ${product.unidad ? `<p class="product-meta"><strong>Unidad:</strong> ${escapeHtml(product.unidad)}</p>` : ""}
        <p>${escapeHtml(product.descripcion || "Solicita información, presentación y disponibilidad por WhatsApp.")}</p>
        <a class="btn btn-primary" href="${whatsappUrl}" target="_blank" rel="noopener">Solicitar información</a>
      </div>`;
  } catch (error) {
    console.error(error);
    holder.innerHTML = '<p class="empty-state">No fue posible encontrar este producto.</p>';
  }
}

document.getElementById("year").textContent = new Date().getFullYear();
loadProduct();
