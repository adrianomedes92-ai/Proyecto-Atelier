import test from "node:test";
import assert from "node:assert/strict";
import { applyUpholstery } from "./upholstery-preview.js";
import { validateContent } from "./content-schema.js";
import { initialContent } from "./data.js";
import { addUpholsteryDemo } from "./upholstery-demo.js";
import { createMedia, mediaInfo, originalBytes } from "./media-store.js";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";
test("el tapizado modifica solo la máscara y conserva fondo, madera, sombras y transparencia", () => {
  const base = new Uint8ClampedArray([
    180, 180, 180, 255, 90, 90, 90, 255, 126, 82, 40, 255, 248, 247, 240, 255,
    45, 55, 65, 170,
  ]);
  const mask = new Uint8ClampedArray([
    255, 255, 255, 255, 255, 255, 255, 255, 0, 0, 0, 255, 0, 0, 0, 255, 255,
    255, 255, 0,
  ]);
  const sample = new Uint8ClampedArray([
    60, 100, 160, 255, 60, 100, 160, 255, 60, 100, 160, 255, 60, 100, 160, 255,
    60, 100, 160, 255,
  ]);
  const result = applyUpholstery(base, mask, sample);
  assert.deepEqual(result.slice(8), base.slice(8));
  assert.notDeepEqual(result.slice(0, 3), base.slice(0, 3));
  assert.ok(
    result[4] < result[0] && result[5] < result[1] && result[6] < result[2],
  );
  assert.equal(result[3], 255);
  assert.equal(result[7], 255);
  assert.equal(base[0], 180);
});
test("datos anteriores compatibles, piloto oculto y variantes se conservan al validar", () => {
  const legacy = validateContent(initialContent());
  assert.equal(legacy.products[0].upholstery.enabled, false);
  assert.equal(legacy.materials[0].code, "");
  const id = addUpholsteryDemo(legacy);
  addUpholsteryDemo(legacy);
  const content = validateContent(legacy),
    p = content.products.find((p) => p.id === id),
    m = content.materials.at(-1);
  assert.equal(content.products.filter((p) => p.id === id).length, 1);
  assert.equal(p.visible, false);
  assert.equal(p.upholstery.enabled, true);
  assert.equal(m.code, "DEMO-T01");
  assert.equal(m.swatches[0].name, "Arena");
  assert.ok(m.texture);
  for (const bad of [
    { enabled: true, base: p.upholstery.base, mask: "" },
    { enabled: true, base: p.upholstery.base, mask: "/uploads/abc.webp" },
    {
      enabled: true,
      base: "https://bad.com/image.png",
      mask: p.upholstery.mask,
    },
  ]) {
    p.upholstery = bad;
    assert.throws(() => validateContent(content), { status: 400 });
  }
});
test("base y máscara PNG sin pérdida, originales privados exactos y sin recortes independientes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "atelier-mask-"));
  try {
    for (const [kind, path] of [
      ["base", "armchair-base.png"],
      ["mask", "armchair-mask.png"],
    ]) {
      const bytes = await readFile(
          new URL("./images/demo/" + path, import.meta.url),
        ),
        media = await createMedia(dir, bytes, kind, null);
      assert.ok(media.url.endsWith(".png"));
      const source = await mediaInfo(dir, media.url);
      assert.deepEqual(await originalBytes(dir, source), bytes);
      const stored = await readFile(join(dir, "uploads", media.url.slice(9)));
      assert.equal((await sharp(stored).metadata()).format, "png");
      assert.deepEqual(
        await sharp(stored).ensureAlpha().raw().toBuffer(),
        await sharp(bytes).ensureAlpha().raw().toBuffer(),
      );
      await assert.rejects(
        createMedia(dir, bytes, kind, { x: 0, y: 0, width: 500, height: 400 }),
        { status: 400 },
      );
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
