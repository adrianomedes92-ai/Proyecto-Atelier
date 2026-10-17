import test from "node:test";
import assert from "node:assert/strict";
import { initialContent } from "./data.js";
import { validateContent } from "./content-schema.js";
import { publicCatalog, orderedProducts } from "./catalog-sections.js";

test("migra categorías anteriores sin duplicar productos, variantes ni imágenes y es idempotente", () => {
  const old = initialContent();
  delete old.sections;
  delete old.taxonomyVersion;
  old.products[0].category = "Categoría propia";
  old.products[0].image = "/images/demo/sofa.webp";
  const migrated = validateContent(old);
  assert.equal(migrated.products.length, old.products.length);
  migrated.products.forEach((p, i) => {
    assert.equal(p.id, old.products[i].id);
    assert.equal(p.image, old.products[i].image || "");
    assert.equal(p.sectionId, "sillones");
    assert.equal(
      migrated.sections[0].subsections.find((s) => s.id === p.subsectionId)
        .name,
      old.products[i].category,
    );
  });
  assert.deepEqual(validateContent(migrated), migrated);
  migrated.sections[0].name = "Living";
  assert.equal(validateContent(migrated).sections[0].name, "Living");
});
test("el catálogo público oculta ramas inactivas y vacías sin modificar los datos privados", () => {
  const content = validateContent(initialContent());
  const p = content.products[0];
  const wood = content.sections[1];
  p.sectionId = wood.id;
  p.subsectionId = wood.subsections[0].id;
  p.options = ["notes"];
  assert.ok(publicCatalog(content).sections.some((s) => s.id === wood.id));
  wood.subsections[0].active = false;
  assert.ok(!publicCatalog(content).products.some((x) => x.id === p.id));
  assert.ok(!publicCatalog(content).sections.some((s) => s.id === wood.id));
  wood.subsections[0].active = true;
  wood.active = false;
  assert.ok(!publicCatalog(content).products.some((x) => x.id === p.id));
  assert.equal(content.products[0], p);
  assert.equal(content.products.length, initialContent().products.length);
  wood.active = true;
  assert.ok(publicCatalog(content).products.some((x) => x.id === p.id));
});
test("rechaza categorías eliminadas con productos, relaciones cruzadas, IDs duplicados y órdenes inválidos", () => {
  const base = validateContent(initialContent());
  for (const mutate of [
    (c) => c.sections.splice(0, 1),
    (c) => (c.products[0].subsectionId = "madera-1"),
    (c) => (c.sections[1].id = c.sections[0].id),
    (c) => (c.products[0].sortOrder = -1),
  ]) {
    const c = structuredClone(base);
    mutate(c);
    assert.throws(() => validateContent(c));
  }
  const c = structuredClone(base);
  c.products.forEach((p) => {
    p.sectionId = c.sections[1].id;
    p.subsectionId = "";
  });
  c.sections.shift();
  assert.doesNotThrow(() => validateContent(c));
  assert.deepEqual(
    orderedProducts([
      { id: "b", sortOrder: 2 },
      { id: "a", sortOrder: 0 },
    ]).map((p) => p.id),
    ["a", "b"],
  );
});
