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
    delete content.colors;
    delete content.catalogVersion;
    content.products[0].name = "Catálogo migrado";
    content.products[0].description = "/uploads/../../admin.json";
    content.products[0].image = "/uploads/abc-optimized.webp";
    content.products[0].images = [content.products[0].image];
    content.site.heroImages = [content.products[0].image];
    content.materials[0].codes = ["A"];
    content.materials[0].swatches = [
      { code: "A", name: "Arena", image: "/uploads/ccc.webp", active: false },
    ];
    content.products[0].variants = [
      {
        material: content.materials[0].name,
        code: "A",
        images: ["/uploads/bbb.webp"],
      },
    ];
    content.products[0].upholstery = {
      enabled: true,
      base: "/uploads/ddd.png",
      mask: "/uploads/eee.png",
    };
    await mkdir(join(source, "originals"));
    await mkdir(join(source, "media"));
    await writeFile(join(source, "originals", "aaa.png"), "original-anterior");
    await writeFile(
      join(source, "media", "abc.webp.json"),
      "metadato-anterior",
    );
    for (const name of ["bbb.webp", "ccc.webp", "ddd.png", "eee.png"])
      await writeFile(join(source, "uploads", name), "imagen-conservada");
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
    for (const name of ["bbb.webp", "ccc.webp", "ddd.png", "eee.png"])
      assert.ok(files["atelier-private/storage/uploads/" + name]);
    assert.equal(
      strFromU8(files["atelier-private/storage/originals/aaa.png"]),
      "original-anterior",
    );
    assert.ok(
      files[
        "atelier-private/storage/backups/content-before-prepared-variants.json"
      ],
    );
    assert.ok(files["public_html/image-editor.js"]);
    assert.ok(files["public_html/crop-geometry.js"]);
    assert.ok(!files["public_html/upholstery-preview.js"]);
    assert.ok(files["public_html/prepared-variants.js"]);
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
