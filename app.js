import { setupProductGallery } from "./product-gallery.js";
import {
  products,
  materials,
  contact,
  site,
  loadContent,
  availableMaterials,
} from "./data.js";
import { validate, message, whatsappLink } from "./quote.js";
const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const drafts = {};
let selected;
const gallery = setupProductGallery({
  container: $("#cards"),
  dialog: $("#product-lightbox"),
  getProduct: (id) => products.find((product) => product.id === id),
});
function cards(category = "Todos") {
  const list = products.filter(
    (p) => category === "Todos" || p.category === category,
  );
  $("#cards").innerHTML = list.length
    ? list
        .map(
          (p, i) =>
            `<article>${gallery.renderCard(p, i % 3)}<div class="card-label"><div><h3>${esc(p.name)}</h3><p>${esc(p.reference || "Color y disponibilidad a consultar")}</p></div><button class="text-button" data-product="${p.id}">Personalizar</button></div></article>`,
        )
        .join("")
    : "<p>No hay productos para mostrar por el momento. Consultanos para conocer las opciones.</p>";
}
function renderSite() {
  document.title = site.name + " · Hecho para tu espacio";
  const lines = (value) => esc(value).replace(/\n/g, "<br>");
  $(".hero-copy .eyebrow").textContent = site.tagline;
  $(".hero-copy h1").innerHTML = lines(site.heroTitle);
  $(".hero-copy p").textContent = site.heroDescription;
  $(".hero-copy small").textContent = site.shipping;
  $(".hero-copy .button").innerHTML = esc(site.heroButton) + " <span>↗</span>";
  $(".section-title .eyebrow").textContent = site.collectionEyebrow;
  $(".contact .eyebrow").textContent = site.contactEyebrow;
  $(".process").innerHTML = site.steps
    .map(
      (step) =>
        `<div><span>${esc(step.title)}</span><p>${esc(step.description)}</p></div>`,
    )
    .join("");
  $(".section-title h2").textContent = site.collectionTitle;
  $(".section-title p").textContent = site.collectionDescription;
  $(".contact h2").innerHTML = lines(site.contactTitle);
  $(".contact p").textContent = site.contactDescription;
  $(".contact p:nth-of-type(2)").textContent = contact.people.join(" · ");
  const phone = $(".contact>a");
  phone.textContent = contact.display;
  phone.href = "tel:" + contact.display.replace(/[^\d+]/g, "");
  document
    .querySelectorAll(".brand")
    .forEach((n) => (n.textContent = site.name));
  $("footer span").textContent = site.name;
  $("footer span:nth-child(2)").textContent = site.footer;
  $('meta[name="description"]').content = site.heroDescription;
  if (site.heroImage)
    $(".hero-art").innerHTML =
      `<img src="${esc(site.heroImage)}" alt="${esc(site.name)}: colección de muebles">`;
  const direct = whatsappLink(
    contact.whatsappInternational,
    `Hola, ${site.name}. Quiero consultar por sus productos.`,
  );
  $("#direct-contact").innerHTML = direct
    ? `<a class="button" href="${esc(direct)}" target="_blank" rel="noopener noreferrer">Conversá por WhatsApp ↗</a>`
    : '<p class="hint">WhatsApp se habilitará al confirmar el prefijo internacional.</p>';
}
function open(id) {
  selected = products.find((p) => p.id === id);
  const p = selected,
    s = (drafts[id] ||= {
      measure: p.reference ? "reference" : "custom",
      material: "",
      color: "",
      custom: "",
      width: "",
      layout: "",
      notes: "",
      leg: "",
    });
  const families = availableMaterials(p);
  $("#detail").innerHTML =
    `<h2>${esc(p.name)}</h2>${p.images?.length ? `<div class="product-gallery">${p.images.map((url, i) => `<img src="${esc(url)}" alt="${esc(p.name)}, foto ${i + 1}" loading="lazy">`).join("")}</div>` : ""}<p>${p.structure ? "Estructura: " + esc(p.structure) + ". " : ""}${esc(p.description)} ${p.reference ? "Medidas de referencia: " + esc(p.reference) + "." : "Consultá las medidas disponibles."}</p><div class="configure-grid"><form id="options"><h3>Hacelo tuyo</h3>${p.options.includes("material") ? `<label>Familia de tapizado <select name="material"><option value="">Elegí una opción</option>${families.map((m) => `<option ${s.material === m.name ? "selected" : ""} value="${esc(m.name)}">${esc(m.type)} · ${esc(m.name)}</option>`).join("")}</select></label><div id="color-control"></div>` : p.options.includes("color") ? `<label>Color deseado para consultar <input name="color" value="${esc(s.color)}" placeholder="Contanos qué color buscás"></label><p class="hint">Color y disponibilidad a confirmar con la fábrica.</p>` : ""}${p.options.includes("measure") ? `<label>Medidas <select name="measure">${p.reference ? `<option value="reference" ${s.measure === "reference" ? "selected" : ""}>Referencia: ${esc(p.reference)}</option>` : ""}${p.range ? `<option value="range" ${s.measure === "range" ? "selected" : ""}>Ancho entre ${p.range[0]} y ${p.range[1]} cm</option>` : ""}<option value="custom" ${s.measure === "custom" ? "selected" : ""}>Otra medida</option></select></label><div id="measure-control"></div>` : ""}${p.options.includes("layout") ? `<label>Configuración modular <textarea name="layout" placeholder="Describí la disposición que querés">${esc(s.layout)}</textarea></label>` : ""}${p.legs.length ? `<label>Patas <select name="leg"><option value="">A definir con la fábrica</option>${p.legs.map((l) => `<option value="${esc(l)}" ${s.leg === l ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>` : ""}${p.options.includes("notes") ? `<label>Observaciones <span>(opcional)</span><textarea name="notes" placeholder="Detalles que querés que tengamos en cuenta">${esc(s.notes)}</textarea></label>` : ""}</form><aside class="summary"><span class="eyebrow">TU CONSULTA</span><h3>Así lo imaginás</h3><pre id="summary-text" aria-live="polite"></pre><ul id="errors" aria-live="polite"></ul><button id="whatsapp" class="button">Consultar por WhatsApp ↗</button><p id="phone-status" class="hint"></p><button id="copy" class="text-button">Copiar consulta</button><p id="copy-status" role="status"></p><p class="hint">La consulta abre una conversación. No se envía automáticamente. La fábrica confirma opciones, medidas y disponibilidad.</p></aside></div>`;
  renderColor();
  renderMeasure();
  update();
  $("#options").addEventListener("input", (e) => {
    if (!e.target.name) return;
    s[e.target.name] = e.target.value;
    if (e.target.name === "material") {
      s.color = "";
      renderColor();
    }
    if (e.target.name === "measure") renderMeasure();
    update();
  });
  $("#options").addEventListener("submit", (e) => e.preventDefault());
  $("#whatsapp").onclick = () => {
    if (validate(p, s).length) return;
    const link = whatsappLink(contact.whatsappInternational, message(p, s));
    if (link) window.open(link, "_blank", "noopener,noreferrer");
  };
  $("#copy").onclick = async () => {
    try {
      await navigator.clipboard.writeText(message(p, s));
      $("#copy-status").textContent = "Consulta copiada.";
    } catch {
      $("#copy-status").textContent =
        "No se pudo copiar. Podés seleccionar el texto del resumen.";
    }
  };
  $("#customizer").showModal();
}
function renderColor() {
  const s = drafts[selected.id],
    m = materials.find((m) => m.name === s.material);
  if (!$("#color-control")) return;
  $("#color-control").innerHTML = m?.codes.length
    ? `<label>Código de color <select name="color"><option value="">Elegí un código</option>${m.codes.map((c) => `<option value="${esc(c)}" ${s.color === c ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></label><div class="swatches">${m.codes
        .map((code) => {
          const image = m.swatches?.find((s) => s.code === code)?.image;
          return `<button type="button" class="swatch" data-code="${esc(code)}" aria-pressed="${s.color === code}">${image ? `<img src="${esc(image)}" alt="Muestra ${esc(m.name)} ${esc(code)}">` : ""}<span>${esc(code)}</span></button>`;
        })
        .join("")}</div>`
    : '<p class="hint">Pediremos el muestrario de la familia elegida; el color se define con la fábrica.</p>';
  if (m?.description) {
    const description = document.createElement("p");
    description.className = "hint";
    description.textContent = m.description;
    $("#color-control").prepend(description);
  }
  $("#color-control")
    .querySelectorAll("[data-code]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          s.color = b.dataset.code;
          renderColor();
          update();
        }),
    );
}
function renderMeasure() {
  const s = drafts[selected.id];
  if (!$("#measure-control")) return;
  $("#measure-control").innerHTML =
    s.measure === "custom"
      ? `<label>Medidas deseadas <input name="custom" value="${esc(s.custom)}" placeholder="Por ejemplo: ancho, profundidad y alto"></label>`
      : s.measure === "range"
        ? `<label>Ancho en cm <input type="number" name="width" min="${selected.range[0]}" max="${selected.range[1]}" value="${esc(s.width)}"></label><p class="hint">Las demás dimensiones se confirman con la fábrica.</p>`
        : "";
}
function update() {
  const s = drafts[selected.id],
    errors = validate(selected, s);
  $("#summary-text").textContent = message(selected, s);
  $("#errors").innerHTML = errors.map((e) => `<li>${esc(e)}</li>`).join("");
  const link = whatsappLink(
    contact.whatsappInternational,
    message(selected, s),
  );
  $("#whatsapp").disabled = errors.length > 0 || !link;
  $("#phone-status").textContent = link
    ? ""
    : `WhatsApp pendiente: confirmar el prefijo internacional del teléfono ${contact.display}. Mientras tanto, podés copiar tu consulta o llamar.`;
  $("#copy").disabled = errors.length > 0;
  $("#color-control")
    ?.querySelectorAll("[data-code]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.code === s.color)),
    );
}
$("#close").onclick = () => $("#customizer").close();
$("#customizer").addEventListener("click", (e) => {
  if (e.target === $("#customizer")) {
    const r = e.target.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      e.target.close();
  }
});
$("#cards").addEventListener("click", (e) => {
  const b = e.target.closest("[data-product]");
  if (b) {
    e.stopPropagation();
    open(b.dataset.product);
  }
});
$("#filters").addEventListener("click", (e) => {
  const b = e.target.closest("[data-category]");
  if (!b) return;
  $("#filters")
    .querySelectorAll("button")
    .forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  cards(b.dataset.category);
});
try {
  await loadContent();
  renderSite();
  $("#filters").innerHTML = [
    "Todos",
    ...new Set(products.map((p) => p.category)),
  ]
    .map(
      (c, i) =>
        `<button aria-pressed="${i === 0}" data-category="${esc(c)}">${esc(c)}</button>`,
    )
    .join("");
  cards();
} catch (error) {
  $("#cards").innerHTML =
    `<p role="alert">${esc(error.message)} <a href="/">Reintentar</a></p>`;
}
