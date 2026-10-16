import { editImage } from "./image-editor.js";
import { applyBrand } from "./brand.js";
import { validateContent } from "./content-schema.js";
const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let content,
  revision,
  tab = "products",
  productId,
  materialIndex = 0,
  dirty = false,
  busy = false;
const status = (message, error = false) => {
  const node = $("#status");
  node.textContent = message;
  node.setAttribute("role", error ? "alert" : "status");
};
function changed() {
  dirty = true;
  $("#save-state").textContent =
    "Cambios pendientes: guardalos para actualizar la web.";
}
async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body instanceof File
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw Error(
      response.status === 413
        ? "El servidor rechazó el tamaño de la imagen. Revisá el límite de subida en la configuración PHP de Hostinger."
        : "El servidor no devolvió una respuesta válida. Verificá que /api/ llegue al servidor correcto; en Hostinger, revisá .htaccess.",
    );
  }
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && path !== "/api/admin/login") {
      showLogin();
    }
    throw Error(data.error || "No se pudo completar la operación.");
  }
  return data;
}
function showLogin() {
  $("#panel").hidden = true;
  $("#login").hidden = false;
}
async function enter() {
  const data = await api("/api/admin/content");
  content = data.content;
  content.products.forEach((product) => {
    product.images = [
      ...new Set([product.image, ...product.images].filter(Boolean)),
    ];
  });
  applyBrand(content.site);
  revision = data.revision;
  productId = content.products[0]?.id;
  dirty = false;
  $("#panel").hidden = false;
  $("#login").hidden = true;
  $("#save-state").textContent = "Sin cambios pendientes.";
  render();
}
$("#login-form").onsubmit = async (e) => {
  e.preventDefault();
  const button = e.target.querySelector("button");
  button.disabled = true;
  try {
    await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ password: e.target.password.value }),
    });
    e.target.reset();
    await enter();
    status("Sesión iniciada.");
  } catch (error) {
    status(error.message, true);
  } finally {
    button.disabled = false;
  }
};
$("#logout").onclick = async () => {
  if (busy) return;
  if (
    dirty &&
    !confirm("Hay cambios sin guardar. ¿Querés salir y descartarlos?")
  )
    return;
  try {
    await api("/api/admin/logout", { method: "POST", body: "{}" });
    dirty = false;
    showLogin();
    status("Sesión cerrada.");
  } catch (e) {
    status(e.message, true);
  }
};
$("#save").onclick = async () => {
  if (busy) return;
  lock(true);
  try {
    const data = await api("/api/admin/content", {
      method: "PUT",
      body: JSON.stringify({ revision, content }),
    });
    revision = data.revision;
    dirty = false;
    $("#save-state").textContent = "Todos los cambios están guardados.";
    status("Cambios guardados. Recargá la web pública para verlos.");
  } catch (e) {
    status(e.message, true);
  } finally {
    lock(false);
  }
};
$(".admin-tabs").onclick = (e) => {
  const button = e.target.closest("[data-tab]");
  if (!button || busy) return;
  tab = button.dataset.tab;
  $(".admin-tabs")
    .querySelectorAll("button")
    .forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
  render();
};
window.addEventListener("beforeunload", (e) => {
  if (dirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});
const field = (label, key, value, extra = "") =>
  `<label>${label}<input data-field="${key}" value="${esc(value)}" ${extra}></label>`;
const textarea = (label, key, value) =>
  `<label>${label}<textarea data-field="${key}">${esc(value)}</textarea></label>`;
function photos(images, kind) {
  const guide =
    kind === "product"
      ? "<strong>Productos: recomendado 1600 × 1280 px (horizontal, proporción 5:4).</strong> Centrá el mueble y dejá un margen de aproximadamente 10% alrededor. El editor usa un marco 5:4 y la tarjeta genera una miniatura de 800 × 640 px del mismo encuadre."
      : "<strong>Inicio: recomendado 1600 × 1800 px (vertical, proporción 8:9).</strong> Dejá aire alrededor del mueble. Mostramos la imagen completa, sin cortar bordes.";
  return `<div class="image-guide">${guide}</div><div class="image-list">${images.map((url, i) => `<div class="image-item"><img src="${esc(url)}" alt="Foto cargada ${i + 1}"><small>${i === 0 && kind === "product" ? "Portada" : ""}</small><button type="button" class="secondary" data-recrop="${esc(url)}" data-crop-kind="${kind}" data-crop-index="${i}">Editar encuadre</button><button type="button" class="secondary" data-remove-image="${i}" data-kind="${kind}">Quitar foto</button>${i > 0 && kind === "product" ? `<button type="button" class="secondary" data-cover="${i}">Usar de portada</button>` : ""}</div>`).join("")}</div><label class="upload">${kind === "product" ? "Agregar fotografías" : "Cargar imagen de inicio"}<input type="file" data-upload="${kind}" accept="image/jpeg,image/png,image/webp" ${kind === "product" ? "multiple" : ""}></label><p class="hint">JPG, PNG o WebP, hasta 20 MB y 60 megapíxeles. Elegí el encuadre antes de subir. Conservamos el original y generamos WebP con el recorte confirmado. Solo se publican al guardar los cambios.</p>`;
}
function render() {
  if (tab === "products") renderProducts();
  else if (tab === "materials") renderMaterials();
  else if (tab === "site") renderSite();
  else renderBackup();
  bindRecrops();
}
function renderProducts() {
  const p = content.products.find((p) => p.id === productId);
  $("#editor").innerHTML =
    `<div class="editor-grid"><aside class="entity-list"><button id="new-product">＋ Agregar producto</button>${content.products.map((p) => `<button data-product="${esc(p.id)}" aria-pressed="${p.id === productId}">${esc(p.name)}<small>${esc(p.category)} · ${p.visible ? "Visible" : "Oculto"}</small></button>`).join("")}</aside>${
      p
        ? `<section class="editor-card"><div class="editor-toolbar"><h2>Ficha del producto</h2><button class="secondary danger" id="delete-product">Eliminar</button></div><div class="field-grid">${field("Nombre", "name", p.name, 'required maxlength="100"')}${field("Categoría", "category", p.category, 'required maxlength="100"')}${field("Medidas de referencia", "reference", p.reference)}${field("Estructura / materiales", "structure", p.structure)}<div class="full">${textarea("Descripción", "description", p.description)}</div>${field("Ancho mínimo (cm)", "min", p.range?.[0] ?? "", 'type="number" min="1"')}${field("Ancho máximo (cm)", "max", p.range?.[1] ?? "", 'type="number" min="1"')}</div><p class="hint">Dejá ambos límites vacíos si no hay un rango confirmado. Las medidas son referencias, sin promesa de disponibilidad.</p><label class="check"><input type="checkbox" data-field="visible" ${p.visible ? "checked" : ""}>Mostrar en la web</label><h3>Opciones de personalización</h3><div class="checks">${[
            ["material", "Tapizado"],
            ["measure", "Medidas"],
            ["color", "Color a consultar"],
            ["layout", "Configuración modular"],
            ["notes", "Observaciones"],
          ]
            .map(
              ([key, label]) =>
                `<label class="check"><input type="checkbox" data-option="${key}" ${p.options.includes(key) ? "checked" : ""}>${label}</label>`,
            )
            .join(
              "",
            )}</div><h3>Familias habilitadas para este modelo</h3><p class="hint">Sin marcar ninguna se ofrecen todas las familias. Marcá solo las confirmadas para el producto.</p><div class="checks">${content.materials.map((m) => `<label class="check"><input type="checkbox" data-material="${esc(m.name)}" ${p.materialNames.includes(m.name) ? "checked" : ""}>${esc(m.name)}</label>`).join("")}</div>${textarea("Variantes confirmadas de patas (una por línea)", "legs", p.legs.join("\n"))}<h3>Fotografías</h3>${photos(p.images, "product")}</section>`
        : '<section class="editor-card"><h2>Todavía no hay productos</h2><p>Agregá un modelo para comenzar.</p></section>'
    }</div>`;
  $("#new-product").onclick = () => {
    const p = {
      id: "producto-" + crypto.randomUUID(),
      name: "Nuevo producto",
      category: "Sillones",
      reference: "",
      structure: "",
      description: "",
      range: null,
      visible: false,
      options: ["notes"],
      materialNames: [],
      legs: [],
      image: "",
      images: [],
    };
    content.products.push(p);
    productId = p.id;
    changed();
    render();
  };
  $("#editor")
    .querySelectorAll("[data-product]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          if (busy) return;
          productId = b.dataset.product;
          render();
        }),
    );
  if (!p) return;
  $("#delete-product").onclick = () => {
    if (confirm(`¿Eliminar ${p.name}? Se aplica al guardar.`)) {
      content.products = content.products.filter((x) => x !== p);
      productId = content.products[0]?.id;
      changed();
      render();
    }
  };
  $("#editor")
    .querySelectorAll("[data-field]")
    .forEach(
      (input) =>
        (input.oninput = () => {
          const key = input.dataset.field;
          if (key === "visible") p.visible = input.checked;
          else if (key === "legs")
            p.legs = input.value
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean);
          else if (key === "min" || key === "max") {
            const min = $('[data-field="min"]').value,
              max = $('[data-field="max"]').value;
            p.range = min || max ? [Number(min), Number(max)] : null;
          } else p[key] = input.value;
          changed();
        }),
    );
  $("#editor")
    .querySelectorAll("[data-option]")
    .forEach(
      (input) =>
        (input.onchange = () => {
          p.options = [
            ...$("#editor").querySelectorAll("[data-option]:checked"),
          ].map((i) => i.dataset.option);
          changed();
        }),
    );
  $("#editor")
    .querySelectorAll("[data-material]")
    .forEach(
      (input) =>
        (input.onchange = () => {
          p.materialNames = [
            ...$("#editor").querySelectorAll("[data-material]:checked"),
          ].map((i) => i.dataset.material);
          changed();
        }),
    );
  bindImages(p);
}
async function upload(file, kind = "product") {
  if (file.size > 20 * 1024 * 1024) throw Error("La imagen supera los 20 MB.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw Error("Elegí una imagen JPG, PNG o WebP.");
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw Error(
      "No se puede leer la imagen. Probá exportarla nuevamente como JPG, PNG o WebP sin animación.",
    );
  }
  const pixels = bitmap.width * bitmap.height;
  bitmap.close();
  if (pixels > 60_000_000)
    throw Error(
      "La imagen supera los 60 megapíxeles. Reducí sus dimensiones antes de subirla.",
    );
  const crop = await editImage({ source: file, kind });
  if (!crop) return null;
  status("Optimizando imagen…");
  const result = await api("/api/admin/upload", {
    method: "POST",
    body: file,
    headers: {
      "Content-Type": file.type,
      "X-Image-Kind": kind,
      "X-Image-Crop": JSON.stringify(crop),
    },
  });
  return result.url;
}
function bindRecrops() {
  $("#editor")
    .querySelectorAll("[data-recrop]")
    .forEach(
      (button) =>
        (button.onclick = async () => {
          lock(true);
          try {
            const url = button.dataset.recrop,
              kind = button.dataset.cropKind,
              index = Number(button.dataset.cropIndex);
            const info = await api(
              "/api/admin/image-info?url=" + encodeURIComponent(url),
            );
            const crop = await editImage({
              source: info.sourceUrl,
              kind,
              crop: info.crop,
              legacy: info.legacy,
            });
            if (!crop) {
              status("Edición cancelada. Se conserva la foto anterior.");
              return;
            }
            const result = await api("/api/admin/recrop", {
              method: "POST",
              body: JSON.stringify({ url, kind, crop }),
            });
            if (kind === "hero") {
              content.site.heroImages[index] = result.url;
              content.site.heroImage = content.site.heroImages[0] || "";
            } else if (kind === "product") {
              const product = content.products.find((p) => p.id === productId);
              product.images[index] = result.url;
              product.image = product.images[0] || "";
            } else {
              const material = content.materials[materialIndex];
              const code = material.codes[index];
              material.swatches.find((s) => s.code === code).image = result.url;
            }
            changed();
            status(
              "Encuadre actualizado en el borrador. Guardá los cambios para publicarlo.",
            );
          } catch (error) {
            status(error.message, true);
          } finally {
            lock(false);
            render();
          }
        }),
    );
}
function lock(value) {
  busy = value;
  $("#save").disabled = value;
  $("#editor")
    .querySelectorAll("button,input,textarea,select")
    .forEach((n) => (n.disabled = value));
}
function bindImages(p) {
  $("#editor")
    .querySelectorAll("[data-remove-image]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          if (b.dataset.kind === "product") {
            p.images.splice(Number(b.dataset.removeImage), 1);
            p.image = p.images[0] || "";
          } else content.site.heroImage = "";
          changed();
          render();
        }),
    );
  $("#editor")
    .querySelectorAll("[data-cover]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          const index = Number(b.dataset.cover);
          p.images.unshift(p.images.splice(index, 1)[0]);
          p.image = p.images[0];
          changed();
          render();
        }),
    );
  $("#editor")
    .querySelectorAll("[data-upload]")
    .forEach(
      (input) =>
        (input.onchange = async () => {
          lock(true);
          try {
            const files = [...input.files];
            if (
              input.dataset.upload === "product" &&
              p.images.length + files.length > 12
            )
              throw Error("Máximo 12 fotos por producto.");
            let uploaded = 0;
            for (const file of files) {
              const url = await upload(file, input.dataset.upload);
              if (!url) continue;
              if (input.dataset.upload === "product") {
                p.images.push(url);
                p.image = p.images[0];
              } else content.site.heroImage = url;
              changed();
              uploaded++;
            }
            status(
              uploaded
                ? "Fotos optimizadas en WebP. Guardá los cambios para publicarlas."
                : "Carga cancelada. No se modificaron las imágenes.",
            );
          } catch (e) {
            status(e.message, true);
          } finally {
            lock(false);
            render();
          }
        }),
    );
}
function renderMaterials() {
  const m = content.materials[materialIndex];
  $("#editor").innerHTML =
    `<div class="editor-grid"><aside class="entity-list"><button id="new-material">＋ Agregar familia</button>${content.materials.map((m, i) => `<button data-family="${i}" aria-pressed="${i === materialIndex}">${esc(m.name)}<small>${esc(m.type)} · ${m.codes.length} colores</small></button>`).join("")}</aside><section class="editor-card">${
      m
        ? `<div class="editor-toolbar"><h2>Telas y colores</h2><button id="delete-material" class="secondary danger">Eliminar familia</button></div><div class="field-grid">${field("Nombre de la familia", "name", m.name)}${field("Tipo (Tela, Ecocuero, etc.)", "type", m.type)}</div>${textarea("Descripción del material", "description", m.description || "")}<h3>Códigos y muestras</h3><p class="hint">Cargá códigos exactos y fotos reales de las muestras. Recomendado: 800 × 800 px, cuadrada (1:1), con luz neutra y sin filtros. Se optimiza a WebP de hasta 400 × 400 px. El color en pantalla es orientativo: confirmalo con la muestra física. Si un código no tiene foto, se muestra solo su nombre.</p><div id="swatch-list">${m.codes
            .map((code, i) => {
              const photo = m.swatches.find((s) => s.code === code)?.image;
              return `<div class="swatch-row">${field("Código", "code-" + i, code)}<div>${photo ? `<img src="${esc(photo)}" alt="Muestra ${esc(code)}"><button type="button" class="secondary" data-recrop="${esc(photo)}" data-crop-kind="swatch" data-crop-index="${i}">Editar encuadre</button><button class="text-button" data-remove-swatch="${i}">Quitar foto</button>` : ""}<label>Foto de muestra<input type="file" data-swatch="${i}" accept="image/jpeg,image/png,image/webp"></label></div><button class="secondary danger" data-delete-code="${i}">Quitar código</button></div>`;
            })
            .join(
              "",
            )}</div><button id="add-code" class="secondary">＋ Agregar código</button>`
        : "<h2>No hay familias cargadas</h2><p>Agregá una tela o un material.</p>"
    }</section></div>`;
  $("#new-material").onclick = () => {
    content.materials.push({
      name: "Nueva familia " + (content.materials.length + 1),
      type: "Tela",
      description: "",
      codes: [],
      swatches: [],
    });
    materialIndex = content.materials.length - 1;
    changed();
    render();
  };
  $("#editor")
    .querySelectorAll("[data-family]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          if (busy) return;
          materialIndex = Number(b.dataset.family);
          render();
        }),
    );
  if (!m) return;
  $("#delete-material").onclick = () => {
    if (
      confirm(
        `¿Eliminar ${m.name}? Se quitará de las opciones de los productos. Se aplica al guardar.`,
      )
    ) {
      content.products.forEach(
        (p) => (p.materialNames = p.materialNames.filter((n) => n !== m.name)),
      );
      content.materials.splice(materialIndex, 1);
      materialIndex = 0;
      changed();
      render();
    }
  };
  $("#editor")
    .querySelectorAll("[data-field]")
    .forEach(
      (input) =>
        (input.oninput = () => {
          const key = input.dataset.field;
          if (key === "name") {
            const old = m.name;
            m.name = input.value;
            content.products.forEach(
              (p) =>
                (p.materialNames = p.materialNames.map((n) =>
                  n === old ? m.name : n,
                )),
            );
          } else if (key === "type" || key === "description")
            m[key] = input.value;
          else {
            const index = Number(key.split("-")[1]),
              old = m.codes[index];
            m.codes[index] = input.value;
            m.swatches.forEach((s) => {
              if (s.code === old) s.code = input.value;
            });
          }
          changed();
        }),
    );
  $("#add-code").onclick = () => {
    m.codes.push("");
    changed();
    render();
  };
  $("#editor")
    .querySelectorAll("[data-delete-code]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          const i = Number(b.dataset.deleteCode),
            code = m.codes[i];
          m.codes.splice(i, 1);
          m.swatches = m.swatches.filter((s) => s.code !== code);
          changed();
          render();
        }),
    );
  $("#editor")
    .querySelectorAll("[data-remove-swatch]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          m.swatches = m.swatches.filter(
            (s) => s.code !== m.codes[Number(b.dataset.removeSwatch)],
          );
          changed();
          render();
        }),
    );
  $("#editor")
    .querySelectorAll("[data-swatch]")
    .forEach(
      (input) =>
        (input.onchange = async () => {
          const code = m.codes[Number(input.dataset.swatch)];
          if (!code.trim()) {
            status("Ingresá el código antes de cargar la muestra.", true);
            input.value = "";
            return;
          }
          lock(true);
          try {
            const url = await upload(input.files[0], "swatch");
            if (!url) {
              status("Carga cancelada. Se conserva la muestra anterior.");
              return;
            }
            m.swatches = m.swatches.filter((s) => s.code !== code);
            m.swatches.push({ code, image: url });
            changed();
            status("Muestra optimizada en WebP. Guardá los cambios.");
          } catch (e) {
            status(e.message, true);
          } finally {
            lock(false);
            render();
          }
        }),
    );
}

function heroPhotos() {
  const images = content.site.heroImages;
  return `<div class="image-guide"><strong>Portada: recomendado 1920 × 1080 px, horizontal (16:9).</strong> Ubicá el producto hacia la derecha y dejá libre aproximadamente el 40% izquierdo para los textos superpuestos. En celular, el texto queda arriba y la foto se encuadra hacia abajo. Elegí el encuadre 16:9 en el editor: dejá margen alrededor del mueble, evitá textos incrustados y comprobá el resultado en ambos tamaños. Con una imagen se muestra fija; con varias, se alternan cada 5 segundos con fundido de 1 segundo.</div>
    <p class="hint">Hasta 12 imágenes JPG, PNG o WebP, de hasta 20 MB y 60 megapíxeles cada una, sin animación. Se optimizan a WebP. El orden de las miniaturas es el orden de presentación. Los cambios se publican al guardar.</p>
    <div class="image-list hero-admin-images">${images.map((url, i) => `<div class="image-item"><img src="${esc(url)}" alt="Vista previa de portada ${i + 1}"><strong>Imagen ${i + 1}</strong><button type="button" class="secondary" data-recrop="${esc(url)}" data-crop-kind="hero" data-crop-index="${i}">Editar encuadre</button><div class="hero-order"><button type="button" class="secondary" data-hero-move="${i}" data-direction="-1" aria-label="Mover imagen ${i + 1} antes" ${i === 0 ? "disabled" : ""}>↑</button><button type="button" class="secondary" data-hero-move="${i}" data-direction="1" aria-label="Mover imagen ${i + 1} después" ${i === images.length - 1 ? "disabled" : ""}>↓</button></div><label class="hero-replace">Reemplazar<input type="file" data-hero-replace="${i}" accept="image/jpeg,image/png,image/webp"></label><button type="button" class="secondary danger" data-hero-remove="${i}">Eliminar imagen ${i + 1}</button></div>`).join("")}</div>
    ${images.length ? "" : '<p class="hint">Sin imágenes: la web conserva la portada gráfica original.</p>'}
    <label class="upload">Agregar imágenes de portada<input type="file" id="hero-upload" accept="image/jpeg,image/png,image/webp" multiple ${images.length >= 12 ? "disabled" : ""}></label>`;
}
function bindHeroImages() {
  const images = content.site.heroImages;
  const synchronize = () => {
    content.site.heroImage = images[0] || "";
    changed();
  };
  $("#editor")
    .querySelectorAll("[data-hero-move]")
    .forEach(
      (button) =>
        (button.onclick = () => {
          const from = Number(button.dataset.heroMove),
            to = from + Number(button.dataset.direction);
          if (to < 0 || to >= images.length) return;
          [images[from], images[to]] = [images[to], images[from]];
          synchronize();
          render();
          $(
            `[data-hero-move="${to}"][data-direction="${button.dataset.direction}"]`,
          )?.focus();
        }),
    );
  $("#editor")
    .querySelectorAll("[data-hero-remove]")
    .forEach(
      (button) =>
        (button.onclick = () => {
          images.splice(Number(button.dataset.heroRemove), 1);
          synchronize();
          render();
        }),
    );
  async function processFiles(input, replaceIndex) {
    const files = [...input.files];
    if (!files.length) return;
    lock(true);
    let uploaded = 0;
    try {
      if (replaceIndex === undefined && images.length + files.length > 12)
        throw Error(
          "Podés cargar hasta 12 imágenes de portada. Eliminá alguna o elegí menos archivos.",
        );
      for (const file of files) {
        try {
          const url = await upload(file, "hero");
          if (!url) continue;
          if (replaceIndex === undefined) images.push(url);
          else images[replaceIndex] = url;
          synchronize();
          uploaded++;
        } catch (error) {
          throw Error(`No se pudo cargar «${file.name}»: ${error.message}`);
        }
      }
      status(
        uploaded === 0
          ? "Carga cancelada. No se modificaron las imágenes."
          : replaceIndex === undefined
            ? `${uploaded} imagen(es) optimizada(s). Revisá las vistas previas y guardá los cambios.`
            : "Imagen reemplazada en el borrador. Revisá la vista previa y guardá los cambios.",
      );
    } catch (error) {
      status(
        `${error.message}${uploaded ? ` Se conservaron ${uploaded} imagen(es) cargada(s) en el borrador.` : ""}`,
        true,
      );
    } finally {
      lock(false);
      render();
    }
  }
  $("#hero-upload").onchange = (event) => processFiles(event.target);
  $("#editor")
    .querySelectorAll("[data-hero-replace]")
    .forEach(
      (input) =>
        (input.onchange = () =>
          processFiles(input, Number(input.dataset.heroReplace))),
    );
}
function renderSite() {
  const s = content.site;
  $("#editor").innerHTML =
    `<section class="editor-card"><h2>Contenido de la web</h2><div class="field-grid">${field("Nombre de la marca", "name", s.name)}<label>Tamaño del nombre de la marca: <output id="brand-size-value">${s.brandFontSize} px</output><input type="range" data-field="brandFontSize" min="16" max="36" step="1" value="${s.brandFontSize}"><span class="hint">Entre 16 y 36 px en escritorio. Se adapta a celular sin cambiar la tipografía. Vista previa en el encabezado.</span></label>${field("Presentación breve", "tagline", s.tagline)}<div class="full">${textarea("Título de inicio (una línea por renglón)", "heroTitle", s.heroTitle)}${textarea("Descripción de inicio", "heroDescription", s.heroDescription)}${field("Fabricación y envíos", "shipping", s.shipping)}</div>${field("Título del catálogo", "collectionTitle", s.collectionTitle)}${field("Descripción del catálogo", "collectionDescription", s.collectionDescription)}${textarea("Título de contacto", "contactTitle", s.contactTitle)}${textarea("Descripción de contacto", "contactDescription", s.contactDescription)}${field("Texto del pie de página", "footer", s.footer)}${field("Botón de inicio", "heroButton", s.heroButton)}${field("Etiqueta del catálogo", "collectionEyebrow", s.collectionEyebrow)}${field("Etiqueta de contacto", "contactEyebrow", s.contactEyebrow)}</div><h3>Cómo funciona</h3>${s.steps.map((step, i) => `<div class="field-grid">${field("Título del paso " + (i + 1), "step-title-" + i, step.title)}${field("Descripción del paso " + (i + 1), "step-description-" + i, step.description)}</div>`).join("")}<h3>Imágenes de portada</h3>${heroPhotos()}<h2>Contacto</h2><div class="field-grid">${field("Teléfono visible", "display", content.contact.display)}${field("WhatsApp internacional (solo dígitos)", "whatsappInternational", content.contact.whatsappInternational, 'inputmode="numeric"')}${textarea("Personas de contacto (una por línea)", "people", content.contact.people.join("\n"))}</div><p class="hint">Confirmá el prefijo internacional con la fábrica. Ejemplo de formato: código de país + número, sin +, espacios ni guiones. Dejalo vacío para deshabilitar WhatsApp.</p></section>`;
  $("#editor")
    .querySelectorAll("[data-field]")
    .forEach(
      (input) =>
        (input.oninput = () => {
          const key = input.dataset.field;
          if (key.startsWith("step-")) {
            const [, property, index] = key.split("-");
            s.steps[Number(index)][property] = input.value;
          } else if (key === "people")
            content.contact.people = input.value
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean);
          else if (["display", "whatsappInternational"].includes(key))
            content.contact[key] = input.value;
          else if (key === "brandFontSize") {
            s.brandFontSize = Number(input.value);
            $("#brand-size-value").textContent = `${s.brandFontSize} px`;
          } else s[key] = input.value;
          if (key === "name" || key === "brandFontSize") applyBrand(s);
          changed();
        }),
    );
  bindHeroImages();
}
function renderBackup() {
  $("#editor").innerHTML =
    `<section class="editor-card"><h2>Tu información, a resguardo.</h2><p>Descargá el contenido en JSON para tener una copia de textos, productos y opciones.</p><button id="export" class="button">Descargar contenido</button><p class="hint">Este archivo incluye las rutas de las fotos, pero no sus archivos. En localhost, respaldá .storage. En Hostinger, respaldá la base MySQL y atelier-private/storage/uploads. Guardá las copias en un lugar privado.</p><h3>Restaurar contenido</h3><label class="import-field">Archivo JSON de respaldo<input type="file" id="import" accept="application/json,.json"></label><p class="hint">Reemplaza el borrador del panel. Revisá y guardá para aplicarlo. Las fotos deben existir en el mismo servidor.</p></section>`;
  $("#export").onclick = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ content }, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "atelier-contenido.json";
    a.click();
    URL.revokeObjectURL(url);
  };
  $("#import").onchange = async (e) => {
    try {
      const file = e.target.files[0];
      if (!file || file.size > 1024 * 1024)
        throw Error("Usá un respaldo JSON de hasta 1 MB.");
      const data = JSON.parse(await file.text());
      if (
        !data.content?.site ||
        !Array.isArray(data.content.products) ||
        !Array.isArray(data.content.materials)
      )
        throw Error("Respaldo inválido.");
      if (confirm("¿Reemplazar el borrador con este respaldo?")) {
        content = validateContent(data.content);
        productId = content.products[0]?.id;
        materialIndex = 0;
        changed();
        status("Respaldo cargado como borrador. Revisá y guardá para aplicar.");
      }
    } catch (e) {
      status(e.message, true);
    }
  };
}
try {
  const state = await api("/api/admin/session");
  $("#setup-help").hidden = state.configured;
  if (!state.configured && state.setupUrl === "/setup.php") {
    $("#setup-help").textContent =
      "Completá la instalación de Hostinger en /setup.php para crear el acceso al panel.";
  }
  $("#development-help").hidden = !state.developmentLogin;
  if (state.authenticated) await enter();
} catch (e) {
  status(e.message, true);
}
