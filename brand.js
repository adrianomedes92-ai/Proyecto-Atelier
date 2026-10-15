// La misma tipografía y el mismo tamaño configurado en web y administrador.
export function applyBrand(site) {
  const size = Number.isInteger(site.brandFontSize)
    ? Math.max(16, Math.min(36, site.brandFontSize))
    : 22;
  document.documentElement.style.setProperty("--brand-size", `${size}px`);
  document.querySelectorAll("header .brand").forEach((element) => {
    element.textContent = site.name;
  });
}
