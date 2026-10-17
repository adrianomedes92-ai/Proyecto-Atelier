import { migrateSections } from "./catalog-sections.js";
import { migrateColorCatalog } from "./color-catalog-migration.js";
const fail = (message) => {
  throw Object.assign(new Error(message), { status: 400 });
};
const text = (v, label, max = 4000) => {
  if (typeof v !== "string" || v.length > max)
    fail(`${label}: texto inválido.`);
  return v.trim();
};
const array = (v, label, max = 200) => {
  if (!Array.isArray(v) || v.length > max) fail(`${label}: lista inválida.`);
  return v;
};
const record = (value, label) => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail(`${label}: datos inválidos.`);
  return value;
};
const image = (v) => {
  if (!v) return "";
  const s = text(v, "Imagen", 250);
  if (
    !/^\/uploads\/[a-f0-9-]+(?:-(?:optimized|card))?\.(png|jpg|webp)$/.test(
      s,
    ) &&
    !/^\/images\/[a-zA-Z0-9_/-]+\.(png|jpg|jpeg|webp)$/.test(s)
  )
    fail("La imagen debe cargarse desde el panel o estar en /images/.");
  return s;
};
const strings = (v, label) => array(v, label).map((x) => text(x, label, 200));
export function validateContent(value) {
  if (!value || typeof value !== "object") fail("Contenido inválido.");
  value = migrateSections(migrateColorCatalog(value));
  const sections = array(value.sections, "Secciones", 100).map((s) => {
    record(s, "Sección");
    const node = (n) => {
      record(n, "Categoría");
      const id = text(n.id, "ID de categoría", 100),
        name = text(n.name, "Nombre de categoría", 100);
      if (!/^[a-z0-9-]+$/.test(id) || !name || typeof n.active !== "boolean")
        fail("Completá nombre, ID y estado de la categoría.");
      return { id, name, active: n.active };
    };
    return {
      ...node(s),
      subsections: array(s.subsections, "Subsecciones", 200).map(node),
    };
  });
  const ids = sections.flatMap((s) => [
    s.id,
    ...s.subsections.map((x) => x.id),
  ]);
  if (new Set(ids).size !== ids.length)
    fail("Los identificadores de categorías deben ser únicos.");
  const site = {};
  for (const key of [
    "name",
    "heroTitle",
    "heroDescription",
    "tagline",
    "shipping",
    "collectionTitle",
    "collectionDescription",
    "contactTitle",
    "contactDescription",
    "footer",
    "heroButton",
    "collectionEyebrow",
    "contactEyebrow",
  ])
    site[key] = text(value.site?.[key], key);
  site.brandFontSize = value.site.brandFontSize ?? 22;
  if (
    !Number.isInteger(site.brandFontSize) ||
    site.brandFontSize < 16 ||
    site.brandFontSize > 36
  )
    fail("El tamaño de la marca debe ser un número entero entre 16 y 36 px.");
  const legacyHeroImage = image(value.site.heroImage);
  // La imagen única de versiones anteriores se conserva al actualizar.
  site.heroImages =
    value.site.heroImages === undefined
      ? legacyHeroImage
        ? [legacyHeroImage]
        : []
      : array(value.site.heroImages, "Imágenes de portada", 12).map(image);
  if (
    site.heroImages.some((url) => !url) ||
    new Set(site.heroImages).size !== site.heroImages.length
  )
    fail("Las imágenes de portada deben ser válidas y no estar repetidas.");
  site.heroImage = site.heroImages[0] || "";
  site.steps = array(value.site.steps, "Pasos", 3).map((step) => ({
    title: text(record(step, "Paso").title, "Título del paso", 100),
    description: text(step.description, "Descripción del paso", 500),
  }));
  if (site.steps.length !== 3) fail("El proceso debe tener tres pasos.");
  if (!site.name || !site.heroTitle)
    fail("Completá el nombre y el título de inicio.");
  const contact = {
    display: text(value.contact?.display, "Teléfono", 100),
    whatsappInternational: text(
      value.contact?.whatsappInternational,
      "WhatsApp",
      20,
    ),
    people: strings(value.contact?.people, "Contactos"),
  };
  if (
    contact.whatsappInternational &&
    !/^\d{10,15}$/.test(contact.whatsappInternational)
  )
    fail(
      "WhatsApp: usá entre 10 y 15 dígitos, con prefijo internacional, sin + ni espacios.",
    );
  const colors = array(value.colors, "Catálogo de colores", 20000).map((c) => {
    record(c, "Color");
    const code = text(c.code, "Código de color", 200),
      name = text(c.name, "Nombre de color", 200);
    if (!code || !name) fail("Completá el nombre y código de cada color.");
    if (c.reviewRequired !== undefined && typeof c.reviewRequired !== "boolean")
      fail("Estado de revisión inválido.");
    return {
      code,
      name,
      reviewRequired: c.reviewRequired === true,
      legacyNames: strings(c.legacyNames || [], "Nombres anteriores"),
    };
  });
  if (new Set(colors.map((c) => c.code)).size !== colors.length)
    fail("Cada código de color debe cargarse una sola vez en el catálogo.");
  const materials = array(value.materials, "Materiales", 100).map((m) => {
    record(m, "Tipo de tela");
    const name = text(m.name, "Tela", 100),
      type = text(m.type, "Tipo", 100),
      colorCodes = strings(m.colorCodes || [], "Colores habilitados");
    if (!name || !type) fail("Completá nombre y tipo de cada tela.");
    if (
      new Set(colorCodes).size !== colorCodes.length ||
      colorCodes.some((code) => !colors.some((c) => c.code === code))
    )
      fail("La tela debe habilitar colores únicos existentes en el catálogo.");
    return {
      name,
      type,
      code: text(m.code || "", "Código de tela", 100),
      description: text(m.description || "", "Descripción"),
      colorCodes,
    };
  });
  if (new Set(materials.map((m) => m.name)).size !== materials.length)
    fail("Los nombres de familias deben ser únicos.");
  const products = array(value.products, "Productos").map((p) => {
    const id = text(record(p, "Producto").id, "ID", 100),
      name = text(p.name, "Modelo", 100),
      category = text(p.category, "Categoría", 100);
    if (!/^[a-z0-9-]+$/.test(id) || !name || !category)
      fail("Producto: completá nombre, categoría e ID válido.");
    const reference = text(p.reference || "", "Medidas", 200);
    const options = strings(p.options, "Opciones");
    if (
      options.some(
        (o) => !["material", "measure", "color", "layout", "notes"].includes(o),
      )
    )
      fail("Opción desconocida.");
    if (options.includes("measure") && !reference)
      fail(
        `${name}: ingresá medidas de referencia o desactivá la opción de medidas.`,
      );
    let range = null;
    if (p.range) {
      if (
        !Array.isArray(p.range) ||
        p.range.length !== 2 ||
        p.range.some(
          (n) => typeof n !== "number" || !Number.isFinite(n) || n <= 0,
        ) ||
        p.range[0] > p.range[1]
      )
        fail(`${name}: rango de ancho inválido.`);
      range = p.range;
    }
    const materialNames = strings(
      p.materialNames || [],
      "Familias habilitadas",
    );
    if (materialNames.some((n) => !materials.some((m) => m.name === n)))
      fail(`${name}: hay familias que ya no existen.`);
    if (options.includes("material") && !materials.length)
      fail(`${name}: cargá al menos una familia de tapizado.`);
    const sectionId = text(p.sectionId, "Sección del producto", 100),
      subsectionId = text(p.subsectionId ?? "", "Subsección", 100);
    const section = sections.find((s) => s.id === sectionId);
    if (
      !section ||
      (subsectionId && !section.subsections.some((s) => s.id === subsectionId))
    )
      fail(`${name}: elegí una sección y subsección válidas.`);
    const sortOrder = p.sortOrder ?? 0;
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 1000000)
      fail("Orden de producto inválido.");
    return {
      id,
      name,
      category,
      sectionId,
      subsectionId,
      sortOrder,
      reference,
      description: text(p.description || "", "Descripción"),
      structure: text(p.structure || "", "Estructura", 200),
      visible: p.visible !== false,
      range,
      options,
      materialNames,
      legs: strings(p.legs || [], "Patas"),
      variants: variants(p.variants, colors),
      image: image(p.image),
      images: array(p.images || [], "Fotos", 12)
        .map(image)
        .filter(Boolean),
    };
  });
  if (new Set(products.map((p) => p.id)).size !== products.length)
    fail("Los IDs de productos deben ser únicos.");
  return {
    catalogVersion: 2,
    taxonomyVersion: 1,
    sections,
    site,
    contact,
    colors,
    materials,
    products,
  };
}

function variants(value, colors) {
  const result = array(value || [], "Colores por mueble", 20000).map((v) => {
    record(v, "Galería de color");
    const code = text(v.code, "Código de color", 200);
    if (!colors.some((c) => c.code === code))
      fail("La galería debe corresponder a un código del catálogo de colores.");
    const images = array(v.images || [], "Fotos de color", 1200).map(image);
    if (images.some((url) => !url) || new Set(images).size !== images.length)
      fail("Las fotos de una galería deben ser válidas y no estar repetidas.");
    if (v.reviewRequired !== undefined && typeof v.reviewRequired !== "boolean")
      fail("Estado de revisión de galería inválido.");
    return { code, images, reviewRequired: v.reviewRequired === true };
  });
  if (new Set(result.map((v) => v.code)).size !== result.length)
    fail("Cada mueble admite una sola galería por código de color.");
  return result;
}
