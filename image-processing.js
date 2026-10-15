import sharp from "sharp";
sharp.concurrency(2);
export const imagePresets = {
  product: { width: 1600, height: 1600, quality: 82 },
  hero: { width: 1920, height: 2160, quality: 82 },
  swatch: { width: 400, height: 400, quality: 90 },
};
export async function optimizeImage(bytes, kind = "product") {
  if (!Object.hasOwn(imagePresets, kind))
    throw Object.assign(Error("Tipo de imagen inválido."), { status: 400 });
  const preset = imagePresets[kind];
  try {
    const source = sharp(bytes, {
      limitInputPixels: 60_000_000,
      failOn: "warning",
    });
    const metadata = await source.metadata();
    if (
      !["jpeg", "png", "webp"].includes(metadata.format) ||
      (metadata.pages || 1) > 1
    )
      throw Error("Formato no admitido.");
    const { data, info } = await source
      .rotate()
      .resize({
        width: preset.width,
        height: preset.height,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: preset.quality })
      .toBuffer({ resolveWithObject: true });
    let card;
    if (kind === "product") {
      card = await sharp(data)
        .resize({
          width: 800,
          height: 640,
          fit: "contain",
          background: "#e8e7de",
          withoutEnlargement: true,
        })
        .webp({ quality: 78 })
        .toBuffer();
    }
    return {
      data,
      card,
      width: info.width,
      height: info.height,
      originalBytes: bytes.length,
      optimizedBytes: data.length + (card?.length || 0),
    };
  } catch {
    throw Object.assign(
      Error(
        "No se pudo procesar la foto. Usá JPG, PNG o WebP sin animación, de hasta 20 MB y 60 megapíxeles.",
      ),
      { status: 400 },
    );
  }
}
