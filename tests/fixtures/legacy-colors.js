import { initialContent } from "../../data.js";
export function legacyColors(conflicts = false) {
  const c = initialContent();
  delete c.colors;
  delete c.catalogVersion;
  for (const m of c.materials) {
    delete m.colorCodes;
    m.codes = [];
    m.swatches = [];
  }
  const [a, b] = c.materials;
  a.codes = ["AZ-01", "AR-02", "IN-03"];
  a.swatches = [
    { code: "AZ-01", name: "Azul", image: "/uploads/aaa.webp", active: true },
    { code: "AR-02", name: "Arena", image: "/uploads/bbb.webp", active: true },
    { code: "IN-03", name: "Verde", image: "/uploads/ccc.webp", active: false },
  ];
  b.codes = ["AZ-01", "OL-04"];
  b.swatches = [
    {
      code: "AZ-01",
      name: conflicts ? "Azul marino" : "Azul",
      image: "/uploads/ddd.webp",
      active: true,
    },
    { code: "OL-04", name: "Oliva", image: "", active: true },
  ];
  c.products[0].variants = [
    {
      material: a.name,
      code: "AZ-01",
      images: ["/uploads/aaa.webp", "/uploads/bbb.webp"],
    },
    {
      material: b.name,
      code: "AZ-01",
      images: conflicts
        ? ["/uploads/bbb.webp", "/uploads/ddd.webp"]
        : ["/uploads/aaa.webp", "/uploads/bbb.webp"],
    },
    { material: a.name, code: "AR-02", images: ["/uploads/ccc.webp"] },
    { material: b.name, code: "OL-04", images: ["/uploads/ddd.webp"] },
  ];
  return c;
}
