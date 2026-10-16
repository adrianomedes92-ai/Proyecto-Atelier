export const cropRatios = { product: 5 / 4, hero: 16 / 9, swatch: 1 };
export function cropRectangle(
  width,
  height,
  kind,
  zoom = 1,
  centerX = width / 2,
  centerY = height / 2,
) {
  const ratio = cropRatios[kind];
  if (!ratio || !width || !height)
    throw Error("Proporción de imagen inválida.");
  const [rw, rh] = { product: [5, 4], hero: [16, 9], swatch: [1, 1] }[kind];
  const baseUnits = Math.floor(Math.min(width / rw, height / rh));
  if (baseUnits < 1)
    throw Error("La imagen es demasiado pequeña para este encuadre.");
  const units = Math.max(1, Math.floor(baseUnits / Math.max(1, zoom) + 1e-8));
  const cropWidth = units * rw,
    cropHeight = units * rh;
  return {
    x: Math.max(
      0,
      Math.min(width - cropWidth, Math.round(centerX - cropWidth / 2)),
    ),
    y: Math.max(
      0,
      Math.min(height - cropHeight, Math.round(centerY - cropHeight / 2)),
    ),
    width: cropWidth,
    height: cropHeight,
  };
}
export function validateCrop(crop, width, height, kind) {
  const ratio = cropRatios[kind];
  if (
    !ratio ||
    !crop ||
    !["x", "y", "width", "height"].every((key) => Number.isInteger(crop[key]))
  )
    throw Object.assign(Error("El encuadre no es válido."), { status: 400 });
  if (
    crop.x < 0 ||
    crop.y < 0 ||
    crop.width < 1 ||
    crop.height < 1 ||
    crop.x + crop.width > width ||
    crop.y + crop.height > height ||
    Math.abs(crop.width - crop.height * ratio) > 2
  )
    throw Object.assign(
      Error(
        "El encuadre está fuera de la imagen o no tiene la proporción adecuada.",
      ),
      { status: 400 },
    );
  return { left: crop.x, top: crop.y, width: crop.width, height: crop.height };
}
