import { editMask } from "./mask-editor.js";
import {
  loadImage,
  paintUpholstery,
  previewDisclaimer,
} from "./upholstery-preview.js";
export function mountUpholsteryAdmin(
  parent,
  product,
  materials,
  { upload, lock, changed, status },
) {
  const config = (product.upholstery ||= {
    enabled: false,
    base: "",
    mask: "",
  });
  const section = document.createElement("section");
  section.className = "upholstery-admin";
  section.innerHTML = `<h3>Prueba de tapizados por máscara</h3><p class="hint">Habilitá primero un solo modelo y revisá la calidad con pocas variantes. Usá una foto frontal con tela neutra, buena luz y sombras visibles. La base se conserva completa (hasta 1600 px); no se recorta junto con las fotos del catálogo.</p><label class="check"><input type="checkbox" data-upholstery-enabled>Mostrar vista previa de tapizados en este modelo</label><label>Cargar o reemplazar imagen base<input type="file" data-upholstery-base accept="image/jpeg,image/png,image/webp"></label><div class="mask-tools"><button type="button" class="secondary" data-edit-mask>Crear o editar máscara</button><button type="button" class="secondary" data-remove-mask>Quitar máscara</button><button type="button" class="secondary" data-remove-base>Quitar base</button></div><p class="hint" data-mask-info></p><label>Variante para revisar (no modifica el catálogo)<select data-upholstery-variant></select></label><canvas data-upholstery-canvas role="img" aria-label="Vista previa del tapizado en el borrador"></canvas><p class="hint">${previewDisclaimer}</p><p class="hint" data-preview-status role="status"></p>`;
  parent.append(section);
  const $ = (q) => section.querySelector(q),
    variants = [];
  const select = $("[data-upholstery-variant]");
  select.add(new Option("Foto base, sin reemplazo", ""));
  for (const m of materials.filter(
    (m) =>
      !product.materialNames.length || product.materialNames.includes(m.name),
  )) {
    for (const code of m.codes) {
      const variant = m.swatches?.find((v) => v.code === code);
      if (!variant?.image) continue;
      variants.push({ material: m, variant });
      select.add(
        new Option(
          `${m.name}${m.code ? " · " + m.code : ""} / ${variant.name || code}${variant.name ? " · " + code : ""}`,
          String(variants.length - 1),
        ),
      );
    }
  }
  let request = 0;
  async function refresh() {
    $("[data-upholstery-enabled]").checked = config.enabled;
    $("[data-edit-mask]").disabled = !config.base;
    $("[data-remove-mask]").disabled = !config.mask;
    $("[data-remove-base]").disabled = !config.base;
    $("[data-mask-info]").textContent = config.mask
      ? "Máscara guardada en el borrador. Podés pintarla, borrarla o reemplazarla por PNG desde el editor."
      : "Todavía no hay máscara. La vista previa pública necesita una base y una máscara.";
    const canvas = $("[data-upholstery-canvas]");
    canvas.hidden = !config.base;
    if (!config.base) return;
    const current = ++request,
      chosen = select.value === "" ? null : variants[Number(select.value)],
      target = document.createElement("canvas");
    try {
      if (chosen && !config.mask)
        throw Error("Creá la máscara antes de revisar una variante.");
      await paintUpholstery(
        target,
        config,
        chosen?.variant,
        chosen?.material.texture,
      );
      if (current !== request || !section.isConnected) return;
      canvas.width = target.width;
      canvas.height = target.height;
      canvas.getContext("2d").drawImage(target, 0, 0);
      $("[data-preview-status]").textContent = "";
    } catch (e) {
      if (current === request && section.isConnected) {
        canvas.width = canvas.width;
        $("[data-preview-status]").textContent = e.message;
      }
    }
  }
  select.onchange = refresh;
  $("[data-upholstery-enabled]").onchange = async (e) => {
    if (e.target.checked && (!config.base || !config.mask)) {
      e.target.checked = false;
      status(
        "Cargá una base y una máscara antes de activar la vista previa.",
        true,
      );
      return;
    }
    config.enabled = e.target.checked;
    changed();
  };
  $("[data-upholstery-base]").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (
      config.base &&
      !confirm(
        "Reemplazar la base desactiva la vista previa y retira su máscara del borrador para evitar desalineaciones. Los archivos originales anteriores se conservan. ¿Continuar?",
      )
    ) {
      e.target.value = "";
      return;
    }
    lock(true);
    try {
      const url = await upload(file, "base");
      if (url) {
        config.base = url;
        config.mask = "";
        config.enabled = false;
        changed();
        status(
          "Base cargada. Creá o reemplazá la máscara y guardá los cambios.",
        );
      }
    } catch (e) {
      status(e.message, true);
    } finally {
      lock(false);
      refresh();
    }
  };
  $("[data-edit-mask]").onclick = async () => {
    lock(true);
    try {
      const file = await editMask(config);
      if (!file) return;
      const url = await upload(file, "mask");
      const [base, mask] = await Promise.all([
        loadImage(config.base),
        loadImage(url),
      ]);
      if (
        base.naturalWidth !== mask.naturalWidth ||
        base.naturalHeight !== mask.naturalHeight
      )
        throw Error("Las dimensiones de la máscara no coinciden con la base.");
      config.mask = url;
      changed();
      status(
        "Máscara actualizada en el borrador. Activá la vista previa si corresponde y guardá los cambios.",
      );
    } catch (e) {
      status(e.message, true);
    } finally {
      lock(false);
      refresh();
    }
  };
  $("[data-remove-mask]").onclick = () => {
    config.mask = "";
    config.enabled = false;
    changed();
    refresh();
  };
  $("[data-remove-base]").onclick = () => {
    config.base = "";
    config.mask = "";
    config.enabled = false;
    changed();
    refresh();
  };
  refresh();
}
