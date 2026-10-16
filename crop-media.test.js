import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { cropRectangle, validateCrop } from "./crop-geometry.js";
import { createMedia, mediaInfo, originalBytes } from "./media-store.js";
test("recortes exactos por ubicación y límites al arrastrar/zoom", () => {
  for (const [kind, ratio] of [
    ["product", 5 / 4],
    ["hero", 16 / 9],
    ["swatch", 1],
  ]) {
    const crop = cropRectangle(1200, 800, kind, 2, -1000, 9999);
    assert.equal(crop.x, 0);
    assert.equal(crop.y + crop.height, 800);
    assert.equal(crop.width / crop.height, ratio);
    assert.doesNotThrow(() => validateCrop(crop, 1200, 800, kind));
    assert.throws(() => validateCrop({ ...crop, x: 1200 }, 1200, 800, kind));
    assert.throws(() => validateCrop({ ...crop, width: 0 }, 1200, 800, kind));
  }
});
test("publica el recorte y reencuadra desde el mismo original privado sin modificar versiones anteriores", async () => {
  const dir = await mkdtemp(join(tmpdir(), "atelier-crop-"));
  try {
    const bytes = Buffer.alloc(1200 * 800 * 3);
    for (let i = 0; i < 1200 * 800; i++) {
      bytes[i * 3] = i % 1200 < 600 ? 240 : 20;
      bytes[i * 3 + 1] = 30;
      bytes[i * 3 + 2] = i % 1200 < 600 ? 20 : 240;
    }
    const original = await sharp(bytes, {
      raw: { width: 1200, height: 800, channels: 3 },
    })
      .png()
      .toBuffer();
    const first = await createMedia(dir, original, "product", {
      x: 0,
      y: 100,
      width: 500,
      height: 400,
    });
    const info = await mediaInfo(dir, first.url);
    assert.deepEqual(await originalBytes(dir, info), original);
    const second = await createMedia(
      dir,
      await originalBytes(dir, info),
      "product",
      { x: 700, y: 100, width: 500, height: 400 },
      info.original,
    );
    assert.equal(second.original, first.original);
    assert.notEqual(second.url, first.url);
    for (const [item, channel] of [
      [first, 0],
      [second, 2],
    ]) {
      const data = await readFile(join(dir, item.url.slice(1)));
      const meta = await sharp(data).metadata();
      assert.equal(meta.width / meta.height, 1.25);
      const color = await sharp(data).resize(1, 1).raw().toBuffer();
      assert.ok(color[channel] > 200);
    }
    assert.deepEqual(
      await readFile(join(dir, "originals", first.original)),
      original,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("reabrir un encuadre no desplaza ni achica el recorte por redondeos del zoom", () => {
  for (const zoom of [1.01, 1.5, 2.33, 3.99])
    for (const kind of ["product", "hero", "swatch"]) {
      const crop = cropRectangle(1200, 800, kind, zoom, 700, 500),
        initial = cropRectangle(1200, 800, kind);
      assert.deepEqual(
        cropRectangle(
          1200,
          800,
          kind,
          initial.width / crop.width,
          crop.x + crop.width / 2,
          crop.y + crop.height / 2,
        ),
        crop,
      );
    }
});
