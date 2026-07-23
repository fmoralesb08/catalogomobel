function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;"
  })[character]);
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

    const message = `Hola, me interesa el producto: ${product.nombre}${product.sku ? ` (SKU: ${product.sku})` : ""}. ¿Me pueden dar información?`;
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
        ${product.sku ? `<p class="product-meta"><strong>SKU:</strong> ${escapeHtml(product.sku)}</p>` : ""}
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
