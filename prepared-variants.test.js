import test from "node:test";
import assert from "node:assert/strict";
import { validateContent } from "./content-schema.js";
import { initialContent } from "./data.js";
import { variantsFor } from "./prepared-variants.js";
import { legacyColors } from "./tests/fixtures/legacy-colors.js";
const fixture = () => validateContent(legacyColors());
test("deduplica colores y galerías anteriores por código conservando disponibilidad por tela", () => {
  const old = legacyColors(),
    c = validateContent(old);
  assert.equal(c.catalogVersion, 2);
  assert.equal(c.colors.length, 4);
  assert.equal(c.colors.filter((c) => c.code === "AZ-01").length, 1);
  assert.deepEqual(c.materials[0].colorCodes, ["AZ-01", "AR-02"]);
  assert.deepEqual(c.materials[1].colorCodes, ["AZ-01", "OL-04"]);
  assert.equal(c.products[0].variants.length, 3);
  assert.equal(c.products[0].variants[0].material, undefined);
  assert.deepEqual(
    c.products[0].variants[0].images,
    old.products[0].variants[0].images,
  );
  assert.deepEqual(validateContent(c), c);
  assert.ok(old.materials[0].swatches[0].image);
});
test("dos telas ofrecen colores diferentes y comparten la misma galería de producto/color sin muestras", () => {
  const c = fixture(),
    p = c.products[0],
    v = variantsFor(p, c.materials, c.colors);
  assert.deepEqual(
    v.filter((v) => v.material.name === "PANNE").map((v) => v.variant.code),
    ["AZ-01", "AR-02"],
  );
  assert.deepEqual(
    v.filter((v) => v.material.name === "MECHA").map((v) => v.variant.code),
    ["AZ-01", "OL-04"],
  );
  const common = v.filter((v) => v.variant.code === "AZ-01");
  assert.equal(common[0].images, common[1].images);
  assert.deepEqual(variantsFor(c.products[1], c.materials, c.colors), []);
  p.materialNames = ["MECHA"];
  assert.deepEqual(
    variantsFor(p, c.materials, c.colors).map((v) => v.variant.code),
    ["AZ-01", "OL-04"],
  );
  c.materials[1].colorCodes = [];
  assert.deepEqual(variantsFor(p, c.materials, c.colors), []);
});
test("conflictos de nombres y fotos se preservan y requieren revisión antes de ofrecerse", () => {
  const old = legacyColors(true),
    c = validateContent(old),
    color = c.colors.find((c) => c.code === "AZ-01"),
    gallery = c.products[0].variants.find((v) => v.code === "AZ-01");
  assert.deepEqual(color.legacyNames, ["Azul", "Azul marino"]);
  assert.equal(color.reviewRequired, true);
  assert.deepEqual(gallery.images, [
    "/uploads/aaa.webp",
    "/uploads/bbb.webp",
    "/uploads/ddd.webp",
  ]);
  assert.equal(gallery.reviewRequired, true);
  assert.ok(
    !variantsFor(c.products[0], c.materials, c.colors).some(
      (v) => v.variant.code === "AZ-01",
    ),
  );
  color.reviewRequired = false;
  gallery.reviewRequired = false;
  assert.equal(
    variantsFor(c.products[0], c.materials, c.colors).filter(
      (v) => v.variant.code === "AZ-01",
    ).length,
    2,
  );
  assert.deepEqual(validateContent(c), c);
});
test("la migración conserva galerías de más de doce fotos, sin truncar ni repetir archivos", () => {
  const old = legacyColors(true);
  old.products[0].variants[0].images = Array.from(
    { length: 12 },
    (_, i) => `/uploads/${i.toString(16)}a.webp`,
  );
  old.products[0].variants[1].images = Array.from(
    { length: 12 },
    (_, i) => `/uploads/${i.toString(16)}b.webp`,
  );
  const c = validateContent(old);
  assert.equal(c.products[0].variants[0].images.length, 24);
  assert.equal(c.products[0].variants[0].reviewRequired, true);
});
test("rechaza colores duplicados y referencias inexistentes de telas o galerías", () => {
  let c = fixture();
  c.colors.push(c.colors[0]);
  assert.throws(() => validateContent(c), { status: 400 });
  c = fixture();
  c.materials[0].colorCodes.push("NO-EXISTE");
  assert.throws(() => validateContent(c), { status: 400 });
  c = fixture();
  c.materials[0].colorCodes.push("AZ-01");
  assert.throws(() => validateContent(c), { status: 400 });
  c = fixture();
  c.products[0].variants.push(c.products[0].variants[0]);
  assert.throws(() => validateContent(c), { status: 400 });
  c = fixture();
  c.products[0].variants[0].code = "NO-EXISTE";
  assert.throws(() => validateContent(c), { status: 400 });
  c = fixture();
  c.products[0].variants[0].images = ["javascript:alert(1)"];
  assert.throws(() => validateContent(c), { status: 400 });
  c = fixture();
  c.colors[0].reviewRequired = "false";
  assert.throws(() => validateContent(c), { status: 400 });
});
test("fotos y fichas antiguas se conservan al migrar sin introducir máscaras o texturas", () => {
  const c = legacyColors();
  c.products[0].image = "/uploads/abc-optimized.webp";
  c.products[0].images = [c.products[0].image];
  c.products[0].upholstery = {
    base: "/uploads/aaa.png",
    mask: "/uploads/bbb.png",
  };
  const v = validateContent(c);
  assert.equal(v.products[0].image, c.products[0].image);
  assert.deepEqual(v.products[0].images, c.products[0].images);
  assert.equal(v.products[0].upholstery, undefined);
  assert.equal(v.materials[0].swatches, undefined);
  assert.deepEqual(validateContent(initialContent()).colors, []);
});
