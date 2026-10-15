// Mantiene el panel gráfico original hasta tener una foto decodificada.
export function setupHeroSlideshow(container, site) {
  const urls = site.heroImages ?? (site.heroImage ? [site.heroImage] : []);
  if (!urls.length) return () => {};
  const region = document.createElement("div");
  region.className = "hero-slideshow";
  region.setAttribute("role", "region");
  region.setAttribute("aria-roledescription", "carrusel");
  region.setAttribute("aria-label", `Imágenes de portada de ${site.name}`);
  const slides = document.createElement("div");
  slides.className = "hero-slides";
  slides.setAttribute("aria-hidden", "true");
  const images = urls.map(() => {
    const img = new Image();
    img.className = "hero-slide";
    img.alt = "";
    img.decoding = "async";
    slides.append(img);
    return img;
  });
  region.append(slides);
  const controls = document.createElement("div");
  controls.className = "hero-slide-controls";
  controls.hidden = urls.length < 2;
  controls.innerHTML =
    '<button type="button" data-hero-previous aria-label="Imagen de portada anterior">‹</button><button type="button" data-hero-pause aria-label="Pausar presentación">Pausar</button><span data-hero-position aria-atomic="true"></span><button type="button" data-hero-next aria-label="Imagen de portada siguiente">›</button>';
  region.append(controls);
  container.append(region);
  const previous = controls.querySelector("[data-hero-previous]"),
    next = controls.querySelector("[data-hero-next]"),
    pause = controls.querySelector("[data-hero-pause]"),
    position = controls.querySelector("[data-hero-position]");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let timer,
    active = -1,
    paused = false,
    hovered = false,
    focused = false,
    playWhileFocused = false,
    generation = 0,
    destroyed = false;
  const loading = new Map();
  function clearTimer() {
    clearTimeout(timer);
    timer = undefined;
    region.dataset.playing = "false";
  }
  function schedule() {
    clearTimer();
    if (
      destroyed ||
      urls.length < 2 ||
      active < 0 ||
      paused ||
      motion.matches ||
      hovered ||
      (focused && !playWhileFocused) ||
      document.hidden
    )
      return;
    region.dataset.playing = "true";
    timer = setTimeout(() => goTo(active + 1, 1), 5000);
  }
  function updateControls() {
    pause.hidden = motion.matches;
    pause.textContent = paused ? "Reproducir" : "Pausar";
    pause.setAttribute(
      "aria-label",
      paused ? "Reproducir presentación" : "Pausar presentación",
    );
    position.setAttribute(
      "aria-live",
      paused || motion.matches ? "polite" : "off",
    );
    position.textContent = `${active + 1} de ${urls.length}`;
  }
  function load(index) {
    if (!loading.has(index))
      loading.set(
        index,
        (async () => {
          images[index].src = urls[index];
          try {
            await images[index].decode();
            return true;
          } catch {
            return false;
          }
        })(),
      );
    return loading.get(index);
  }
  async function goTo(target, direction = 1) {
    clearTimer();
    const request = ++generation;
    for (let attempts = 0; attempts < urls.length; attempts++) {
      const index =
        (((target + attempts * direction) % urls.length) + urls.length) %
        urls.length;
      const loaded = await load(index);
      if (destroyed || request !== generation) return;
      if (!loaded) continue;
      if (active >= 0) images[active].classList.remove("is-active");
      active = index;
      images[active].classList.add("is-active");
      container.classList.add("hero-ready");
      updateControls();
      schedule();
      if (urls.length > 1) load((active + 1) % urls.length);
      return;
    }
    // Si ninguna foto funciona, queda visible la portada gráfica original.
  }
  function manual(direction) {
    paused = true;
    goTo(active + direction, direction);
  }
  previous.addEventListener("click", () => manual(-1));
  next.addEventListener("click", () => manual(1));
  pause.addEventListener("click", () => {
    paused = !paused;
    playWhileFocused = !paused;
    updateControls();
    schedule();
  });
  region.addEventListener("mouseenter", () => {
    hovered = true;
    clearTimer();
  });
  region.addEventListener("mouseleave", () => {
    hovered = false;
    schedule();
  });
  region.addEventListener("focusin", () => {
    focused = true;
    clearTimer();
  });
  region.addEventListener("focusout", (event) => {
    if (region.contains(event.relatedTarget)) return;
    focused = false;
    playWhileFocused = false;
    schedule();
  });
  region.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      manual(event.key === "ArrowLeft" ? -1 : 1);
    }
  });
  function motionChanged() {
    updateControls();
    schedule();
  }
  function visibilityChanged() {
    schedule();
  }
  motion.addEventListener("change", motionChanged);
  document.addEventListener("visibilitychange", visibilityChanged);
  goTo(0);
  return () => {
    destroyed = true;
    generation++;
    clearTimer();
    motion.removeEventListener("change", motionChanged);
    document.removeEventListener("visibilitychange", visibilityChanged);
    region.remove();
    container.classList.remove("hero-ready");
  };
}
