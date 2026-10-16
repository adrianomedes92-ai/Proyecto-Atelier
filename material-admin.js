export function renderMaterialAdmin(
  editor,
  content,
  index,
  { esc, field, textarea, setIndex, upload, lock, changed, status, render },
) {
  const m = content.materials[index];
  editor.innerHTML = `<div class="editor-grid"><aside class="entity-list"><button id="new-material">＋ Agregar tela</button>${content.materials.map((m, i) => `<button data-family="${i}" aria-pressed="${i === index}">${esc(m.name)}<small>${esc(m.type)} · ${m.codes.length} variantes</small></button>`).join("")}</aside><section class="editor-card">${
    m
      ? `<div class="editor-toolbar"><h2>Telas y colores</h2><button id="delete-material" class="secondary danger">Eliminar tela</button></div><div class="field-grid">${field("Nombre de la tela", "name", m.name)}${field("Tipo de tela", "type", m.type)}${field("Código de la tela", "code", m.code || "")}</div>${textarea("Descripción", "description", m.description || "")}<h3>Variantes de color</h3><p class="hint">Cada código identifica un color de esta tela. Una variante inactiva conserva sus imágenes y asociaciones, pero no se ofrece al cliente. Subí muestras reales: recomendado 800 × 800 px. JPG, PNG o WebP, hasta 20 MB y 60 megapíxeles; se optimizan conservando el encuadre.</p>${m.codes
          .map((code, i) => {
            const v = m.swatches.find((s) => s.code === code) || {};
            return `<div class="swatch-row" data-color-row="${i}">${field("Código de la variante", "variant-code-" + i, code)}${field("Nombre del color", "variant-name-" + i, v.name || "")}<label class="check"><input type="checkbox" data-active="${i}" ${v.active !== false ? "checked" : ""}>Activa</label><div>${v.image ? `<img src="${esc(v.image)}" alt="Muestra ${esc(code)}"><button type="button" class="text-button" data-remove-swatch="${i}">Quitar muestra</button>` : ""}<label>Imagen de muestra<input type="file" data-swatch="${i}" accept="image/jpeg,image/png,image/webp"></label></div><button type="button" class="secondary danger" data-delete-code="${i}">Eliminar variante</button></div>`;
          })
          .join(
            "",
          )}<button type="button" id="add-code" class="secondary">＋ Agregar variante de color</button>`
      : "<h2>No hay telas cargadas</h2><p>Agregá una tela para cargar sus colores.</p>"
  }</section></div>`;
  const $ = (q) => editor.querySelector(q);
  function swatch(i) {
    const code = m.codes[i];
    let v = m.swatches.find((s) => s.code === code);
    if (!v) {
      v = { code, name: "", image: "", active: true };
      m.swatches.push(v);
    }
    return v;
  }
  $("#new-material").onclick = () => {
    content.materials.push({
      name: "Nueva tela " + (content.materials.length + 1),
      type: "Tela",
      code: "",
      description: "",
      codes: [],
      swatches: [],
    });
    setIndex(content.materials.length - 1);
    changed();
    render();
  };
  editor.querySelectorAll("[data-family]").forEach(
    (b) =>
      (b.onclick = () => {
        setIndex(Number(b.dataset.family));
        render();
      }),
  );
  if (!m) return;
  $("#delete-material").onclick = () => {
    if (
      !confirm(
        "Eliminar esta tela quita sus asociaciones de los muebles al guardar. Los archivos de imágenes se conservan. ¿Continuar?",
      )
    )
      return;
    for (const p of content.products) {
      p.materialNames = p.materialNames.filter((n) => n !== m.name);
      p.variants = (p.variants || []).filter((v) => v.material !== m.name);
    }
    content.materials.splice(index, 1);
    setIndex(0);
    changed();
    render();
  };
  editor.querySelectorAll("[data-field]").forEach(
    (input) =>
      (input.oninput = () => {
        const key = input.dataset.field;
        if (key === "name") {
          const old = m.name;
          m.name = input.value;
          for (const p of content.products) {
            p.materialNames = p.materialNames.map((n) =>
              n === old ? m.name : n,
            );
            for (const v of p.variants || [])
              if (v.material === old) v.material = m.name;
          }
        } else if (["code", "type", "description"].includes(key))
          m[key] = input.value;
        else if (key.startsWith("variant-name-"))
          swatch(Number(key.slice(13))).name = input.value;
        else if (key.startsWith("variant-code-")) {
          const i = Number(key.slice(13)),
            old = m.codes[i],
            v = swatch(i);
          m.codes[i] = input.value;
          v.code = input.value;
          for (const p of content.products)
            for (const assoc of p.variants || [])
              if (assoc.material === m.name && assoc.code === old)
                assoc.code = input.value;
        }
        changed();
      }),
  );
  editor.querySelectorAll("[data-active]").forEach(
    (input) =>
      (input.onchange = () => {
        swatch(Number(input.dataset.active)).active = input.checked;
        changed();
      }),
  );
  $("#add-code").onclick = () => {
    m.codes.push("");
    m.swatches.push({ code: "", name: "", image: "", active: true });
    changed();
    render();
  };
  editor.querySelectorAll("[data-delete-code]").forEach(
    (b) =>
      (b.onclick = () => {
        const i = Number(b.dataset.deleteCode),
          code = m.codes[i];
        if (
          !confirm(
            "Eliminar la variante quita sus asociaciones al guardar. Las fotos se conservan. ¿Continuar?",
          )
        )
          return;
        m.codes.splice(i, 1);
        m.swatches = m.swatches.filter((s) => s.code !== code);
        for (const p of content.products)
          p.variants = (p.variants || []).filter(
            (v) => v.material !== m.name || v.code !== code,
          );
        changed();
        render();
      }),
  );
  editor.querySelectorAll("[data-remove-swatch]").forEach(
    (b) =>
      (b.onclick = () => {
        swatch(Number(b.dataset.removeSwatch)).image = "";
        changed();
        render();
      }),
  );
  editor.querySelectorAll("[data-swatch]").forEach(
    (input) =>
      (input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;
        const i = Number(input.dataset.swatch);
        if (!m.codes[i].trim()) {
          status("Ingresá el código antes de cargar la muestra.", true);
          input.value = "";
          return;
        }
        lock(true);
        try {
          swatch(i).image = await upload(file, "swatch");
          changed();
          status("Muestra cargada en el borrador. Guardá los cambios.");
        } catch (e) {
          status(e.message, true);
        } finally {
          lock(false);
          render();
        }
      }),
  );
}
