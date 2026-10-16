// La máscara usa blanco = tapizado, negro/transparente = conservar la foto.
// El renderer es compartido por el administrador y el configurador.
const images = new Map();
export function loadImage(url) {
  if (!images.has(url)) {
    const promise = (async () => {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    })();
    images.set(url, promise);
    promise.catch(() => images.delete(url));
    if (images.size > 24) images.delete(images.keys().next().value);
  }
  return images.get(url);
}
export function applyUpholstery(base, mask, sample, texture = sample) {
  const result = new Uint8ClampedArray(base);
  const histogram = new Uint32Array(256);
  let count = 0;
  for (let i = 0; i < base.length; i += 4) {
    if ((mask[i] * mask[i + 3]) / 255 > 128) {
      histogram[
        Math.round(
          0.2126 * base[i] + 0.7152 * base[i + 1] + 0.0722 * base[i + 2],
        )
      ]++;
      count++;
    }
  }
  let reference = 160,
    total = 0;
  for (let n = 0; n < 256; n++) {
    total += histogram[n];
    if (count && total >= count * 0.65) {
      reference = Math.max(45, n);
      break;
    }
  }
  for (let i = 0; i < base.length; i += 4) {
    const coverage =
      (((mask[i] + mask[i + 1] + mask[i + 2]) / (3 * 255)) * mask[i + 3]) / 255;
    if (!coverage) continue;
    const luminance =
      0.2126 * base[i] + 0.7152 * base[i + 1] + 0.0722 * base[i + 2];
    const shade = Math.min(1.6, luminance / reference);
    const weave =
      (0.2126 * texture[i] +
        0.7152 * texture[i + 1] +
        0.0722 * texture[i + 2]) /
      160;
    for (let c = 0; c < 3; c++) {
      const fabric = Math.min(
        255,
        sample[i + c] * shade * (0.85 + 0.15 * weave),
      );
      result[i + c] = base[i + c] * (1 - coverage) + fabric * coverage;
    }
  }
  return result;
}
export async function paintUpholstery(
  canvas,
  config,
  variant,
  textureUrl = "",
) {
  const base = await loadImage(config.base);
  const scale = Math.min(
    1,
    1100 / base.naturalWidth,
    1100 / base.naturalHeight,
  );
  const width = Math.round(base.naturalWidth * scale),
    height = Math.round(base.naturalHeight * scale);
  const layer = document.createElement("canvas");
  layer.width = width;
  layer.height = height;
  const ctx = layer.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(base, 0, 0, width, height);
  if (variant?.image) {
    const [mask, sample, texture] = await Promise.all([
      loadImage(config.mask),
      loadImage(variant.image),
      loadImage(textureUrl || variant.image),
    ]);
    if (
      mask.naturalWidth !== base.naturalWidth ||
      mask.naturalHeight !== base.naturalHeight
    )
      throw Error(
        "La máscara y la base no tienen las mismas dimensiones. Revisá el encuadre en el administrador.",
      );
    const original = ctx.getImageData(0, 0, width, height);
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(mask, 0, 0, width, height);
    const masked = ctx.getImageData(0, 0, width, height).data;
    function tile(img) {
      ctx.clearRect(0, 0, width, height);
      const tile = document.createElement("canvas");
      tile.width = 180;
      tile.height = 180;
      tile.getContext("2d").drawImage(img, 0, 0, 180, 180);
      ctx.fillStyle = ctx.createPattern(tile, "repeat");
      ctx.fillRect(0, 0, width, height);
      return ctx.getImageData(0, 0, width, height).data;
    }
    const samplePixels = tile(sample),
      weave = tile(texture);
    original.data.set(
      applyUpholstery(original.data, masked, samplePixels, weave),
    );
    ctx.putImageData(original, 0, 0);
  }
  // No tocar el canvas visible hasta completar la composición.
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(layer, 0, 0);
}
export const previewDisclaimer =
  "Vista previa representativa. La textura, la escala y el color real pueden variar según la pantalla y la iluminación. Confirmá el tapizado con la muestra física.";
