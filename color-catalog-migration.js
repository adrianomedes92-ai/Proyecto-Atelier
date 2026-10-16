// Migración aditiva en memoria. Los servidores conservan el JSON anterior antes de escribir.
const fail = () => {
  throw Object.assign(
    Error("El catálogo anterior de telas y colores contiene datos inválidos."),
    { status: 400 },
  );
};
const list = (value) => {
  if (!Array.isArray(value)) fail();
  return value;
};
const text = (value) => {
  if (typeof value !== "string") fail();
  return value.trim();
};
export function migrateColorCatalog(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) fail();
  if (input.colors !== undefined) return input;
  const value = structuredClone(input),
    colors = new Map();
  for (const m of list(value.materials)) {
    if (!m || typeof m !== "object") fail();
    m.name = text(m.name);
    const codes = list(m.codes || []).map(text),
      swatches = list(m.swatches || []);
    if (new Set(codes).size !== codes.length || codes.some((c) => !c)) fail();
    for (const s of swatches) {
      if (
        !s ||
        !codes.includes(text(s.code)) ||
        (s.active !== undefined && typeof s.active !== "boolean")
      )
        fail();
    }
    m.colorCodes = [];
    for (const code of codes) {
      const swatch = swatches.find((s) => text(s.code) === code),
        name = swatch?.name ? text(swatch.name) : "";
      let color = colors.get(code);
      if (!color) {
        color = {
          code,
          name: name || code,
          reviewRequired: false,
          legacyNames: [],
        };
        colors.set(code, color);
      }
      const names = color.legacyNames;
      if (name && !names.includes(name)) names.push(name);
      if (names.length > 1) color.reviewRequired = true;
      if (names.length === 1) color.name = names[0];
      if (swatch?.active !== false) m.colorCodes.push(code);
    }
    delete m.codes;
    delete m.swatches;
    delete m.texture;
  }
  for (const p of list(value.products)) {
    if (!p || typeof p !== "object") fail();
    const galleries = new Map();
    for (const old of list(p.variants || [])) {
      if (!old || typeof old !== "object") fail();
      const code = text(old.code),
        material = text(old.material);
      if (!value.materials.some((m) => m.name.trim() === material)) fail();
      // El código debe existir en esa tela de origen, incluso si estaba inactivo.
      const original = input.materials.find((m) => m.name.trim() === material);
      if (!original.codes.some((c) => text(c) === code)) fail();
      const images = list(old.images || []).map(text);
      let gallery = galleries.get(code);
      if (!gallery) {
        gallery = { code, images: [...new Set(images)], reviewRequired: false };
        galleries.set(code, gallery);
      } else {
        if (
          images.length &&
          gallery.images.length &&
          JSON.stringify(images) !== JSON.stringify(gallery.images)
        )
          gallery.reviewRequired = true;
        gallery.images = [...new Set([...gallery.images, ...images])];
      }
    }
    p.variants = [...galleries.values()];
  }
  value.colors = [...colors.values()];
  value.catalogVersion = 2;
  return value;
}
