import test from "node:test";
import assert from "node:assert/strict";
import { products, materials } from "./data.js";
import { validate, message, whatsappLink } from "./quote.js";
const fabric = {
  name: "Prueba de códigos",
  type: "Tela",
  code: "T-104",
  codes: ["C-08", "C-09", "C-10"],
  swatches: [
    {
      code: "C-08",
      name: "Azul petróleo",
      image: "/uploads/abc.webp",
      active: true,
    },
    { code: "C-09", name: "Verde", image: "/uploads/def.webp", active: false },
    { code: "C-10", name: "Rojo", image: "/uploads/abc.webp", active: true },
  ],
};
materials.push(fabric);
const model = (id = "clapton-dos") => ({
  ...products.find((p) => p.id === id),
  variants: [
    { material: fabric.name, code: "C-08", images: ["/uploads/aaa.webp"] },
  ],
});
const selection = {
  material: fabric.name,
  color: "C-08",
  measure: "reference",
};
test("valida medidas y patas conservando la selección de una variante con fotos", () => {
  const p = { ...model(), legs: ["Madera"] };
  assert.deepEqual(validate(p, selection), []);
  assert.ok(validate(p, { ...selection, measure: "range", width: 300 }).length);
  assert.deepEqual(
    validate(p, { ...selection, measure: "range", width: 180 }),
    [],
  );
  assert.ok(
    validate(p, { ...selection, measure: "custom", custom: " " }).length,
  );
  assert.deepEqual(
    validate(p, {
      ...selection,
      measure: "custom",
      custom: "210 × 95 cm",
      leg: "Madera",
    }),
    [],
  );
  assert.ok(validate(p, { ...selection, leg: "No disponible" }).length);
});
test("rechaza colores inactivos, sin fotos o de otro mueble y exige elegir cuando hay variantes", () => {
  const p = model();
  for (const s of [
    { measure: "reference" },
    { ...selection, color: "" },
    { ...selection, color: "C-09" },
    { ...selection, color: "C-10" },
    { ...selection, material: "PANNE" },
  ])
    assert.ok(validate(p, s).length);
  const other = { ...p, variants: [] };
  assert.ok(validate(other, selection).length);
  assert.deepEqual(validate(other, { measure: "reference" }), []);
});
test("WhatsApp incluye nombre y código de tela, color y variante junto con el resto de la consulta", () => {
  const p = { ...model("clapton-modular"), legs: ["Madera"] };
  const s = {
    ...selection,
    measure: "custom",
    custom: "300 × 100 cm",
    layout: "En L, a la derecha",
    leg: "Madera",
    notes: "Entrega: consultar & coordinar",
  };
  assert.deepEqual(validate(p, s), []);
  const text = message(p, s),
    url = new URL(whatsappLink("5491173730703", text));
  assert.equal(url.searchParams.get("text"), text);
  assert.equal(url.hostname, "wa.me");
  for (const value of [
    p.name,
    s.custom,
    s.layout,
    s.leg,
    s.notes,
    "Prueba de códigos",
    "Código de tela: T-104",
    "Azul petróleo · C-08",
  ])
    assert.ok(text.includes(value));
  assert.equal(whatsappLink("", text), null);
});
test("modular requiere disposición; los puffs conservan color a consultar sin medidas ficticias", () => {
  assert.ok(validate(model("clapton-modular"), selection).length);
  const p = products.find((p) => p.id === "oruga-v");
  assert.deepEqual(validate(p, { color: "Consultar beige" }), []);
  assert.ok(
    message(p, { color: "Consultar beige" }).includes(
      "Consultar disponibilidad.",
    ),
  );
  assert.ok(!message(p, {}).includes("Medida solicitada"));
});
