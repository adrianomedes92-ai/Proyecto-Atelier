export function mountVariantAdmin(
  parent,
  product,
  materials,
  { esc, upload, lock, changed, status, render },
) {
  product.variants ||= [];
  const section = document.createElement("section");
  section.className = "variant-admin";
  section.innerHTML = `<h3>Imágenes por tela y color</h3><p class="hint">Cargá fotos ya preparadas de este mueble. No se recortan ni recolorean. Cada asociación se guarda solo para este modelo, tela y código. Para ofrecerla al cliente necesita una variante activa, una muestra y al menos una foto.</p><label>Tela y código a asociar<select data-associate-choice><option value="">Elegí una variante</option></select></label><button type="button" class="secondary" data-add-association>＋ Asociar variante</button><div data-associations></div>`;
  parent.append(section);
  const choice = section.querySelector("[data-associate-choice]"),
    choices = [];
  for (const m of materials) {
    if (product.materialNames.length && !product.materialNames.includes(m.name))
      continue;
    for (const code of m.codes) {
      if (
        product.variants.some((v) => v.material === m.name && v.code === code)
      )
        continue;
      const swatch = m.swatches?.find((s) => s.code === code);
      choices.push({ material: m.name, code, images: [] });
      choice.add(
        new Option(
          `${m.name}${m.code ? " · " + m.code : ""} / ${swatch?.name || code} · ${code}${swatch?.active === false ? " (inactiva)" : ""}`,
          String(choices.length - 1),
        ),
      );
    }
  }
  section.querySelector("[data-add-association]").onclick = () => {
    if (choice.value === "") {
      status(
        "Elegí una tela y código. Si faltan, cargalos en Telas y colores.",
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
    const material = materials.find((m) => m.name === v.material),
      sample = material?.swatches?.find((s) => s.code === v.code);
    const unavailable =
      sample?.active === false ||
      !sample?.image ||
      !v.images.length ||
      (product.materialNames.length &&
        !product.materialNames.includes(v.material));
    const card = document.createElement("div");
    card.className = "variant-card";
    card.dataset.association = index;
    card.innerHTML = `<h4>${esc(v.material)} · ${esc(sample?.name || v.code)} · ${esc(v.code)}</h4><p class="hint">${unavailable ? "No se ofrece al cliente: revisá el estado, la muestra, las familias habilitadas y las fotos." : "Disponible para este mueble al guardar."}</p><div class="image-list">${v.images.map((url, i) => `<div class="image-item"><img src="${esc(url)}" alt="${esc(v.code)}, foto ${i + 1}"><small>Foto ${i + 1}</small><div class="variant-order"><button type="button" class="secondary" data-move-image="${i}" data-delta="-1" aria-label="Mover foto ${i + 1} antes" ${i === 0 ? "disabled" : ""}>↑</button><button type="button" class="secondary" data-move-image="${i}" data-delta="1" aria-label="Mover foto ${i + 1} después" ${i === v.images.length - 1 ? "disabled" : ""}>↓</button></div><label>Reemplazar foto ${i + 1}<input type="file" data-replace-variant="${i}" accept="image/jpeg,image/png,image/webp"></label><button type="button" class="secondary danger" data-remove-variant-image="${i}">Quitar foto</button></div>`).join("")}</div><label>Agregar imágenes preparadas<input type="file" data-upload-variant multiple accept="image/jpeg,image/png,image/webp"></label><button type="button" class="secondary danger" data-remove-association>Quitar asociación</button>`;
    list.append(card);
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
          throw Error("Máximo 12 fotos por mueble y variante.");
        for (const file of files) {
          const url = await upload(file, "product");
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
