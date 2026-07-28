function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;"
  })[character]);
}

function normalizeText(value = "") {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
function normalizeHeader(value = "") { return normalizeText(value).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""); }
function parseCSV(text) {
  const rows=[]; let row=[], value="", quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1]; if(c==='"'){if(quoted&&n==='"'){value+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(value);value="";}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&n==='\n')i++;row.push(value);if(row.some(x=>String(x).trim()!==""))rows.push(row);row=[];value="";}else value+=c;} row.push(value);if(row.some(x=>String(x).trim()!==""))rows.push(row);return rows;
}
function csvToObjects(text){const rows=parseCSV(text);if(rows.length<2)return[];const headers=rows[0].map(normalizeHeader);return rows.slice(1).map(row=>Object.fromEntries(headers.map((h,i)=>[h,String(row[i]??"").trim()])));}
function isTruthy(value, emptyDefault=false){const n=normalizeText(value);if(!n)return emptyDefault;return["true","verdadero","si","1","x","activo","visible","mostrar","destacado"].includes(n);}
function getPrice(product){const raw=product.precio??product.price??product.precio_venta;if(raw===null||raw===undefined||raw==="")return null;const value=Number(String(raw).replace(/,/g,"").replace(/[^0-9.-]/g,""));return Number.isFinite(value)?value:null;}
function formatPrice(value){return value===null?"Cotizar":new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"}).format(value);}
function normalizeImage(value=""){const image=String(value).trim();if(!image)return"";if(/^https?:\/\//i.test(image))return image;const clean=image.replace(/^\.?\//,"").replace(/^img\/productos\//i,"").replace(/^productos\//i,"");return`${MOBEL_CONFIG.imageBaseUrl}${encodeURI(clean)}`;}
function normalizeProduct(product,index){return{id:product.sku||product.id||`producto-${index+1}`,nombre:product.nombre||product.producto||"Producto",categoria:product.categoria||"Otros",descripcion:product.descripcion||"",imagen:normalizeImage(product.imagen||product.archivo_imagen_sugerido||product.foto||""),unidad:product.presentacion||product.unidad||"",precio:getPrice(product),mostrar:isTruthy(product.mostrar,true)};}
async function fetchProducts(){const separator=MOBEL_CONFIG.sheetCsvUrl.includes("?")?"&":"?";const response=await fetch(`${MOBEL_CONFIG.sheetCsvUrl}${separator}v=${Date.now()}`,{cache:"no-store"});if(!response.ok)throw new Error(`Error ${response.status}`);return csvToObjects(await response.text()).map(normalizeProduct).filter(p=>p.nombre&&p.mostrar);}

async function loadProduct() {
  const holder = document.getElementById("productDetail");
  const id = new URLSearchParams(window.location.search).get("id");
  if (!holder) return;
  if (!id) { holder.innerHTML = '<p class="empty-state">Producto no válido.</p>'; return; }
  try {
    const products = await fetchProducts();
    const product = products.find(item => String(item.id) === String(id));
    if (!product) throw new Error("Producto no encontrado");
    document.title = `${product.nombre} | MOBEL`;
    const message = `Hola, me interesa el producto: ${product.nombre}. ¿Me pueden dar información?`;
    const whatsappUrl = `https://wa.me/${MOBEL_CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`;
    const headerWhatsapp = document.getElementById("headerWhatsapp");
    if (headerWhatsapp) headerWhatsapp.href = whatsappUrl;
    holder.innerHTML = `<div class="product-detail-media">${product.imagen
      ? `<img src="${escapeHtml(product.imagen)}" alt="${escapeHtml(product.nombre)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="image-placeholder product-detail-placeholder" style="display:none">🧴</div>`
      : '<div class="image-placeholder product-detail-placeholder">🧴</div>'}</div>
      <div class="product-detail-content"><span class="product-category">${escapeHtml(product.categoria || "Producto")}</span>
      <h1>${escapeHtml(product.nombre)}</h1><div class="product-detail-price${product.precio === null ? " product-price-quote" : ""}">${formatPrice(product.precio)}</div>
      ${product.unidad ? `<p class="product-meta"><strong>Presentación:</strong> ${escapeHtml(product.unidad)}</p>` : ""}
      <p>${escapeHtml(product.descripcion || "Solicita información, presentación y disponibilidad por WhatsApp.")}</p>
      <a class="btn btn-primary" href="${whatsappUrl}" target="_blank" rel="noopener">Solicitar información</a></div>`;
  } catch (error) {
    console.error(error);
    holder.innerHTML = '<p class="empty-state">No fue posible encontrar este producto.</p>';
  }
}
const year=document.getElementById("year");if(year)year.textContent=new Date().getFullYear();loadProduct();
