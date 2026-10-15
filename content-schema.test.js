import test from "node:test";
import assert from "node:assert/strict";
import { initialContent } from "./data.js";
import { validateContent } from "./content-schema.js";
test("conserva la portada única de datos antiguos y permite eliminarla expresamente", () => {
  const content = initialContent();
  delete content.site.heroImages;
  content.site.heroImage = "/uploads/abc.webp";
  const migrated = validateContent(content);
  assert.deepEqual(migrated.site.heroImages, ["/uploads/abc.webp"]);
  migrated.site.heroImages = [];
  const removed = validateContent(migrated);
  assert.equal(removed.site.heroImage, "");
  assert.deepEqual(removed.site.heroImages, []);
});
test("la portada conserva el orden y la primera imagen mantiene compatibilidad", () => {
  const content = initialContent();
  content.site.heroImages = [
    "/uploads/ccc.webp",
    "/uploads/aaa.webp",
    "/uploads/bbb.webp",
  ];
  const result = validateContent(content);
  assert.deepEqual(result.site.heroImages, content.site.heroImages);
  assert.equal(result.site.heroImage, "/uploads/ccc.webp");
});
test("rechaza portadas inválidas, repetidas y más de doce imágenes", () => {
  for (const images of [
    ["javascript:alert(1)"],
    [""],
    ["/uploads/aaa.webp", "/uploads/aaa.webp"],
    Array.from({ length: 13 }, (_, i) => "/uploads/" + i + ".webp"),
  ]) {
    const content = initialContent();
    content.site.heroImages = images;
    assert.throws(
      () => validateContent(content),
      (e) => e.status === 400,
    );
  }
});
test("marca: valor por defecto compatible y tamaños entre 16 y 36 px", () => {
  const content = initialContent();
  delete content.site.brandFontSize;
  assert.equal(validateContent(content).site.brandFontSize, 22);
  for (const size of [16, 22, 36]) {
    content.site.brandFontSize = size;
    assert.equal(validateContent(content).site.brandFontSize, size);
  }
  for (const size of [15, 37, 22.5, "22", NaN]) {
    content.site.brandFontSize = size;
    assert.throws(
      () => validateContent(content),
      (e) => e.status === 400,
    );
  }
});
