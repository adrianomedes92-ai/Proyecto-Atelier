import { materials, colors, availableVariants, site } from "./data.js";
export function validate(product, s) {
  const errors = [];
  const variants = availableVariants(product);
  if (product.options.includes("material")) {
    if (
      variants.length &&
      !variants.some((v) => v.material.name === s.material)
    )
      errors.push("Elegí una tela disponible para este mueble.");
    else if (
      s.material &&
      !variants.some(
        (v) => v.material.name === s.material && v.variant.code === s.color,
      )
    )
      errors.push("Elegí un color disponible con imágenes para este mueble.");
    else if (!variants.length && (s.material || s.color))
      errors.push(
        "La combinación elegida ya no está disponible para este mueble.",
      );
  }
  if (product.options.includes("measure")) {
    if (!["reference", "custom", "range"].includes(s.measure))
      errors.push("Elegí una medida.");
    if (s.measure === "custom" && !s.custom?.trim())
      errors.push("Escribí las medidas que querés consultar.");
    if (
      s.measure === "range" &&
      (!product.range ||
        !Number.isFinite(Number(s.width)) ||
        Number(s.width) < product.range[0] ||
        Number(s.width) > product.range[1])
    )
      errors.push("Ingresá un ancho dentro del rango del catálogo.");
  }
  if (s.leg && !product.legs.includes(s.leg))
    errors.push("Elegí una variante de patas disponible.");
  if (product.options.includes("layout") && !s.layout?.trim())
    errors.push("Contanos cómo querés configurar el modular.");
  return errors;
}
export function message(product, s) {
  const m = materials.find((m) => m.name === s.material);
  return [
    `Hola, ${site.name}. Quiero pedir una cotización:`,
    `Modelo: ${product.name}`,
    product.reference &&
      `Medida de referencia del catálogo: ${product.reference}`,
    product.options.includes("measure") &&
      `Medida solicitada: ${s.measure === "custom" ? s.custom : s.measure === "range" ? s.width + " cm de ancho (otras dimensiones a confirmar)" : product.reference}`,
    product.options.includes("material") &&
      m &&
      `Tapizado: ${m.type} · ${m.name}${m.code ? " · Código de tela: " + m.code : ""}`,
    (product.options.includes("material") ||
      product.options.includes("color")) &&
      `Color: ${colors.find((v) => v.code === s.color)?.name ? colors.find((v) => v.code === s.color).name + " · " : ""}${s.color || "A definir con la fábrica; solicitar muestrario"}`,
    s.leg && `Patas: ${s.leg}`,
    s.layout && `Configuración modular: ${s.layout}`,
    s.notes?.trim() && `Observaciones: ${s.notes.trim()}`,
    product.category === "Puffs" && "Consultar disponibilidad.",
    "¿Me comparten las opciones disponibles y la cotización?",
  ]
    .filter(Boolean)
    .join("\n");
}
export function whatsappLink(phone, text) {
  if (!/^\d{10,15}$/.test(phone)) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
