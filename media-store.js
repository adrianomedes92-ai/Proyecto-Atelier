import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { optimizeImage } from "./image-processing.js";
export function mediaName(url) {
  if (
    typeof url !== "string" ||
    !/^\/uploads\/[a-f0-9-]+(?:-(?:optimized|card))?\.(jpg|png|webp)$/.test(url)
  )
    throw Object.assign(Error("La imagen no es válida."), { status: 400 });
  return url.slice("/uploads/".length);
}
export async function mediaInfo(store, url) {
  if (
    typeof url === "string" &&
    /^\/images\/[a-zA-Z0-9_/-]+\.(jpg|jpeg|png|webp)$/.test(url)
  ) {
    await readFile(join(process.cwd(), url.slice(1)));
    return { url, sourceUrl: url, crop: null, legacy: true };
  }
  const name = mediaName(url);
  try {
    const info = JSON.parse(
      await readFile(join(store, "media", name + ".json"), "utf8"),
    );
    return {
      ...info,
      sourceUrl: "/api/admin/image-source?url=" + encodeURIComponent(url),
      legacy: false,
    };
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    await readFile(join(store, "uploads", name));
    return { url, sourceUrl: url, crop: null, legacy: true };
  }
}
export async function originalBytes(store, info) {
  if (info.legacy && info.url.startsWith("/images/"))
    return readFile(join(process.cwd(), info.url.slice(1)));
  if (info.legacy) return readFile(join(store, "uploads", mediaName(info.url)));
  if (!/^[a-f0-9-]+\.(jpg|png|webp)$/.test(info.original))
    throw Error("Original inválido.");
  return readFile(join(store, "originals", info.original));
}
export async function createMedia(store, bytes, kind, crop, original = null) {
  const result = await optimizeImage(bytes, kind, crop);
  const metadata = await sharp(bytes).metadata();
  for (const dir of ["uploads", "originals", "media"])
    await mkdir(join(store, dir), { recursive: true });
  if (!original) {
    original =
      randomUUID() +
      "." +
      { jpeg: "jpg", png: "png", webp: "webp" }[metadata.format];
    await writeFile(join(store, "originals", original), bytes, { flag: "wx" });
  }
  const id = randomUUID(),
    name =
      id +
      (kind === "product"
        ? "-optimized.webp"
        : ["base", "mask"].includes(kind)
          ? ".png"
          : ".webp"),
    url = "/uploads/" + name;
  await writeFile(join(store, "uploads", name), result.data, { flag: "wx" });
  const info = {
    url,
    original,
    kind,
    crop: crop || null,
    sourceWidth: metadata.autoOrient.width,
    sourceHeight: metadata.autoOrient.height,
    width: result.width,
    height: result.height,
  };
  await writeFile(join(store, "media", name + ".json"), JSON.stringify(info), {
    flag: "wx",
    mode: 0o600,
  });
  let thumbnailUrl;
  if (result.card) {
    thumbnailUrl = "/uploads/" + id + "-card.webp";
    await writeFile(join(store, "uploads", id + "-card.webp"), result.card, {
      flag: "wx",
    });
  }
  return {
    ...info,
    thumbnailUrl,
    originalBytes: bytes.length,
    optimizedBytes: result.optimizedBytes,
  };
}
