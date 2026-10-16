// La galería pertenece al mueble + código. La tela solo habilita colores.
export function variantsFor(product, materials, colors) {
  const result = [];
  for (const material of materials) {
    if (
      product.materialNames?.length &&
      !product.materialNames.includes(material.name)
    )
      continue;
    for (const code of material.colorCodes || []) {
      const variant = colors.find((c) => c.code === code),
        gallery = product.variants?.find((v) => v.code === code);
      if (
        !variant ||
        variant.reviewRequired ||
        !gallery?.images.length ||
        gallery.reviewRequired
      )
        continue;
      result.push({ material, variant, images: gallery.images });
    }
  }
  return result;
}
export function mountVariantGallery(container, images, label) {
  container.replaceChildren();
  if (!images.length) return;
  const stage = document.createElement("div");
  stage.className = "variant-gallery";
  stage.tabIndex = 0;
  stage.setAttribute("aria-label", "Imágenes de " + label);
  stage.setAttribute("role", "group");
  const photo = document.createElement("img");
  photo.decoding = "async";
  const error = document.createElement("p");
  error.className = "hint";
  error.setAttribute("role", "status");
  photo.onerror = () => {
    error.textContent =
      "No se pudo cargar esta foto. Podés probar otra imagen de la galería o consultar con la fábrica.";
  };
  stage.append(photo);
  let index = 0,
    start = null;
  const counter = document.createElement("span");
  counter.className = "gallery-position";
  counter.setAttribute("aria-live", "polite");
  counter.setAttribute("aria-atomic", "true");
  function update() {
    error.textContent = "";
    photo.src = images[index];
    photo.alt = `${label}, foto ${index + 1} de ${images.length}`;
    counter.textContent = `${index + 1} de ${images.length}`;
  }
  function step(delta) {
    index = (index + delta + images.length) % images.length;
    update();
  }
  if (images.length > 1) {
    for (const [delta, title, symbol] of [
      [-1, "Foto anterior", "‹"],
      [1, "Foto siguiente", "›"],
    ]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className =
        "gallery-nav " + (delta < 0 ? "gallery-previous" : "gallery-next");
      button.dataset.variantStep = delta;
      button.setAttribute("aria-label", title);
      button.textContent = symbol;
      button.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        step(delta);
      };
      stage.append(button);
    }
    stage.append(counter);
    stage.onkeydown = (e) => {
      if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
      e.preventDefault();
      e.stopPropagation();
      step(e.key === "ArrowLeft" ? -1 : 1);
    };
    stage.onpointerdown = (e) => {
      if (
        e.isPrimary &&
        e.pointerType === "touch" &&
        !e.target.closest("button")
      ) {
        start = { id: e.pointerId, x: e.clientX, y: e.clientY };
        stage.setPointerCapture(e.pointerId);
      }
    };
    stage.onpointerup = (e) => {
      if (!start || start.id !== e.pointerId) return;
      const dx = e.clientX - start.x,
        dy = e.clientY - start.y;
      start = null;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3)
        step(dx < 0 ? 1 : -1);
    };
    stage.onpointercancel = () => (start = null);
  }
  container.append(stage, error);
  update();
}
