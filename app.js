const HOME_PRODUCT_LIMIT = 8;
const CACHE_KEY = "mobel_products_cache_v3";
const CACHE_TTL = 30 * 60 * 1000;
const QUOTE_KEY = "mobel_quote_cart_v1";
let revealObserver;
let homeProducts = [];

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;"
  })[character]);
}
function normalizeText(value = "") { return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); }
function normalizeHeader(value = "") { return normalizeText(value).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""); }
function parseCategories(value = "") { const list = String(value).split("|").map(v => v.trim()).filter(Boolean); return list.length ? [...new Set(list)] : ["Otros"]; }
function formatCategories(categories = []) { return categories.join(" · "); }
function parseCSV(text) {
  const rows = []; let row = [], value = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (c === '"') { if (quoted && n === '"') { value += '"'; i++; } else quoted = !quoted; }
    else if (c === "," && !quoted) { row.push(value); value = ""; }
    else if ((c === "\n" || c === "\r") && !quoted) { if (c === "\r" && n === "\n") i++; row.push(value); if (row.some(x => String(x).trim())) rows.push(row); row = []; value = ""; }
    else value += c;
  }
  row.push(value); if (row.some(x => String(x).trim())) rows.push(row); return rows;
}
function csvToObjects(text) { const rows = parseCSV(text); if (rows.length < 2) return []; const headers = rows[0].map(normalizeHeader); return rows.slice(1).map(row => Object.fromEntries(headers.map((h, i) => [h, String(row[i] ?? "").trim()]))); }
function isTruthy(value, emptyDefault = false) { const n = normalizeText(value); if (!n) return emptyDefault; return ["true","verdadero","si","1","x","activo","visible","mostrar","destacado"].includes(n); }
function getPrice(product) { const raw = product.precio ?? product.price ?? product.precio_venta; if (raw === null || raw === undefined || raw === "") return null; const value = Number(String(raw).replace(/,/g, "").replace(/[^0-9.-]/g, "")); return Number.isFinite(value) ? value : null; }
function formatPrice(value) { return value === null ? "Cotizar" : new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value); }
function normalizeImage(value = "") { const image = String(value).trim(); if (!image) return ""; if (/^https?:\/\//i.test(image)) return image; const clean = image.replace(/^\.?\//, "").replace(/^img\/productos\//i, "").replace(/^productos\//i, ""); return `${MOBEL_CONFIG.imageBaseUrl}${encodeURI(clean)}`; }
function normalizeProduct(product, index) {
  const categorias = parseCategories(product.categoria || product.category || "Otros");
  return {
    id: product.sku || product.id || `producto-${index + 1}`,
    nombre: product.nombre || product.producto || "Producto",
    categorias, categoria: categorias[0],
    descripcion: product.descripcion || product.description || "",
    imagen: normalizeImage(product.imagen || product.archivo_imagen_sugerido || product.foto || product.image || ""),
    unidad: product.presentacion || product.unidad || product.medida || "",
    marca: product.marca || product.brand || "",
    precio: getPrice(product),
    destacado: isTruthy(product.destacado, false),
    etiqueta: product.etiqueta || product.label || "",
    orden: Number(product.orden || 9999),
    mostrar: isTruthy(product.mostrar ?? product.activo, true)
  };
}
function readCache() { try { const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); return cached && Array.isArray(cached.products) ? cached : null; } catch { return null; } }
function writeCache(products) { try { localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), products })); } catch {} }
async function fetchFreshProducts() {
  const separator = MOBEL_CONFIG.sheetCsvUrl.includes("?") ? "&" : "?";
  const response = await fetch(`${MOBEL_CONFIG.sheetCsvUrl}${separator}v=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Error ${response.status}`);
  const products = csvToObjects(await response.text()).map(normalizeProduct).filter(p => p.nombre && p.mostrar).sort((a,b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es"));
  writeCache(products); return products;
}
async function fetchProducts() {
  const cached = readCache();
  if (cached) {
    if (Date.now() - cached.timestamp > CACHE_TTL) fetchFreshProducts().catch(() => {});
    return cached.products;
  }
  return fetchFreshProducts();
}
function observeReveal(element) { if (!element) return; if (revealObserver) revealObserver.observe(element); else element.classList.add("in-view"); }
function setupScrollAnimations() {
  const elements = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) { elements.forEach(e => e.classList.add("in-view")); return; }
  revealObserver = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add("in-view"); revealObserver.unobserve(entry.target); } }), { threshold: 0.08, rootMargin: "0px 0px -30px 0px" });
  elements.forEach(observeReveal);
}
function setupWhatsApp() { document.querySelectorAll("[data-whatsapp]").forEach(link => { link.href = `https://wa.me/${MOBEL_CONFIG.whatsappNumber}?text=${encodeURIComponent(MOBEL_CONFIG.defaultMessage)}`; link.target = "_blank"; link.rel = "noopener"; }); }
function getQuote() { try { return JSON.parse(localStorage.getItem(QUOTE_KEY) || "[]"); } catch { return []; } }
function saveQuote(items) { localStorage.setItem(QUOTE_KEY, JSON.stringify(items)); updateQuoteBar(); }
function addToQuote(product) { const items = getQuote(); if (!items.some(item => String(item.id) === String(product.id))) items.push({ id: product.id, nombre: product.nombre }); saveQuote(items); }
function removeFromQuote(id) { saveQuote(getQuote().filter(item => String(item.id) !== String(id))); }
function sendQuote() { const items = getQuote(); if (!items.length) return; const message = `Hola, me interesa cotizar:\n\n${items.map(item => `• ${item.nombre}`).join("\n")}\n\nGracias.`; window.open(`https://wa.me/${MOBEL_CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`, "_blank", "noopener"); }
function updateQuoteBar() {
  const bar = document.getElementById("mobelQuoteBar"); if (!bar) return;
  const items = getQuote(); bar.hidden = items.length === 0;
  const count = bar.querySelector("[data-quote-count]"); if (count) count.textContent = items.length;
  const list = bar.querySelector("[data-quote-list]"); if (list) list.innerHTML = items.map(item => `<button type="button" data-remove-quote="${escapeHtml(item.id)}" title="Quitar">${escapeHtml(item.nombre)} ×</button>`).join("");
}
function setupQuoteBar() {
  if (document.getElementById("mobelQuoteBar")) return;
  const bar = document.createElement("aside"); bar.id = "mobelQuoteBar"; bar.hidden = true;
  bar.innerHTML = `<div class="mobel-quote-inner"><div><strong>Cotización (<span data-quote-count>0</span>)</strong><div class="mobel-quote-list" data-quote-list></div></div><button class="mobel-quote-send" type="button">Enviar por WhatsApp</button></div>`;
  document.body.appendChild(bar);
  bar.addEventListener("click", event => { const remove = event.target.closest("[data-remove-quote]"); if (remove) removeFromQuote(remove.dataset.removeQuote); if (event.target.closest(".mobel-quote-send")) sendQuote(); });
  injectV3Styles(); updateQuoteBar();
}
function injectV3Styles() {
  if (document.getElementById("mobel-v3-styles")) return;
  const style = document.createElement("style"); style.id = "mobel-v3-styles"; style.textContent = `
  .mobel-search-section{max-width:1120px;margin:32px auto 42px;padding:0 20px}.mobel-search-box{background:#fff;border:1px solid #e4eaf0;border-radius:22px;padding:28px;box-shadow:0 14px 40px rgba(16,45,80,.08);position:relative}.mobel-search-box h2{margin:0 0 8px;color:#102d50}.mobel-search-box p{margin:0 0 18px;color:#667085}.mobel-search-row{display:flex;gap:10px}.mobel-search-input-wrap{position:relative;flex:1}.mobel-search-input{width:100%;height:54px;border:1px solid #d7dee7;border-radius:14px;padding:0 18px;font-size:16px;outline:none}.mobel-search-input:focus{border-color:#58b52d;box-shadow:0 0 0 4px rgba(88,181,45,.12)}.mobel-search-submit{height:54px;border:0;border-radius:14px;padding:0 26px;background:#58b52d;color:#fff;font-weight:800;cursor:pointer}.mobel-suggestions{position:absolute;z-index:50;left:0;right:0;top:60px;background:#fff;border:1px solid #e1e7ed;border-radius:14px;box-shadow:0 18px 45px rgba(16,45,80,.16);overflow:hidden}.mobel-suggestions[hidden]{display:none}.mobel-suggestion{display:flex;gap:12px;align-items:center;width:100%;padding:12px 15px;border:0;border-bottom:1px solid #eef1f4;background:#fff;text-align:left;cursor:pointer}.mobel-suggestion:last-child{border-bottom:0}.mobel-suggestion:hover{background:#f7faf5}.mobel-suggestion img{width:44px;height:44px;object-fit:contain;border-radius:8px}.mobel-suggestion strong{display:block;color:#102d50}.mobel-suggestion small{color:#697586}.mobel-quick-search{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}.mobel-quick-search button{border:1px solid #dce3e9;background:#f8fafb;border-radius:999px;padding:8px 13px;cursor:pointer;color:#102d50}.mobel-quick-search button:hover{border-color:#58b52d}.product-label{position:absolute;top:12px;left:12px;z-index:2;background:#102d50;color:#fff;padding:6px 9px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:.04em}.product-image{position:relative}.quote-add-btn{width:100%;margin-top:10px;border:1px solid #58b52d;background:#fff;color:#2f7613;border-radius:10px;padding:10px;font-weight:700;cursor:pointer}.quote-add-btn:hover{background:#f2faee}.mobel-quote-inner{max-width:1120px;margin:auto;display:flex;align-items:center;justify-content:space-between;gap:16px}.mobel-quote-list{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.mobel-quote-list button{border:0;background:rgba(255,255,255,.14);color:#fff;border-radius:999px;padding:5px 9px;cursor:pointer}.mobel-quote-send{border:0;border-radius:12px;background:#58b52d;color:#fff;padding:13px 18px;font-weight:800;white-space:nowrap;cursor:pointer}#mobelQuoteBar{position:fixed;z-index:999;left:0;right:0;bottom:0;background:#102d50;color:#fff;padding:14px 20px;box-shadow:0 -8px 28px rgba(0,0,0,.18)}@media(max-width:640px){.mobel-search-row{flex-direction:column}.mobel-search-submit{width:100%}.mobel-search-box{padding:22px 18px}.mobel-quote-inner{align-items:flex-start;flex-direction:column}.mobel-quote-send{width:100%}}
  `; document.head.appendChild(style);
}
function injectCategoryStyles() {
  if (document.getElementById("mobel-category-styles")) return;
  const style = document.createElement("style"); style.id = "mobel-category-styles"; style.textContent = `#categoriesGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}.category-card-simple{min-height:120px;padding:24px;border:1px solid #e5eaf0;border-radius:18px;background:#fff;color:#102d50;text-decoration:none;display:flex;flex-direction:column;align-items:flex-start;justify-content:space-between;box-shadow:0 8px 24px rgba(16,45,80,.05);transition:.25s}.category-card-simple:hover{transform:translateY(-4px);border-color:rgba(88,181,45,.55);box-shadow:0 16px 34px rgba(16,45,80,.11)}.category-card-simple h3{margin:0;color:#102d50;font-size:20px}.category-link-simple{margin-top:22px;color:#102d50;font-size:14px;font-weight:700;display:inline-flex;align-items:center;gap:8px}@media(max-width:980px){#categoriesGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){#categoriesGrid{grid-template-columns:1fr;gap:14px}.category-card-simple{min-height:105px;padding:21px}}`; document.head.appendChild(style);
}
function renderCategories(products) { const holder = document.getElementById("categoriesGrid"); if (!holder) return; injectCategoryStyles(); const categories = [...new Set(products.flatMap(p => p.categorias).filter(Boolean))].sort((a,b) => a.localeCompare(b,"es",{sensitivity:"base"})).slice(0,8); holder.innerHTML = categories.map(category => `<a class="category-card-simple reveal" href="catalogo.html?categoria=${encodeURIComponent(category)}"><h3>${escapeHtml(category)}</h3><span class="category-link-simple">Ver productos <i class="fa-solid fa-arrow-right"></i></span></a>`).join(""); holder.querySelectorAll(".reveal").forEach(observeReveal); }
function renderSkeletons() { const grid = document.getElementById("productsGrid"); if (!grid) return; grid.innerHTML = Array.from({length:HOME_PRODUCT_LIMIT},()=>`<article class="product-card product-skeleton"><div class="skeleton-image"></div><div class="product-content"><div class="skeleton-line skeleton-small"></div><div class="skeleton-line skeleton-title"></div><div class="skeleton-line"></div><div class="skeleton-line skeleton-button"></div></div></article>`).join(""); }
function renderFeatured(products) {
  const grid = document.getElementById("productsGrid"), empty = document.getElementById("emptyState"); if (!grid) return;
  const featured = products.slice(0, HOME_PRODUCT_LIMIT); grid.innerHTML = ""; if (empty) empty.hidden = featured.length > 0;
  featured.forEach((product,index) => { const detailUrl=`producto.html?id=${encodeURIComponent(product.id)}`; const message=`Hola, me interesa el producto: ${product.nombre}. ¿Me pueden dar información?`; const whatsappUrl=`https://wa.me/${MOBEL_CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`; const description=product.descripcion||(product.unidad?`Presentación: ${product.unidad}`:"Solicita información y disponibilidad."); const card=document.createElement("article"); card.className="product-card reveal"; card.innerHTML=`<a class="product-image" href="${detailUrl}">${product.etiqueta?`<span class="product-label">${escapeHtml(product.etiqueta)}</span>`:""}${product.imagen?`<img src="${escapeHtml(product.imagen)}" alt="${escapeHtml(product.nombre)}" loading="${index<2?"eager":"lazy"}" decoding="async" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="image-placeholder" style="display:none">🧴</div>`:`<div class="image-placeholder">🧴</div>`}</a><div class="product-content"><div class="product-meta"><span>${escapeHtml(formatCategories(product.categorias))}</span></div><h3><a href="${detailUrl}">${escapeHtml(product.nombre)}</a></h3><div class="product-price${product.precio===null?" product-price-quote":""}">${formatPrice(product.precio)}</div><p>${escapeHtml(description)}</p><div class="product-actions"><a class="btn btn-secondary" href="${detailUrl}">Ver producto</a><a class="icon-btn" href="${whatsappUrl}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i></a></div><button class="quote-add-btn" type="button" data-add-quote="${escapeHtml(product.id)}">Agregar a cotización</button></div>`; grid.appendChild(card); observeReveal(card); });
  grid.addEventListener("click", event => { const button=event.target.closest("[data-add-quote]"); if (!button) return; const product=homeProducts.find(p=>String(p.id)===String(button.dataset.addQuote)); if (product) { addToQuote(product); button.textContent="Agregado ✓"; setTimeout(()=>button.textContent="Agregar a cotización",1200); } }, { once:false });
}
function setupHomeSearch(products) {
  if (document.getElementById("mobelHomeSearch")) return;
  const anchor = document.getElementById("categoriesGrid")?.closest("section") || document.getElementById("productsGrid")?.closest("section"); if (!anchor) return;
  const section = document.createElement("section"); section.id="mobelHomeSearch"; section.className="mobel-search-section"; section.innerHTML=`<div class="mobel-search-box"><h2>Encuentra el producto que necesitas</h2><p>Busca por nombre, categoría, presentación o marca.</p><form class="mobel-search-row"><div class="mobel-search-input-wrap"><input class="mobel-search-input" type="search" placeholder="Cloro, escobas, bolsas..." autocomplete="off" aria-label="Buscar productos"><div class="mobel-suggestions" hidden></div></div><button class="mobel-search-submit" type="submit">Buscar</button></form><div class="mobel-quick-search"><button type="button">Cloro</button><button type="button">Bolsas</button><button type="button">Papel</button><button type="button">Detergente</button><button type="button">Escobas</button></div></div>`;
  anchor.parentNode.insertBefore(section, anchor);
  const input=section.querySelector("input"), suggestions=section.querySelector(".mobel-suggestions");
  const go = value => { const query=String(value||"").trim(); if (query) location.href=`catalogo.html?buscar=${encodeURIComponent(query)}`; else location.href="catalogo.html"; };
  section.querySelector("form").addEventListener("submit", e=>{e.preventDefault();go(input.value);});
  section.querySelectorAll(".mobel-quick-search button").forEach(btn=>btn.addEventListener("click",()=>go(btn.textContent)));
  input.addEventListener("input",()=>{ const q=normalizeText(input.value); if(q.length<2){suggestions.hidden=true;return;} const matches=products.filter(p=>normalizeText(`${p.nombre} ${formatCategories(p.categorias)} ${p.descripcion} ${p.unidad} ${p.marca}`).includes(q)).slice(0,6); suggestions.innerHTML=matches.map(p=>`<button class="mobel-suggestion" type="button" data-id="${escapeHtml(p.id)}">${p.imagen?`<img src="${escapeHtml(p.imagen)}" alt="">`:""}<span><strong>${escapeHtml(p.nombre)}</strong><small>${escapeHtml(formatCategories(p.categorias))}</small></span></button>`).join(""); suggestions.hidden=!matches.length; });
  suggestions.addEventListener("click",e=>{const btn=e.target.closest("[data-id]");if(btn)location.href=`producto.html?id=${encodeURIComponent(btn.dataset.id)}`;});
  document.addEventListener("click",e=>{if(!section.contains(e.target))suggestions.hidden=true;});
}
async function loadHomeProducts() { renderSkeletons(); try { const products=await fetchProducts(); homeProducts=products; const featured=products.filter(p=>p.destacado); renderFeatured(featured.length?featured:products); renderCategories(products); setupHomeSearch(products); const count=document.getElementById("productCount"); if(count)count.textContent=`+${products.length}`; } catch(error){console.error(error);const grid=document.getElementById("productsGrid");if(grid)grid.innerHTML="";const empty=document.getElementById("emptyState");if(empty){empty.hidden=false;empty.textContent="No fue posible cargar los productos destacados.";}} }
function setupUseCategoriesCarousel(){const track=document.getElementById("useCategoriesTrack"),previous=document.querySelector(".use-carousel-prev"),next=document.querySelector(".use-carousel-next");if(!track||!previous||!next)return;const update=()=>{const max=track.scrollWidth-track.clientWidth;previous.disabled=track.scrollLeft<=4;next.disabled=track.scrollLeft>=max-4;};const move=d=>track.scrollBy({left:d*Math.max(track.clientWidth*.65,280),behavior:"smooth"});previous.addEventListener("click",()=>move(-1));next.addEventListener("click",()=>move(1));track.addEventListener("scroll",update,{passive:true});window.addEventListener("resize",update);requestAnimationFrame(update);}
function setupMenu(){const toggle=document.getElementById("menuToggle"),nav=document.getElementById("mainNav");if(!toggle||!nav)return;toggle.addEventListener("click",()=>{nav.classList.toggle("open");toggle.setAttribute("aria-expanded",String(nav.classList.contains("open")));});nav.querySelectorAll("a").forEach(link=>link.addEventListener("click",()=>nav.classList.remove("open")));}
const year=document.getElementById("year");if(year)year.textContent=new Date().getFullYear();injectV3Styles();setupScrollAnimations();setupMenu();setupWhatsApp();setupUseCategoriesCarousel();setupQuoteBar();loadHomeProducts();
