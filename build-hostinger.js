import { mkdir, readFile, writeFile, cp, readdir } from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join, relative } from "node:path";
import { Zip, ZipPassThrough } from "fflate";
import { initialContent } from "./data.js";
import { validateContent } from "./content-schema.js";
const root = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const storageArg = args.indexOf("--storage");
if (
  args.some(
    (arg, i) =>
      arg !== "--storage" && !(storageArg >= 0 && i === storageArg + 1),
  )
)
  throw Error("Uso: npm run build:hostinger [-- --storage ruta-de-.storage]");
const source =
  storageArg >= 0
    ? resolve(args[storageArg + 1] || "")
    : join(root, ".storage");
if (storageArg >= 0 && !args[storageArg + 1])
  throw Error("Indicá la ruta de .storage.");
let content = validateContent(initialContent()),
  migrated = false;
try {
  const saved = JSON.parse(
    await readFile(join(source, "content.json"), "utf8"),
  );
  content = validateContent(saved.content);
  migrated = true;
} catch (error) {
  if (error.code !== "ENOENT" || storageArg >= 0) throw error;
}
const output = join(
  root,
  "dist",
  "hostinger-" + new Date().toISOString().replace(/[:.]/g, "-"),
);
const pub = join(output, "public_html"),
  priv = join(output, "atelier-private");
await mkdir(pub, { recursive: true });
await mkdir(join(priv, "storage", "uploads"), { recursive: true });
for (const name of ["api.php", "setup.php", ".htaccess", ".user.ini"])
  await cp(join(root, "hosting", "public", name), join(pub, name));
for (const name of [
  "bootstrap.php",
  "validation.php",
  "media.php",
  "schema.sql",
  "config.example.php",
  ".htaccess",
])
  await cp(join(root, "hosting", "private", name), join(priv, name));
for (const name of [
  "index.html",
  "style.css",
  "app.js",
  "data.js",
  "quote.js",
  "admin.html",
  "admin.js",
  "admin.css",
  "content-schema.js",
  "image-urls.js",
  "product-gallery.js",
  "hero-slideshow.js",
  "brand.js",
  "image-editor.js",
  "upholstery-preview.js",
  "mask-editor.js",
  "upholstery-demo.js",
  "upholstery-admin.js",
  "crop-geometry.js",
])
  await cp(join(root, name), join(pub, name));
await cp(join(root, "images", "demo"), join(pub, "images", "demo"), {
  recursive: true,
});
const referenced = new Set(
  [
    ...content.site.heroImages,
    ...content.products.flatMap((product) => [
      product.image,
      ...product.images,
      product.upholstery.base,
      product.upholstery.mask,
    ]),
    ...content.materials.flatMap((material) => [
      material.texture,
      ...(material.swatches || []).map((swatch) => swatch.image),
    ]),
  ].filter(Boolean),
);
for (const url of referenced) {
  const isUpload = url.startsWith("/uploads/");
  const from = join(isUpload ? source : root, url.slice(1));
  const to = join(isUpload ? join(priv, "storage") : pub, url.slice(1));
  await mkdir(dirname(to), { recursive: true });
  await cp(from, to);
  if (isUpload) {
    try {
      const metadata = JSON.parse(
        await readFile(join(source, "media", url.slice(9) + ".json"), "utf8"),
      );
      if (!/^[a-f0-9-]+\.(jpg|png|webp)$/.test(metadata.original))
        throw Error("Nombre de original inválido.");
      await mkdir(join(priv, "storage", "originals"), { recursive: true });
      await mkdir(join(priv, "storage", "media"), { recursive: true });
      await cp(
        join(source, "originals", metadata.original),
        join(priv, "storage", "originals", metadata.original),
      );
      await writeFile(
        join(priv, "storage", "media", url.slice(9) + ".json"),
        JSON.stringify(metadata),
      );
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      if (error.path && !error.path.endsWith(".json")) throw error;
    }
  }
  if (url.endsWith("-optimized.webp")) {
    const thumb = url.replace("-optimized.webp", "-card.webp");
    await cp(
      join(isUpload ? source : root, thumb.slice(1)),
      join(isUpload ? join(priv, "storage") : pub, thumb.slice(1)),
    );
  }
}
await writeFile(
  join(priv, "initial-content.json"),
  JSON.stringify({ content: validateContent(content) }, null, 2),
);
await cp(join(root, "HOSTINGER.md"), join(output, "LEEME-HOSTINGER.md"));
const zipPath = output + ".zip";
const stream = createWriteStream(zipPath);
let zipError;
const zip = new Zip((error, data, final) => {
  if (error) {
    zipError = error;
    stream.destroy(error);
    return;
  }
  stream.write(data);
  if (final) stream.end();
});
const finished = once(stream, "finish");
async function add(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await add(path);
    else if (entry.isFile()) {
      const file = new ZipPassThrough(
        relative(output, path).split("\\").join("/"),
      );
      zip.add(file);
      for await (const chunk of createReadStream(path)) {
        file.push(chunk, false);
        if (stream.writableNeedDrain) await once(stream, "drain");
      }
      file.push(new Uint8Array(), true);
    }
  }
}
await add(output);
zip.end();
await finished;
if (zipError) throw zipError;
console.log(
  `Paquete Hostinger: ${zipPath}\n${migrated ? "Incluye el contenido y las fotos referenciadas de " + source : "Incluye el catálogo inicial; no se encontró .storage/content.json."}\nNo incluye contraseñas, sesiones ni credenciales MySQL. Creá el acceso de producción desde /setup.php.`,
);
