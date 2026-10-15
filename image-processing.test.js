import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { optimizeImage } from "./image-processing.js";
import { cardImage } from "./image-urls.js";
test("foto grande: reduce dimensiones, convierte WebP y crea tarjeta 5:4 sin cortar", async () => {
  const source = await sharp({
    create: { width: 2400, height: 3200, channels: 3, background: "#cd4f30" },
  })
    .png()
    .toBuffer();
  const result = await optimizeImage(source, "product");
  const full = await sharp(result.data).metadata();
  assert.equal(full.format, "webp");
  assert.equal(full.width, 1200);
  assert.equal(full.height, 1600);
  assert.ok(result.data.length < source.length);
  const card = await sharp(result.card).metadata();
  assert.equal(card.width, 800);
  assert.equal(card.height, 640);
  const { data, info } = await sharp(result.card)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const at = (x, y) => [
    ...data.subarray(
      (y * info.width + x) * info.channels,
      (y * info.width + x) * info.channels + 3,
    ),
  ];
  const edge = at(0, 320),
    middle = at(400, 320);
  assert.ok(edge.every((n, i) => Math.abs(n - [232, 231, 222][i]) < 8));
  assert.ok(middle[0] > middle[1] * 2);
  assert.equal(
    cardImage("/uploads/abc-optimized.webp"),
    "/uploads/abc-card.webp",
  );
  assert.equal(cardImage("/uploads/old.webp"), "/uploads/old.webp");
});
test("muestras e inicio conservan proporción y no agrandan la foto pequeña", async () => {
  const bytes = await sharp({
    create: { width: 300, height: 200, channels: 3, background: "#667788" },
  })
    .jpeg()
    .toBuffer();
  for (const kind of ["swatch", "hero"]) {
    const result = await optimizeImage(bytes, kind);
    assert.equal(result.width, 300);
    assert.equal(result.height, 200);
    assert.equal(result.card, undefined);
    assert.equal((await sharp(result.data).metadata()).format, "webp");
  }
});
test("orientación EXIF se corrige y no se guarda la ubicación ni metadata original", async () => {
  const bytes = await sharp({
    create: { width: 600, height: 300, channels: 3, background: "white" },
  })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
  const result = await optimizeImage(bytes);
  const meta = await sharp(result.data).metadata();
  assert.equal(meta.width, 300);
  assert.equal(meta.height, 600);
  assert.equal(meta.exif, undefined);
});
test("rechaza archivos inválidos, SVG, JPG truncado y tipos de uso desconocidos", async () => {
  for (const bytes of [
    Buffer.from("not an image"),
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
    ),
    Buffer.from([255, 216, 255, 0, 1]),
  ])
    await assert.rejects(optimizeImage(bytes), (e) => e.status === 400);
  await assert.rejects(
    optimizeImage(Buffer.from("x"), "unknown"),
    (e) => e.status === 400,
  );
});
