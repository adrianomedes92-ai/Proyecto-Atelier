import { cropRectangle, cropRatios } from "./crop-geometry.js";
export async function editImage({ source, kind, crop = null, legacy = false }) {
  const ratio = cropRatios[kind];
  if (!ratio) throw Error("Ubicación de imagen inválida.");
  const objectUrl = source instanceof Blob ? URL.createObjectURL(source) : null;
  const image = new Image();
  image.src = objectUrl || source;
  try {
    await image.decode();
  } catch {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    throw Error("No se pudo abrir la imagen para editarla.");
  }
  const w = image.naturalWidth,
    h = image.naturalHeight;
  let initial;
  try {
    initial = cropRectangle(w, h, kind);
  } catch (error) {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    throw error;
  }
  let zoom = crop ? initial.width / crop.width : 1,
    cx = crop ? crop.x + crop.width / 2 : w / 2,
    cy = crop ? crop.y + crop.height / 2 : h / 2,
    rect,
    drag = null,
    confirmed = false;
  zoom = Math.max(1, Math.min(4, zoom));
  const dialog = document.createElement("dialog");
  dialog.className = "image-editor";
  dialog.setAttribute("aria-labelledby", "crop-title");
  dialog.innerHTML = `<div class="dialog-head"><h2 id="crop-title">Encuadrar ${kind === "product" ? "producto" : kind === "hero" ? "portada" : "muestra"}</h2><button type="button" data-crop-cancel aria-label="Cancelar edición">✕</button></div><p class="hint">Arrastrá la foto dentro del marco y ajustá el zoom. Proporción ${kind === "product" ? "5:4" : kind === "hero" ? "16:9" : "1:1"}. El original se conserva para futuras ediciones.</p>${legacy ? '<p class="crop-warning">Esta foto es anterior al editor: solo contamos con la versión optimizada disponible. No es posible recuperar lo que ya fue eliminado de su original.</p>' : ""}<div class="crop-workspace"><div><div class="crop-stage" tabindex="0" role="group" aria-label="Encuadre: arrastrá para mover la imagen o usá las teclas de flecha"><canvas data-crop-canvas></canvas><div class="crop-grid" aria-hidden="true"></div></div><label>Zoom <output data-crop-zoom-value></output><input type="range" data-crop-zoom min="1" max="4" step="0.01" value="${zoom}" aria-label="Zoom de la imagen"></label></div><aside class="crop-preview"><h3>Resultado final</h3><canvas data-crop-preview aria-label="Vista previa del recorte"></canvas><p class="hint">La foto pública usará este mismo encuadre. En portada el degradado del sitio queda sobre la imagen.</p></aside></div><div class="crop-actions"><button type="button" class="secondary" data-crop-reset>Restablecer</button><button type="button" class="secondary" data-crop-cancel>Cancelar</button><button type="button" class="button" data-crop-confirm>Usar encuadre</button></div>`;
  document.body.append(dialog);
  const stage = dialog.querySelector(".crop-stage"),
    canvas = dialog.querySelector("[data-crop-canvas]"),
    preview = dialog.querySelector("[data-crop-preview]"),
    slider = dialog.querySelector("[data-crop-zoom]");
  stage.style.setProperty("--crop-ratio", ratio);
  canvas.width = kind === "hero" ? 960 : 800;
  canvas.height = Math.round(canvas.width / ratio);
  preview.width = 240;
  preview.height = Math.round(240 / ratio);
  function render() {
    rect = cropRectangle(w, h, kind, zoom, cx, cy);
    cx = rect.x + rect.width / 2;
    cy = rect.y + rect.height / 2;
    for (const target of [canvas, preview]) {
      const ctx = target.getContext("2d");
      ctx.clearRect(0, 0, target.width, target.height);
      ctx.drawImage(
        image,
        rect.x,
        rect.y,
        rect.width,
        rect.height,
        0,
        0,
        target.width,
        target.height,
      );
    }
    dialog.querySelector("[data-crop-zoom-value]").textContent =
      `${zoom.toFixed(2)}×`;
  }
  slider.oninput = () => {
    zoom = Number(slider.value);
    render();
  };
  stage.onpointerdown = (event) => {
    if (!event.isPrimary) return;
    stage.setPointerCapture(event.pointerId);
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, cx, cy };
  };
  stage.onpointermove = (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    cx = drag.cx - ((event.clientX - drag.x) / stage.clientWidth) * rect.width;
    cy =
      drag.cy - ((event.clientY - drag.y) / stage.clientHeight) * rect.height;
    render();
  };
  stage.onpointerup = stage.onpointercancel = () => {
    drag = null;
  };
  stage.onkeydown = (event) => {
    const directions = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    if (!directions[event.key]) return;
    event.preventDefault();
    cx += directions[event.key][0] * rect.width * 0.03;
    cy += directions[event.key][1] * rect.height * 0.03;
    render();
  };
  dialog.querySelector("[data-crop-reset]").onclick = () => {
    zoom = 1;
    cx = w / 2;
    cy = h / 2;
    slider.value = "1";
    render();
  };
  dialog
    .querySelectorAll("[data-crop-cancel]")
    .forEach((button) => (button.onclick = () => dialog.close()));
  dialog.querySelector("[data-crop-confirm]").onclick = () => {
    confirmed = true;
    dialog.close();
  };
  render();
  dialog.showModal();
  return new Promise((resolve) =>
    dialog.addEventListener(
      "close",
      () => {
        const result = confirmed ? { ...rect } : null;
        dialog.remove();
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        image.src = "";
        resolve(result);
      },
      { once: true },
    ),
  );
}
