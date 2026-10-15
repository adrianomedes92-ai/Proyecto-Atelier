import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unzipSync, strFromU8 } from "fflate";
import { initialContent } from "./data.js";
const exec = promisify(execFile);
test("paquete Hostinger migra contenido y fotos sin copiar credenciales o sesiones", async () => {
  const source = await mkdtemp(join(tmpdir(), "atelier-package-"));
  let output;
  try {
    await mkdir(join(source, "uploads"));
    const content = initialContent();
    content.products[0].name = "Catálogo migrado";
    content.products[0].description = "/uploads/../../admin.json";
    content.products[0].image = "/uploads/abc-optimized.webp";
    content.products[0].images = [content.products[0].image];
    content.site.heroImages = [content.products[0].image];
    await writeFile(
      join(source, "content.json"),
      JSON.stringify({ revision: 8, content }),
    );
    await writeFile(join(source, "admin.json"), "NO-COPIAR-CREDENCIALES");
    await writeFile(join(source, ".env"), "NO-COPIAR-SECRETOS");
    await writeFile(join(source, "uploads/abc-optimized.webp"), "foto-migrada");
    await writeFile(join(source, "uploads/abc-card.webp"), "miniatura-migrada");
    const { stdout } = await exec(process.execPath, [
      "build-hostinger.js",
      "--storage",
      source,
    ]);
    output = stdout.match(/Paquete Hostinger: (.+\.zip)/)[1];
    const files = unzipSync(new Uint8Array(await readFile(output)));
    for (const name of [
      "api.php",
      "admin.html",
      "admin.js",
      "brand.js",
      "hero-slideshow.js",
      "product-gallery.js",
    ])
      assert.ok(files["public_html/" + name]);
    assert.ok(files["public_html/.htaccess"]);
    assert.ok(files["atelier-private/schema.sql"]);
    assert.equal(
      strFromU8(files["atelier-private/storage/uploads/abc-optimized.webp"]),
      "foto-migrada",
    );
    assert.equal(
      strFromU8(files["atelier-private/storage/uploads/abc-card.webp"]),
      "miniatura-migrada",
    );
    const restored = JSON.parse(
      strFromU8(files["atelier-private/initial-content.json"]),
    );
    assert.equal(restored.content.products[0].name, "Catálogo migrado");
    for (const path of Object.keys(files))
      assert.ok(
        !/(^|\/)(config\.php|admin\.json|\.env|sessions)(\/|$)/.test(path),
      );
    assert.ok(
      !strFromU8(files["atelier-private/initial-content.json"]).includes(
        "NO-COPIAR-",
      ),
    );
    assert.ok(await readFile(join(source, "admin.json")));
  } finally {
    await rm(source, { recursive: true, force: true });
    if (output) {
      await rm(output, { force: true });
      await rm(output.slice(0, -4), { recursive: true, force: true });
    }
  }
});
