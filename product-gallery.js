import { cardImage } from "./image-urls.js";
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function productImages(product) {
  return [
    ...new Set([product.image, ...(product.images || [])].filter(Boolean)),
  ];
}
export function setupProductGallery({ container, dialog, getProduct }) {
  const positions = new Map();
  let active = null,
    gesture = null;
  const image = dialog.querySelector("[data-lightbox-image]");
  const title = dialog.querySelector("#lightbox-title");
  const position = dialog.querySelector("[data-lightbox-position]");
  const stage = dialog.querySelector("[data-lightbox-stage]");
  const previous = dialog.querySelector('[data-lightbox-step="-1"]');
  const next = dialog.querySelector('[data-lightbox-step="1"]');
  function index(product) {
    return (
      (positions.get(product.id) || 0) % (productImages(product).length || 1)
    );
  }
  function renderCard(product, shade) {
    const images = productImages(product),
      current = index(product);
    return `<div class="product-photo shade-${shade}" data-gallery-card="${escape(product.id)}">${images.length ? `<button type="button" class="gallery-open" data-gallery-open="${escape(product.id)}" aria-label="Ampliar foto ${current + 1} de ${escape(product.name)}" aria-haspopup="dialog" aria-controls="product-lightbox"><img src="${escape(cardImage(images[current]))}" alt="${escape(product.name)}, foto ${current + 1}" loading="lazy"><span class="product-arrow" aria-hidden="true">↗</span></button>${images.length > 1 ? `<button type="button" class="gallery-nav gallery-previous" data-gallery-step="-1" aria-label="Foto anterior de ${escape(product.name)}">‹</button><button type="button" class="gallery-nav gallery-next" data-gallery-step="1" aria-label="Foto siguiente de ${escape(product.name)}">›</button><span class="gallery-position" aria-live="polite" aria-atomic="true">${current + 1} de ${images.length}</span>` : ""}` : '<span class="placeholder-mark">ATELIER</span><span class="placeholder-label">Fotografía pendiente</span>'}</div>`;
  }
  function updateCard(product) {
    const card = container.querySelector(`[data-gallery-card="${product.id}"]`);
    if (!card) return;
    const images = productImages(product),
      current = index(product);
    const photo = card.querySelector("img");
    photo.src = cardImage(images[current]);
    photo.alt = `${product.name}, foto ${current + 1}`;
    card
      .querySelector("[data-gallery-open]")
      .setAttribute(
        "aria-label",
        `Ampliar foto ${current + 1} de ${product.name}`,
      );
    const count = card.querySelector(".gallery-position");
    if (count) count.textContent = `${current + 1} de ${images.length}`;
  }
  function updateLightbox() {
    if (!active) return;
    const images = productImages(active),
      current = index(active);
    image.src = images[current];
    image.alt = `${active.name}, foto ${current + 1} de ${images.length}`;
    title.textContent = active.name;
    previous.hidden = next.hidden = position.hidden = images.length < 2;
    position.textContent = `${current + 1} de ${images.length}`;
  }
  function step(product, delta) {
    const count = productImages(product).length;
    if (count < 2) return;
    positions.set(product.id, (index(product) + delta + count) % count);
    updateCard(product);
    if (active?.id === product.id) updateLightbox();
  }
  container.addEventListener(
    "click",
    (event) => {
      const button = event.target.closest(
        "[data-gallery-step], [data-gallery-open]",
      );
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      const product = getProduct(
        button.closest("[data-gallery-card]").dataset.galleryCard,
      );
      if (!product) return;
      if (button.hasAttribute("data-gallery-step")) {
        step(product, Number(button.dataset.galleryStep));
        return;
      }
      active = product;
      updateLightbox();
      dialog.showModal();
      document.body.classList.add("gallery-is-open");
    },
    { capture: true },
  );
  previous.addEventListener("click", (event) => {
    event.stopPropagation();
    if (active) step(active, -1);
  });
  next.addEventListener("click", (event) => {
    event.stopPropagation();
    if (active) step(active, 1);
  });
  dialog
    .querySelector("[data-lightbox-close]")
    .addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    event.stopPropagation();
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      dialog.close();
  });
  dialog.addEventListener("keydown", (event) => {
    if (!active || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    step(active, event.key === "ArrowLeft" ? -1 : 1);
  });
  dialog.addEventListener("close", () => {
    document.body.classList.remove("gallery-is-open");
    active = null;
    gesture = null;
    image.removeAttribute("src");
  });
  stage.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary) {
      gesture = null;
      return;
    }
    if (event.pointerType !== "touch" || event.target.closest("button")) return;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
    stage.setPointerCapture(event.pointerId);
  });
  stage.addEventListener("pointerup", (event) => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x,
      dy = event.clientY - gesture.y;
    gesture = null;
    if (active && Math.abs(dx) >= 45 && Math.abs(dx) > Math.abs(dy) * 1.3)
      step(active, dx < 0 ? 1 : -1);
  });
  stage.addEventListener("pointercancel", () => {
    gesture = null;
  });
  return { renderCard };
}
