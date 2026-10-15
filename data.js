// Verificar con la fábrica si corresponde 54 + 11 o 54 + 9 + 11 antes de publicar.
export let contact = {
  display: "11-73730703",
  whatsappInternational: "",
  people: ["Guillermo Barzola", "Agustín Omedes"],
};
// Cargar aquí los códigos exactos del catálogo, nunca colores aproximados.
export let materials = [
  ...["PANNE", "MECHA", "ZEPPELIN", "DONN", "BOUCLÉ"].map((name) => ({
    name,
    type: "Tela",
    codes: [],
  })),
  ...["TITANIUM", "TALAMPAYA"].map((name) => ({
    name,
    type: "Ecocuero",
    codes: [],
  })),
];
export let products = [
  ["clapton-individual", "Clapton Individual", "Individuales", "65 × 90 cm"],
  ["baby-clapton", "Baby Clapton", "Individuales", "50 × 50 cm", [50, 100]],
  [
    "clapton-dos",
    "Clapton de dos cuerpos",
    "Sillones",
    "190 × 90 cm",
    [160, 250],
  ],
  [
    "clapton-martillo",
    "Clapton Martillo",
    "Sillones",
    "190 × 90 cm",
    [140, 200],
  ],
  [
    "sillon-cama",
    "Sillón Cama",
    "Sillones",
    "220 × 90 cm",
    null,
    "Cama de referencia: 180 × 140 cm.",
  ],
  ["sillon-cine", "Sillón Cine", "Sillones", "298 × 100 cm"],
  [
    "clapton-modular",
    "Clapton Modular",
    "Modulares",
    "298 × 100 cm",
    null,
    "Múltiples configuraciones de armado.",
  ],
  ["italiano", "Modelo Italiano", "Sillones", "180 × 90 cm", [140, 200]],
  ["oruga-v", "Puff Oruga V", "Puffs"],
  ["oruga-h", "Puff Oruga H", "Puffs"],
  ["oruga-mini", "Oruga H Mini", "Puffs"],
].map(([id, name, category, reference, range, description]) => ({
  id,
  name,
  category,
  reference,
  range,
  description: description || "",
  image: null,
  images: [],
  structure: category === "Puffs" ? "" : "Madera Saligna",
  visible: true,
  materialNames: [],
  options:
    category === "Puffs"
      ? ["color", "notes"]
      : [
          "material",
          "measure",
          "notes",
          ...(category === "Modulares" ? ["layout"] : []),
        ],
  legs: [],
}));

export let site = {
  name: "Proyecto Atelier",
  heroTitle: "Tu espacio.\nTu forma de\nhabitarlo.",
  heroDescription:
    "Sillones hechos para acompañar tu vida. Elegí un modelo, contanos cómo lo imaginás y lo hacemos juntos.",
  tagline: "Fábrica de sillones · A tu medida",
  shipping: "Fabricación personalizada · Envíos a todo el país",
  collectionTitle: "Un lugar para quedarte.",
  collectionDescription:
    "Diseños que se adaptan a vos. Elegí el punto de partida.",
  contactTitle: "Lo imaginás.\nLo hacemos juntos.",
  contactDescription: "Fabricación personalizada y envíos a todo el país.",
  footer: "Sillones y muebles a medida",
  heroImage: "",
  heroImages: [],
  heroButton: "Personalizá el tuyo",
  collectionEyebrow: "La colección",
  contactEyebrow: "Conversemos",
  steps: [
    { title: "01 / ELEGÍ", description: "Encontrá tu modelo" },
    { title: "02 / PERSONALIZÁ", description: "Dale tu impronta" },
    { title: "03 / CONVERSÁ", description: "Cotizá con la fábrica" },
  ],
};
export function initialContent() {
  return structuredClone({ site, contact, materials, products });
}
export async function loadContent() {
  const response = await fetch("/api/content", { cache: "no-store" });
  if (!response.ok)
    throw Error("No se pudo cargar el catálogo. Intentá nuevamente.");
  const data = await response.json();
  ({ site, contact, materials, products } = data.content);
  return data;
}
export function availableMaterials(product) {
  return materials.filter(
    (m) =>
      !product.materialNames?.length || product.materialNames.includes(m.name),
  );
}
