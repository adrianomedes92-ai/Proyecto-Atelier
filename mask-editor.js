import { loadImage } from "./upholstery-preview.js";
export async function editMask({ base: baseUrl, mask: maskUrl }) {
  const base = await loadImage(baseUrl);
  let initial = maskUrl ? await loadImage(maskUrl) : null;
  if (
    initial &&
    (initial.naturalWidth !== base.naturalWidth ||
      initial.naturalHeight !== base.naturalHeight)
  )
    throw Error(
      "La máscara debe tener exactamente las mismas dimensiones que la imagen base.",
    );
  const dialog = document.createElement("dialog");
  dialog.className = "mask-editor";
  dialog.innerHTML = `<form method="dialog"><h2>Máscara de tapizado</h2><p>Pintá las zonas de tela. El rojo indica lo que se reemplazará. Excluí madera, patas, fondo y huecos. La foto original no se modifica.</p><div class="mask-tools"><button type="button" data-paint aria-pressed="true">Pintar</button><button type="button" data-erase aria-pressed="false">Borrar</button><label>Pincel <input data-brush type="range" min="2" max="120" value="30"></label><button type="button" data-undo>Deshacer</button><button type="button" data-clear>Vaciar máscara</button></div><div class="mask-stage"><canvas tabindex="0" aria-label="Dibujar máscara sobre las zonas tapizadas con el puntero o el dedo"></canvas></div><label>Reemplazar por PNG (blanco: tapizado, negro o transparente: proteger)<input data-import type="file" accept="image/png"></label><p data-mask-status role="status"></p><div class="mask-actions"><button value="cancel" class="secondary">Cancelar</button><button type="button" data-confirm>Usar máscara</button></div></form>`;
  document.body.append(dialog);
  const canvas = dialog.querySelector("canvas"),
    mask = document.createElement("canvas");
  canvas.width = mask.width = base.naturalWidth;
  canvas.height = mask.height = base.naturalHeight;
  const ctx = canvas.getContext("2d"),
    m = mask.getContext("2d", { willReadFrequently: true });
  m.fillStyle = "#000";
  m.fillRect(0, 0, mask.width, mask.height);
  if (initial) m.drawImage(initial, 0, 0);
  const history = [];
  let erasing = false,
    drawing = false,
    last;
  const message = dialog.querySelector("[data-mask-status]");
  function remember() {
    history.push(m.getImageData(0, 0, mask.width, mask.height));
    if (history.length > 8) history.shift();
  }
  function show() {
    ctx.drawImage(base, 0, 0);
    const pixels = m.getImageData(0, 0, mask.width, mask.height);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const a =
        (((pixels.data[i] + pixels.data[i + 1] + pixels.data[i + 2]) / 3) *
          pixels.data[i + 3]) /
        255;
      pixels.data[i] = 215;
      pixels.data[i + 1] = 45;
      pixels.data[i + 2] = 40;
      pixels.data[i + 3] = a * 0.52;
    }
    const overlay = document.createElement("canvas");
    overlay.width = mask.width;
    overlay.height = mask.height;
    overlay.getContext("2d").putImageData(pixels, 0, 0);
    ctx.drawImage(overlay, 0, 0);
  }
  function point(e) {
    const b = canvas.getBoundingClientRect();
    return [
      ((e.clientX - b.left) * mask.width) / b.width,
      ((e.clientY - b.top) * mask.height) / b.height,
    ];
  }
  canvas.onpointerdown = (e) => {
    e.preventDefault();
    remember();
    drawing = true;
    last = point(e);
    canvas.setPointerCapture(e.pointerId);
    stroke(e);
  };
  function stroke(e) {
    if (!drawing) return;
    const next = point(e);
    m.strokeStyle = m.fillStyle = erasing ? "#000" : "#fff";
    m.lineWidth =
      (Number(dialog.querySelector("[data-brush]").value) * mask.width) / 800;
    m.lineCap = "round";
    m.beginPath();
    m.moveTo(...last);
    m.lineTo(...next);
    m.stroke();
    m.beginPath();
    m.arc(...next, m.lineWidth / 2, 0, Math.PI * 2);
    m.fill();
    last = next;
    show();
  }
  canvas.onpointermove = stroke;
  canvas.onpointerup = canvas.onpointercancel = () => (drawing = false);
  for (const mode of ["paint", "erase"])
    dialog.querySelector("[data-" + mode + "]").onclick = () => {
      erasing = mode === "erase";
      dialog
        .querySelector("[data-paint]")
        .setAttribute("aria-pressed", !erasing);
      dialog
        .querySelector("[data-erase]")
        .setAttribute("aria-pressed", erasing);
    };
  dialog.querySelector("[data-undo]").onclick = () => {
    const prev = history.pop();
    if (prev) {
      m.putImageData(prev, 0, 0);
      show();
    }
  };
  dialog.querySelector("[data-clear]").onclick = () => {
    remember();
    m.fillStyle = "#000";
    m.fillRect(0, 0, mask.width, mask.height);
    show();
  };
  dialog.querySelector("[data-import]").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      if (file.type !== "image/png" || file.size > 20 * 1024 * 1024)
        throw Error("Usá PNG de hasta 20 MB.");
      const url = URL.createObjectURL(file);
      let img;
      try {
        img = await loadImage(url);
      } finally {
        URL.revokeObjectURL(url);
      }
      if (img.naturalWidth !== mask.width || img.naturalHeight !== mask.height)
        throw Error(
          `El PNG debe medir ${mask.width} × ${mask.height} px, igual que la base.`,
        );
      remember();
      m.clearRect(0, 0, mask.width, mask.height);
      m.drawImage(img, 0, 0);
      show();
      message.textContent = "Máscara importada. Revisá las zonas en rojo.";
    } catch (e) {
      message.textContent = e.message;
    }
  };
  show();
  dialog.showModal();
  return new Promise((resolve) => {
    dialog.onclose = () => {
      dialog.remove();
      resolve(null);
    };
    dialog.querySelector("[data-confirm]").onclick = () => {
      const data = m.getImageData(0, 0, mask.width, mask.height);
      let included = 0;
      for (let i = 0; i < data.data.length; i += 4) {
        const coverage = Math.round(
          (((data.data[i] + data.data[i + 1] + data.data[i + 2]) / 3) *
            data.data[i + 3]) /
            255,
        );
        data.data[i] = data.data[i + 1] = data.data[i + 2] = coverage;
        data.data[i + 3] = 255;
        if (coverage > 0) included++;
      }
      if (!included) {
        message.textContent =
          "Pintá al menos una zona tapizada antes de confirmar.";
        return;
      }
      m.putImageData(data, 0, 0);
      mask.toBlob((blob) => {
        if (!blob) {
          message.textContent = "No se pudo generar la máscara.";
          return;
        }
        dialog.onclose = null;
        dialog.close();
        dialog.remove();
        resolve(new File([blob], "mascara.png", { type: "image/png" }));
      }, "image/png");
    };
  });
}
