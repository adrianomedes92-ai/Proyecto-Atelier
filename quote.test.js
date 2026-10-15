import test from "node:test";
import assert from "node:assert/strict";
import { products, materials } from "./data.js";
import { validate, message, whatsappLink } from "./quote.js";
test("validación de familia, rangos y medidas personalizadas", () => {
  const p = products.find((p) => p.id === "clapton-dos");
  assert.equal(validate(p, { measure: "reference" }).length, 1);
  assert.deepEqual(
    validate(p, { measure: "range", width: "180", material: "PANNE" }),
    [],
  );
  assert.ok(
    validate(p, { measure: "range", width: 300, material: "PANNE" }).length,
  );
  assert.ok(
    validate(p, { measure: "custom", custom: " ", material: "PANNE" }).length,
  );
  assert.deepEqual(
    validate(p, {
      measure: "custom",
      custom: "210 × 95 cm",
      material: "BOUCLÉ",
    }),
    [],
  );
});
test("consulta completa se codifica y conserva elecciones sin enviarse", () => {
  const p = {
    ...products.find((p) => p.id === "clapton-modular"),
    legs: ["Variante confirmada"],
  };
  const s = {
    measure: "custom",
    custom: "300 × 100 cm",
    material: "BOUCLÉ",
    color: "código confirmado",
    layout: "En L, a la derecha",
    leg: "Variante confirmada",
    notes: "Entrega: consultar & coordinar",
  };
  assert.deepEqual(validate(p, s), []);
  const text = message(p, s),
    url = new URL(whatsappLink("5491173730703", text));
  assert.equal(url.searchParams.get("text"), text);
  for (const value of [
    p.name,
    s.custom,
    s.material,
    s.color,
    s.layout,
    s.leg,
    s.notes,
  ])
    assert.ok(text.includes(value));
  assert.equal(url.hostname, "wa.me");
  assert.equal(whatsappLink("", text), null);
});
test("modular requiere disposición y puffs no requieren medidas ficticias", () => {
  assert.ok(
    validate(
      products.find((p) => p.id === "clapton-modular"),
      { material: "DONN", measure: "reference" },
    ).length,
  );
  const p = products.find((p) => p.id === "oruga-v");
  assert.deepEqual(validate(p, { color: "Consultar beige" }), []);
  assert.ok(
    message(p, { color: "Consultar beige" }).includes(
      "Consultar disponibilidad.",
    ),
  );
  assert.ok(!message(p, {}).includes("Medida solicitada"));
});
test("códigos confirmados se vuelven obligatorios", () => {
  const m = materials[0];
  m.codes = ["001"];
  try {
    const p = products[0];
    assert.ok(validate(p, { material: m.name, measure: "reference" }).length);
    assert.deepEqual(
      validate(p, { material: m.name, measure: "reference", color: "001" }),
      [],
    );
  } finally {
    m.codes = [];
  }
});
