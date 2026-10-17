// Se ejecuta una sola vez sobre catálogos anteriores; los nombres siguientes son semillas editables.
export function migrateSections(value) {
  if (value.sections !== undefined) return value;
  const categories = [
    ...new Set((value.products || []).map((p) => p.category).filter(Boolean)),
  ];
  const names = [
    ...new Set([
      "Individuales",
      "Sillones",
      "Modulares",
      "Puffs",
      ...categories,
    ]),
  ];
  const sections = [
    {
      id: "sillones",
      name: "Sillones",
      active: true,
      subsections: names.map((name, i) => ({
        id: `tapizados-${i + 1}`,
        name,
        active: true,
      })),
    },
    {
      id: "muebles-de-madera",
      name: "Muebles de madera",
      active: true,
      subsections: [
        "Racks",
        "Mesas de luz",
        "Mesas ratonas",
        "Mesas",
        "Sillas",
        "Estanterías",
      ].map((name, i) => ({ id: `madera-${i + 1}`, name, active: true })),
    },
  ];
  return {
    ...value,
    sections,
    taxonomyVersion: 1,
    products: (value.products || []).map((p, i) => ({
      ...p,
      sectionId: "sillones",
      subsectionId:
        sections[0].subsections.find((s) => s.name === p.category)?.id || "",
      sortOrder: i,
    })),
  };
}
export function productVisible(product, sections) {
  const section = sections.find((s) => s.id === product.sectionId);
  return (
    product.visible !== false &&
    !!section?.active &&
    (!product.subsectionId ||
      section.subsections.some(
        (s) => s.id === product.subsectionId && s.active,
      ))
  );
}
export function publicCatalog(content) {
  const products = content.products.filter((p) =>
    productVisible(p, content.sections),
  );
  return {
    ...content,
    products,
    sections: content.sections
      .filter((s) => s.active && products.some((p) => p.sectionId === s.id))
      .map((s) => ({
        ...s,
        subsections: s.subsections.filter(
          (sub) =>
            sub.active &&
            products.some(
              (p) => p.subsectionId === sub.id && p.sectionId === s.id,
            ),
        ),
      })),
  };
}
export const orderedProducts = (products) =>
  products.slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
