export function renderMaterialAdmin(
  editor,
  content,
  index,
  { esc, field, textarea, setIndex, changed, render },
) {
  const m = content.materials[index];
  editor.innerHTML = `<div class="editor-grid"><aside class="entity-list"><button id="new-material">＋ Agregar tipo de tela</button>${content.materials.map((m, i) => `<button data-family="${i}" aria-pressed="${i === index}">${esc(m.name)}<small>${esc(m.type)} · ${m.colorCodes.length} colores habilitados</small></button>`).join("")}</aside><section class="editor-card">${m ? `<div class="editor-toolbar"><h2>Tipo de tela</h2><button id="delete-material" class="secondary danger">Eliminar tipo de tela</button></div><div class="field-grid">${field("Nombre de la tela", "name", m.name)}${field("Tipo / categoría", "type", m.type)}${field("Código de tela", "code", m.code || "")}</div>${textarea("Descripción", "description", m.description || "")}<h3>Colores disponibles en esta tela</h3><p class="hint">Marcá los colores que se pueden elegir con este tipo de tela. Se reutiliza el catálogo único de abajo. Desmarcar conserva el color y las fotos del mueble.</p><div class="checks color-availability">${content.colors.map((c, i) => `<label class="check"><input type="checkbox" data-color-choice="${i}" ${m.colorCodes.includes(c.code) ? "checked" : ""} ${!c.code ? "disabled" : ""}><span>${esc(c.name || "Sin nombre")} · ${esc(c.code || "Sin código")}${c.reviewRequired ? " (revisar nombre)" : ""}</span></label>`).join("")}</div>${content.colors.length ? "" : '<p class="hint">Agregá los colores al catálogo único de abajo y después habilitalos acá.</p>'}` : "<h2>No hay tipos de tela</h2><p>Agregá un tipo de tela para elegir sus colores.</p>"}</section></div><section class="editor-card color-catalog" id="color-catalog"><h2>Catálogo único de colores</h2><p class="hint">Cargá cada color una sola vez con su nombre y código. No hace falta subir muestras ni texturas. Las fotos del mueble se asignan en Productos → Imágenes por color.</p>${content.colors.map((c, i) => `<div class="color-catalog-row" data-global-color="${i}"><label>Nombre del color<input data-color-field="name" required value="${esc(c.name)}" maxlength="200"></label><label>Código del color<input data-color-field="code" required value="${esc(c.code)}" maxlength="200"></label><button type="button" class="secondary danger" data-delete-color="${i}">Eliminar color</button>${c.reviewRequired ? `<p class="migration-warning">Este código tenía nombres distintos: ${c.legacyNames.map(esc).join(", ")}. Elegí el nombre correcto; el color no se ofrece hasta confirmarlo.</p><button type="button" class="secondary" data-confirm-color="${i}">Confirmar nombre de este color</button>` : ""}</div>`).join("")}<button type="button" class="secondary" id="add-color">＋ Agregar color al catálogo</button></section>`;
  const $ = (q) => editor.querySelector(q);
  $("#new-material").onclick = () => {
    content.materials.push({
      name: "Nueva tela " + (content.materials.length + 1),
      type: "Tela",
      code: "",
      description: "",
      colorCodes: [],
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
  if (m) {
    $("#delete-material").onclick = () => {
      if (
        !confirm(
          "Eliminar este tipo de tela conserva el catálogo de colores y todas las galerías de los muebles. ¿Continuar?",
        )
      )
        return;
      for (const p of content.products)
        p.materialNames = p.materialNames.filter((n) => n !== m.name);
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
            for (const p of content.products)
              p.materialNames = p.materialNames.map((n) =>
                n === old ? m.name : n,
              );
          } else m[key] = input.value;
          changed();
        }),
    );
    editor.querySelectorAll("[data-color-choice]").forEach(
      (input) =>
        (input.onchange = () => {
          const code = content.colors[Number(input.dataset.colorChoice)].code;
          m.colorCodes = m.colorCodes.filter((c) => c !== code);
          if (input.checked) m.colorCodes.push(code);
          changed();
        }),
    );
  }
  $("#add-color").onclick = () => {
    content.colors.push({
      name: "",
      code: "",
      reviewRequired: false,
      legacyNames: [],
    });
    changed();
    render();
    editor.querySelector("[data-global-color]:last-of-type input")?.focus();
  };
  editor.querySelectorAll("[data-global-color]").forEach((row) => {
    const color = content.colors[Number(row.dataset.globalColor)];
    row.querySelectorAll("[data-color-field]").forEach(
      (input) =>
        (input.oninput = () => {
          if (input.dataset.colorField === "code") {
            const next = input.value.trim();
            if (
              !next ||
              content.colors.some((c) => c !== color && c.code.trim() === next)
            ) {
              input.setCustomValidity(
                next
                  ? "Este código ya está cargado en el catálogo."
                  : "Completá el código del color.",
              );
              return;
            }
            input.setCustomValidity("");
            const old = color.code;
            color.code = next;
            // No asociar referencias vacías de otros colores aún incompletos.
            if (old) {
              for (const fabric of content.materials)
                fabric.colorCodes = fabric.colorCodes.map((code) =>
                  code === old ? color.code : code,
                );
              for (const product of content.products)
                for (const v of product.variants || [])
                  if (v.code === old) v.code = color.code;
            }
          } else color.name = input.value;
          editor.querySelectorAll("[data-color-choice]").forEach((check) => {
            const c = content.colors[Number(check.dataset.colorChoice)];
            check.disabled = !c.code;
            check.nextElementSibling.textContent = `${c.name || "Sin nombre"} · ${c.code || "Sin código"}${c.reviewRequired ? " (revisar nombre)" : ""}`;
          });
          changed();
        }),
    );
  });
  editor.querySelectorAll("[data-confirm-color]").forEach(
    (b) =>
      (b.onclick = () => {
        content.colors[Number(b.dataset.confirmColor)].reviewRequired = false;
        changed();
        render();
      }),
  );
  editor.querySelectorAll("[data-delete-color]").forEach(
    (b) =>
      (b.onclick = () => {
        if (
          !confirm(
            "Eliminar este color quita sus casillas y galerías de todos los muebles al guardar. Los archivos de fotos se conservan. ¿Continuar?",
          )
        )
          return;
        const code = content.colors[Number(b.dataset.deleteColor)].code;
        for (const fabric of content.materials)
          fabric.colorCodes = fabric.colorCodes.filter((c) => c !== code);
        for (const p of content.products)
          p.variants = (p.variants || []).filter((v) => v.code !== code);
        content.colors.splice(Number(b.dataset.deleteColor), 1);
        changed();
        render();
      }),
  );
}
