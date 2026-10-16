export function mountVariantAdmin(
  parent,
  product,
  colors,
  { materials, esc, upload, lock, changed, status, render },
) {
  product.variants ||= [];
  const section = document.createElement("section");
  section.className = "variant-admin";
  section.innerHTML = `<h3>Imágenes por color del mueble</h3><p class="hint">Cada color tiene una sola galería para este producto, compartida por todos los tipos de tela que lo habiliten. Cargá las fotos preparadas, ajustá zoom/encuadre 5:4 y guardá. No se necesitan texturas.</p><label>Color del catálogo<select data-associate-choice><option value="">Elegí un color</option></select></label><button type="button" class="secondary" data-add-association>＋ Asociar color</button><div data-associations></div>`;
  parent.append(section);
  const choice = section.querySelector("[data-associate-choice]"),
    choices = [];
  for (const color of colors) {
    if (product.variants.some((v) => v.code === color.code)) continue;
    choices.push({ code: color.code, images: [], reviewRequired: false });
    choice.add(
      new Option(`${color.name} · ${color.code}`, String(choices.length - 1)),
    );
  }
  section.querySelector("[data-add-association]").onclick = () => {
    if (choice.value === "") {
      status(
        "Elegí un color del catálogo. Si falta, cargalo una sola vez en Telas y colores.",
        true,
      );
      return;
    }
    product.variants.push(choices[Number(choice.value)]);
    changed();
    render();
  };
  const list = section.querySelector("[data-associations]");
  product.variants.forEach((v, index) => {
    const color = colors.find((c) => c.code === v.code);
    const unavailable =
      !materials.some(
        (m) =>
          m.colorCodes.includes(v.code) &&
          (!product.materialNames.length ||
            product.materialNames.includes(m.name)),
      ) ||
      color?.reviewRequired ||
      v.reviewRequired ||
      !v.images.length;
    const card = document.createElement("div");
    card.className = "variant-card";
    card.dataset.association = index;
    card.innerHTML = `<h4>${esc(color?.name || v.code)} · ${esc(v.code)}</h4><p class="hint">${unavailable ? "No se ofrece al cliente: revisá los avisos pendientes y las fotos. Las telas deben habilitar este color con su casilla." : "Disponible para este mueble al guardar."}</p>${v.reviewRequired ? `<p class="migration-warning">Se encontraron galerías diferentes para este producto y código en telas anteriores. Conservamos todas las fotos sin repetir. Revisá el orden y quitá las que no correspondan antes de confirmar una galería compartida.</p><button type="button" class="secondary" data-confirm-gallery>Confirmar galería compartida</button>` : ""}<div class="image-list">${v.images.map((url, i) => `<div class="image-item"><img src="${esc(url)}" alt="${esc(v.code)}, foto ${i + 1}"><small>Foto ${i + 1}</small><button type="button" class="secondary" data-recrop="${esc(url)}" data-crop-kind="product" data-crop-scope="variant" data-crop-association="${index}" data-crop-index="${i}">Editar encuadre</button><div class="variant-order"><button type="button" class="secondary" data-move-image="${i}" data-delta="-1" aria-label="Mover foto ${i + 1} antes" ${i === 0 ? "disabled" : ""}>↑</button><button type="button" class="secondary" data-move-image="${i}" data-delta="1" aria-label="Mover foto ${i + 1} después" ${i === v.images.length - 1 ? "disabled" : ""}>↓</button></div><label>Reemplazar foto ${i + 1}<input type="file" data-replace-variant="${i}" accept="image/jpeg,image/png,image/webp"></label><button type="button" class="secondary danger" data-remove-variant-image="${i}">Quitar foto</button></div>`).join("")}</div><label>Agregar imágenes preparadas<input type="file" data-upload-variant multiple accept="image/jpeg,image/png,image/webp"></label><button type="button" class="secondary danger" data-remove-association>Quitar asociación</button>`;
    list.append(card);
    if (card.querySelector("[data-confirm-gallery]"))
      card.querySelector("[data-confirm-gallery]").onclick = () => {
        v.reviewRequired = false;
        changed();
        render();
      };
    card.querySelector("[data-remove-association]").onclick = () => {
      product.variants.splice(index, 1);
      changed();
      render();
    };
    card.querySelectorAll("[data-move-image]").forEach(
      (b) =>
        (b.onclick = () => {
          const from = Number(b.dataset.moveImage),
            to = from + Number(b.dataset.delta);
          if (to < 0 || to >= v.images.length) return;
          [v.images[from], v.images[to]] = [v.images[to], v.images[from]];
          changed();
          render();
        }),
    );
    card.querySelectorAll("[data-remove-variant-image]").forEach(
      (b) =>
        (b.onclick = () => {
          v.images.splice(Number(b.dataset.removeVariantImage), 1);
          changed();
          render();
        }),
    );
    async function send(input, replace = null) {
      const files = [...input.files];
      if (!files.length) return;
      lock(true);
      try {
        if (replace === null && v.images.length + files.length > 12)
          throw Error("Máximo 12 fotos por mueble y color.");
        for (const file of files) {
          const url = await upload(file, "product");
          if (!url) continue;
          if (replace === null) v.images.push(url);
          else v.images[replace] = url;
          changed();
        }
        status("Imágenes cargadas en el borrador. Guardá para publicarlas.");
      } catch (e) {
        status(e.message, true);
      } finally {
        lock(false);
        render();
      }
    }
    card.querySelector("[data-upload-variant]").onchange = (e) =>
      send(e.target);
    card
      .querySelectorAll("[data-replace-variant]")
      .forEach(
        (input) =>
          (input.onchange = () =>
            send(input, Number(input.dataset.replaceVariant))),
      );
  });
}
