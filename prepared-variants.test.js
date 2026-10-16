import test from "node:test";
import assert from "node:assert/strict";
import { validateContent } from "./content-schema.js";
import { initialContent } from "./data.js";
import { variantsFor } from "./prepared-variants.js";
const fixture = () => {
  const content = initialContent(),
    m = content.materials[0],
    p = content.products[0];
  m.code = "T01";
  m.codes = ["A", "B", "C"];
  m.swatches = [
    { code: "A", name: "Azul", image: "/uploads/abc.webp", active: true },
    { code: "B", name: "Beige", image: "/uploads/def.webp", active: false },
    { code: "C", name: "Gris", image: "/uploads/aaa.webp", active: true },
  ];
  p.variants = [
    {
      material: m.name,
      code: "A",
      images: ["/uploads/aaa.webp", "/uploads/bbb.webp"],
    },
    { material: m.name, code: "B", images: ["/uploads/ccc.webp"] },
    { material: m.name, code: "C", images: [] },
  ];
  return content;
};
test("variantes activas con muestra y galería, asociadas únicamente al mueble y tela/código correctos", () => {
  const c = validateContent(fixture()),
    p = c.products[0];
  assert.deepEqual(
    variantsFor(p, c.materials).map((v) => v.variant.code),
    ["A"],
  );
  assert.deepEqual(variantsFor(c.products[1], c.materials), []);
  p.materialNames = ["MECHA"];
  assert.deepEqual(variantsFor(p, c.materials), []);
  p.materialNames = [];
  c.materials[0].swatches[0].image = "";
  assert.deepEqual(variantsFor(p, c.materials), []);
});
test("valida referencias, duplicados y límites manteniendo orden y estado inactivo", () => {
  const c = fixture(),
    valid = validateContent(c);
  assert.deepEqual(valid.products[0].variants[0].images, [
    "/uploads/aaa.webp",
    "/uploads/bbb.webp",
  ]);
  assert.equal(valid.materials[0].swatches[1].active, false);
  const p = c.products[0],
    association = structuredClone(p.variants[0]);
  for (const bad of [
    { ...association, code: "X" },
    { ...association, material: "No existe" },
    { ...association, images: ["javascript:alert(1)"] },
    { ...association, images: ["/uploads/aaa.webp", "/uploads/aaa.webp"] },
    {
      ...association,
      images: Array.from({ length: 13 }, (_, i) => `/uploads/${i}.webp`),
    },
  ]) {
    p.variants = [bad];
    assert.throws(() => validateContent(c), { status: 400 });
  }
  p.variants = [association, association];
  assert.throws(() => validateContent(c), { status: 400 });
});
test("las fotos y datos comerciales anteriores se conservan, sin estructuras activas del recortador/máscaras", () => {
  const c = fixture();
  c.products[0].image = "/uploads/abc-optimized.webp";
  c.products[0].images = [c.products[0].image];
  c.products[0].upholstery = {
    enabled: true,
    base: "/uploads/ddd.png",
    mask: "/uploads/eee.png",
  };
  c.materials[0].texture = "/uploads/fff.webp";
  const v = validateContent(c);
  assert.equal(v.products[0].image, c.products[0].image);
  assert.deepEqual(v.products[0].images, c.products[0].images);
  assert.equal(v.products[0].upholstery, undefined);
  assert.equal(v.materials[0].texture, undefined);
  assert.equal(v.materials[0].code, "T01");
  const legacy = validateContent(initialContent());
  assert.deepEqual(legacy.products[0].variants, []);
});

test("el estado de una variante debe ser booleano, sin confundir texto con inactividad", () => {
  const c = fixture();
  c.materials[0].swatches[0].active = "false";
  assert.throws(() => validateContent(c), { status: 400 });
});
