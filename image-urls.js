// Las fotos anteriores siguen usando su ruta original; solo las nuevas tienen miniatura.
export function cardImage(url) {
  return typeof url === "string"
    ? url.replace(/-optimized\.webp$/, "-card.webp")
    : url;
}
