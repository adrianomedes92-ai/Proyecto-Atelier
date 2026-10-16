export function addUpholsteryDemo(content) {
  const id = "prueba-tapizado";
  if (content.products.some((p) => p.id === id)) return id;
  const family = "Tela de demostración";
  if (!content.materials.some((m) => m.name === family))
    content.materials.push({
      name: family,
      code: "DEMO-T01",
      type: "Tela",
      description:
        "Muestras sintéticas de prueba. No representan telas disponibles para venta.",
      texture: "/images/demo/texture.webp",
      codes: ["DEMO-A", "DEMO-O", "DEMO-Z"],
      swatches: [
        ["DEMO-A", "Arena", "arena"],
        ["DEMO-O", "Oliva", "oliva"],
        ["DEMO-Z", "Azul", "azul"],
      ].map(([code, name, file]) => ({
        code,
        name,
        image: "/images/demo/" + file + ".webp",
      })),
    });
  content.products.push({
    id,
    name: "Prueba visual · sillón de demostración",
    category: "Prueba de tapizados",
    description:
      "Imagen generada para evaluar la herramienta; no representa un modelo real del catálogo.",
    reference: "",
    structure: "",
    visible: false,
    range: null,
    options: ["material", "notes"],
    materialNames: [family],
    legs: [],
    image: "/images/demo/armchair-base.png",
    images: ["/images/demo/armchair-base.png"],
    upholstery: {
      enabled: true,
      base: "/images/demo/armchair-base.png",
      mask: "/images/demo/armchair-mask.png",
    },
  });
  return id;
}
