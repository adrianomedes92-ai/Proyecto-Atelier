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
  const materials = array(value.materials, "Materiales", 100).map((m) => {
    const name = text(record(m, "Material").name, "Familia", 100),
      type = text(m.type, "Tipo", 100);
    if (!name || !type) fail("Completá nombre y tipo de cada familia.");
    const codes = strings(m.codes, "Códigos");
    if (new Set(codes).size !== codes.length || codes.some((c) => !c))
      fail("Los códigos deben ser únicos y no estar vacíos.");
    const swatches = array(m.swatches || [], "Muestras").map((s) => {
      record(s, "Muestra");
      if (s.active !== undefined && typeof s.active !== "boolean")
        fail("El estado de la variante debe ser activo o inactivo.");
      return {
        code: text(record(s, "Muestra").code, "Código", 200),
        image: image(s.image),
        name: text(s.name || "", "Nombre del color", 100),
        active: s.active !== false,
      };
    });
    if (
      swatches.some((s) => !codes.includes(s.code)) ||
      new Set(swatches.map((s) => s.code)).size !== swatches.length
    )
      fail("Cada muestra debe corresponder a un código único de la familia.");
    return {
      name,
      code: text(m.code || "", "Código de tela", 100),
      type,
      description: text(m.description || "", "Descripción de material"),
      codes,
      swatches,
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
    return {
      id,
      name,
      category,
      reference,
      description: text(p.description || "", "Descripción"),
      structure: text(p.structure || "", "Estructura", 200),
      visible: p.visible !== false,
      range,
      options,
      materialNames,
      legs: strings(p.legs || [], "Patas"),
      variants: variants(p.variants, materials),
      image: image(p.image),
      images: array(p.images || [], "Fotos", 12)
        .map(image)
        .filter(Boolean),
    };
  });
  if (new Set(products.map((p) => p.id)).size !== products.length)
    fail("Los IDs de productos deben ser únicos.");
  return { site, contact, materials, products };
}

function variants(value, materials) {
  const result = array(value || [], "Variantes por mueble", 200).map((v) => {
    record(v, "Variante por mueble");
    const material = text(v.material, "Tela asociada", 100),
      code = text(v.code, "Código de variante", 200);
    if (!materials.some((m) => m.name === material && m.codes.includes(code)))
      fail(
        "La variante asociada debe corresponder a una tela y código existentes.",
      );
    const images = array(v.images || [], "Fotos de variante", 12).map(image);
    if (images.some((url) => !url) || new Set(images).size !== images.length)
      fail("Las fotos de una variante deben ser válidas y no estar repetidas.");
    return { material, code, images };
  });
  if (
    new Set(result.map((v) => JSON.stringify([v.material, v.code]))).size !==
    result.length
  )
    fail("Cada mueble admite una sola asociación por tela y código.");
  return result;
}
