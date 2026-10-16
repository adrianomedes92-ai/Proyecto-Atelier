const assert = require("node:assert/strict"),
  { execFile } = require("node:child_process"),
  { promisify } = require("node:util"),
  { randomBytes } = require("node:crypto"),
  { mkdir, mkdtemp, cp, writeFile, rm } = require("node:fs/promises"),
  { join, resolve } = require("node:path"),
  net = require("node:net");
const run = promisify(execFile),
  root = resolve(__dirname, "../.."),
  docker = (args) => run("docker", args, { maxBuffer: 1024 * 1024 }),
  pause = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const { initialContent } = await import(join(root, "data.js"));
  const sharp = require(join(root, "node_modules/sharp"));
  await mkdir(join(root, "dist"), { recursive: true });
  const folder = await mkdtemp(join(root, "dist", "php-check-")),
    pub = join(folder, "public_html"),
    priv = join(folder, "atelier-private");
  const id = randomBytes(5).toString("hex"),
    network = "atelier-test-" + id,
    dbName = "atelier-db-" + id,
    phpName = "atelier-api-" + id;
  const password = randomBytes(24).toString("hex"),
    token = randomBytes(32).toString("hex");
  let dbStarted = false,
    phpStarted = false,
    networkStarted = false;
  let callback;
  try {
    await cp(join(root, "hosting/public"), pub, { recursive: true });
    await cp(join(root, "hosting/private"), priv, { recursive: true });
    for (const name of [
      "index.html",
      "admin.html",
      "admin.js",
      "admin.css",
      "style.css",
      "app.js",
      "data.js",
      "quote.js",
      "content-schema.js",
      "color-catalog-migration.js",
      "image-urls.js",
      "product-gallery.js",
      "hero-slideshow.js",
      "brand.js",
      "image-editor.js",
      "crop-geometry.js",
      "prepared-variants.js",
      "variant-admin.js",
      "material-admin.js",
    ])
      await cp(join(root, name), join(pub, name));
    await writeFile(
      join(priv, "initial-content.json"),
      JSON.stringify({ content: initialContent() }),
    );
    const port = await new Promise((resolve) => {
        const server = net.createServer();
        server.listen(0, "127.0.0.1", () => {
          const p = server.address().port;
          server.close(() => resolve(p));
        });
      }),
      base = "http://127.0.0.1:" + port;
    function configuration(engine) {
      return `<?php return ['db'=>['host'=>'mysql','port'=>3306,'name'=>'atelier','user'=>'atelier','password'=>'${password}'],'app_url'=>'${base}','setup_token'=>'${token}','storage_dir'=>__DIR__.'/storage','image_engine'=>'${engine}'];`;
    }
    await writeFile(join(priv, "config.php"), configuration("imagick"), {
      mode: 0o600,
    });
    await docker(["network", "create", network]);
    networkStarted = true;
    await docker([
      "run",
      "-d",
      "--name",
      dbName,
      "--network",
      network,
      "--network-alias",
      "mysql",
      "--tmpfs",
      "/var/lib/mysql",
      "-e",
      "MARIADB_DATABASE=atelier",
      "-e",
      "MARIADB_USER=atelier",
      "-e",
      "MARIADB_PASSWORD=" + password,
      "-e",
      "MARIADB_ROOT_PASSWORD=" + password,
      "mariadb:11.4",
    ]);
    dbStarted = true;
    let ready = false;
    for (let i = 0; i < 60; i++) {
      try {
        await docker([
          "exec",
          dbName,
          "healthcheck.sh",
          "--connect",
          "--innodb_initialized",
        ]);
        ready = true;
        break;
      } catch {
        await pause(500);
      }
    }
    if (!ready) throw Error("MariaDB no inició.");
    const containerRoot =
      "/app/" + folder.slice(root.length + 1).replaceAll("\\", "/");
    await docker([
      "run",
      "-d",
      "--name",
      phpName,
      "--user",
      `${process.getuid?.() || 1000}:${process.getgid?.() || 1000}`,
      "--network",
      network,
      "-p",
      `127.0.0.1:${port}:8080`,
      "-v",
      root + ":/app",
      "atelier-php-test",
      "php",
      "-d",
      "opcache.enable_cli=0",
      "-d",
      "opcache.enable=0",
      "-d",
      "memory_limit=256M",
      "-d",
      "post_max_size=22M",
      "-S",
      "0.0.0.0:8080",
      "-t",
      containerRoot + "/public_html",
      "/app/tests/php/router.php",
    ]);
    phpStarted = true;
    const request = (
      path,
      method = "GET",
      payload,
      cookie = "",
      origin = base,
    ) =>
      fetch(base + path, {
        method,
        headers: {
          Origin: origin,
          ...(cookie ? { Cookie: cookie } : {}),
          ...(payload ? { "Content-Type": "application/json" } : {}),
        },
        body: payload ? JSON.stringify(payload) : undefined,
      });
    for (let i = 0; i < 30; i++) {
      try {
        await request("/api/admin/session");
        break;
      } catch {
        await pause(200);
      }
    }
    assert.equal(
      (await (await request("/api/admin/session")).json()).configured,
      false,
    );
    assert.equal((await request("/api/content")).status, 503);
    const setup = await fetch(base + "/setup.php", {
      method: "POST",
      headers: { Origin: base },
      body: new URLSearchParams({ token, password, confirm: password }),
    });
    assert.equal(setup.status, 200, await setup.text());
    assert.equal((await request("/api/health")).status, 200);
    assert.equal(
      (await (await request("/api/health")).json()).imageEngine,
      "imagick",
    );
    assert.equal((await request("/api/admin/content")).status, 401);
    assert.equal(
      (
        await request(
          "/api/admin/login",
          "POST",
          { password },
          "",
          "https://evil.example",
        )
      ).status,
      403,
    );
    assert.equal(
      (await request("/api/admin/login", "POST", { password: "atelier123" }))
        .status,
      401,
    );
    const login = await request("/api/admin/login", "POST", { password });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0];
    assert.match(login.headers.get("set-cookie"), /httponly/i);
    assert.match(login.headers.get("set-cookie"), /SameSite=Strict/i);
    // Comprobar la misma migración en PHP y Node, incluyendo conflictos y galerías largas.
    const { legacyColors } = await import(
      join(root, "tests/fixtures/legacy-colors.js")
    );
    const { validateContent } = await import(join(root, "content-schema.js"));
    for (const conflict of [false, true]) {
      const legacy = legacyColors(conflict);
      if (conflict) {
        legacy.products[0].variants[0].images = Array.from(
          { length: 12 },
          (_, i) => "/uploads/" + i.toString(16) + "a.webp",
        );
        legacy.products[0].variants[1].images = Array.from(
          { length: 12 },
          (_, i) => "/uploads/" + i.toString(16) + "b.webp",
        );
      }
      await writeFile(
        join(priv, "migration-fixture.json"),
        JSON.stringify(legacy),
      );
      const checked = await docker([
        "exec",
        phpName,
        "php",
        "-r",
        `require '${containerRoot}/atelier-private/bootstrap.php'; $value=json_decode(file_get_contents('${containerRoot}/atelier-private/migration-fixture.json'),true);echo Atelier\\encode(Atelier\\validate_content($value));`,
      ]);
      assert.deepEqual(JSON.parse(checked.stdout), validateContent(legacy));
    }
    // Simular una base instalada antes del catálogo global, preservando las fichas originales.
    const legacy = legacyColors();
    legacy.products[2].variants = legacy.products[0].variants;
    legacy.products[0].variants = [];
    legacy.products[2].upholstery = {
      enabled: true,
      base: "/uploads/aaa.png",
      mask: "/uploads/bbb.png",
    };
    await writeFile(join(priv, "legacy-catalog.json"), JSON.stringify(legacy));
    await writeFile(
      join(priv, "seed-legacy.php"),
      `<?php require __DIR__.'/bootstrap.php';$value=json_decode(file_get_contents(__DIR__.'/legacy-catalog.json'),true);$pdo=Atelier\\db();$pdo->exec("DELETE FROM atelier_settings WHERE setting_key IN ('colors','catalogVersion')");foreach(['products'=>'id','materials'=>'name'] as $type=>$key){$q=$pdo->prepare("UPDATE atelier_$type SET payload=? WHERE $key=?");foreach($value[$type] as $item)$q->execute([Atelier\\encode($item),$item[$key]]);}`,
    );
    await docker([
      "exec",
      phpName,
      "php",
      containerRoot + "/atelier-private/seed-legacy.php",
    ]);
    const saved = await (
      await request("/api/admin/content", "GET", null, cookie)
    ).json();
    assert.equal(saved.content.products.length, 11);
    assert.equal(saved.content.colors.length, 4);
    assert.equal(saved.content.products[2].variants.length, 3);
    assert.equal(
      saved.content.colors.filter((c) => c.code === "AZ-01").length,
      1,
    );
    const image = await sharp({
      create: { width: 2400, height: 3200, channels: 3, background: "#acbdcd" },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    let uploaded;
    for (const engine of ["imagick", "gd"]) {
      await writeFile(join(priv, "config.php"), configuration(engine));
      await docker(["restart", "--time", "0", phpName]);
      await pause(300);
      assert.equal(
        (await (await request("/api/health")).json()).imageEngine,
        engine,
      );
      const response = await fetch(base + "/api/admin/upload", {
        method: "POST",
        headers: {
          Origin: base,
          Cookie: cookie,
          "X-Image-Kind": "product",
          "Content-Type": "image/jpeg",
        },
        body: image,
      });
      if (response.status !== 201) {
        const log = await docker(["logs", "--tail", "15", phpName]);
        console.error(log.stderr);
      }
      assert.equal(
        response.status,
        201,
        engine + ": " + (await response.clone().text()),
      );
      uploaded = await response.json();
      const data = Buffer.from(
          await (await fetch(base + uploaded.url)).arrayBuffer(),
        ),
        meta = await sharp(data).metadata();
      assert.equal(meta.format, "webp");
      assert.equal(meta.width, 1600);
      assert.equal(meta.height, 1200);
      assert.equal(meta.exif, undefined);
      const thumb = await sharp(
        Buffer.from(
          await (await fetch(base + uploaded.thumbnailUrl)).arrayBuffer(),
        ),
      ).metadata();
      assert.equal(thumb.width, 800);
      assert.equal(thumb.height, 640);
      const info = await (
        await request(
          "/api/admin/image-info?url=" + encodeURIComponent(uploaded.url),
          "GET",
          null,
          cookie,
        )
      ).json();
      assert.equal((await request(info.sourceUrl)).status, 401);
      assert.deepEqual(
        Buffer.from(
          await (
            await request(info.sourceUrl, "GET", null, cookie)
          ).arrayBuffer(),
        ),
        image,
      );
      const recrop = await request(
        "/api/admin/recrop",
        "POST",
        {
          url: uploaded.url,
          kind: "product",
          crop: { x: 400, y: 300, width: 1000, height: 800 },
        },
        cookie,
      );
      assert.equal(recrop.status, 201, await recrop.clone().text());
      const edited = await recrop.json();
      assert.equal(edited.original, info.original);
      assert.notEqual(edited.url, uploaded.url);
      const small = await sharp({
        create: { width: 100, height: 200, channels: 3, background: "#d52e16" },
      })
        .png()
        .toBuffer();
      const smallResponse = await fetch(base + "/api/admin/upload", {
        method: "POST",
        headers: {
          Origin: base,
          Cookie: cookie,
          "X-Image-Kind": "product",
          "X-Image-Crop": JSON.stringify({
            x: 20,
            y: 40,
            width: 50,
            height: 40,
          }),
        },
        body: small,
      });
      assert.equal(
        smallResponse.status,
        201,
        await smallResponse.clone().text(),
      );
      const smallInfo = await smallResponse.json(),
        thumbBytes = Buffer.from(
          await (await fetch(base + smallInfo.thumbnailUrl)).arrayBuffer(),
        );
      const smallMeta = await sharp(thumbBytes).metadata();
      assert.equal(smallMeta.width, 800);
      assert.equal(smallMeta.height, 640);
      for (const [left, top] of [
        [0, 0],
        [799, 0],
        [0, 639],
        [799, 639],
      ]) {
        const pixel = await sharp(thumbBytes)
          .extract({ left, top, width: 1, height: 1 })
          .raw()
          .toBuffer();
        assert.ok(
          pixel[0] > 180 && pixel[1] < 80 && pixel[2] < 70,
          engine + ": no debe agregar bandas",
        );
      }
      for (const kind of ["swatch", "hero"]) {
        const result = await fetch(base + "/api/admin/upload", {
          method: "POST",
          headers: { Origin: base, Cookie: cookie, "X-Image-Kind": kind },
          body: image,
        });
        assert.equal(result.status, 201);
        const info = await result.json();
        assert.ok(info.width <= (kind === "swatch" ? 400 : 1920));
      }
    }
    saved.content.products[0].name = "Modelo PHP & MySQL";
    saved.content.products[0].image = uploaded.url;
    saved.content.products[0].images = [uploaded.url];
    saved.content.materials[0].code = "PHP-T01";
    saved.content.colors.push(
      { code: "PHP-A", name: "Azul PHP" },
      { code: "PHP-B", name: "Arena PHP" },
    );
    saved.content.materials[0].colorCodes = ["PHP-A"];
    saved.content.products[2].variants = [
      { code: "PHP-A", images: [uploaded.url] },
      { code: "PHP-B", images: [uploaded.url] },
    ];
    saved.content.site.heroImages = [uploaded.url];
    saved.content.site.brandFontSize = 30;
    saved.content.products[1].visible = false;
    assert.equal(
      (await request("/api/admin/content", "PUT", saved, cookie)).status,
      200,
    );
    assert.equal(
      (await request("/api/admin/content", "PUT", saved, cookie)).status,
      409,
    );
    const pubData = await (await request("/api/content")).json();
    assert.equal(pubData.content.products.length, 10);
    assert.equal(pubData.content.products[0].name, "Modelo PHP & MySQL");
    assert.equal(pubData.content.site.brandFontSize, 30);
    assert.equal(
      pubData.content.products.find((p) => p.id === "clapton-dos").variants[0]
        .code,
      "PHP-A",
    );
    const backups = await require("node:fs/promises").readdir(
      join(priv, "storage", "backups"),
    );
    assert.ok(
      backups.some((name) => name.startsWith("content-before-global-colors")),
    );
    const archived = JSON.parse(
      await require("node:fs/promises").readFile(
        join(priv, "storage", "backups", backups[0]),
        "utf8",
      ),
    );
    assert.equal(
      archived.content.products.find((p) => p.id === "clapton-dos").upholstery
        .mask,
      "/uploads/bbb.png",
    );
    const unknownCode = structuredClone(pubData);
    unknownCode.revision = pubData.revision;
    unknownCode.content.products[0].variants = [
      { material: "PANNE", code: "NO-EXISTE", images: [uploaded.url] },
    ];
    assert.equal(
      (await request("/api/admin/content", "PUT", unknownCode, cookie)).status,
      400,
    );
    const invalid = structuredClone(pubData);
    invalid.content.site.heroImages = ["javascript:alert(1)"];
    assert.equal(
      (await request("/api/admin/content", "PUT", invalid, cookie)).status,
      400,
    );
    const invalidUpload = await fetch(base + "/api/admin/upload", {
      method: "POST",
      headers: { Origin: base, Cookie: cookie },
      body: '<svg onload="alert(1)" />',
    });
    assert.equal(invalidUpload.status, 400);
    assert.equal((await request("/.user.ini")).status, 403);
    assert.equal((await request("/atelier-private/config.php")).status, 403);
    const repeated = await fetch(base + "/setup.php", {
      method: "POST",
      headers: { Origin: base },
      body: new URLSearchParams({ token, password, confirm: password }),
    });
    assert.equal(repeated.status, 409);
    await docker(["restart", "--time", "0", phpName]);
    await pause(500);
    assert.equal(
      (await (await request("/api/content")).json()).content.products[0].name,
      "Modelo PHP & MySQL",
    );
    assert.equal(
      (await request("/api/admin/logout", "POST", {}, cookie)).status,
      200,
    );
    assert.equal(
      (await request("/api/admin/content", "GET", null, cookie)).status,
      401,
    );
    for (let i = 0; i < 5; i++)
      assert.equal(
        (await request("/api/admin/login", "POST", { password: "wrong" }))
          .status,
        401,
      );
    assert.equal(
      (await request("/api/admin/login", "POST", { password })).status,
      429,
    );
    console.log(
      "PASS PHP 8.2 + MariaDB: instalación protegida, MySQL real, login/logout/rate limit, CSRF, API, conflictos, datos persistentes, GD e Imagick (WebP/EXIF/miniaturas), contenido privado y bloqueo de reinstalación.",
    );
    if (process.env.ATELIER_BROWSER_CHECK) {
      const { chromium } = require("playwright");
      const browser = await chromium.launch({
        headless: true,
        executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      });
      try {
        await docker([
          "exec",
          dbName,
          "mariadb",
          "-uatelier",
          "-p" + password,
          "atelier",
          "-e",
          "DELETE FROM atelier_login_attempts",
        ]);
        const page = await browser.newPage({
            viewport: { width: 390, height: 844 },
          }),
          errors = [];
        page.on("pageerror", (e) => {
          errors.push(e.message);
          console.error("Browser script error:", e.message);
        });

        page.on("response", (response) => {
          const path = new URL(response.url()).pathname;
          if (
            path.endsWith(".js") &&
            (response.status() !== 200 ||
              response.headers()["content-type"]?.includes("html"))
          )
            console.error(
              "Script response:",
              path,
              response.status(),
              response.headers()["content-type"],
            );
        });
        await page.goto(base + "/admin");
        await page.locator("[name=password]").fill(password);
        await page.locator("#login-form button").click();
        try {
          await page
            .locator("#panel")
            .waitFor({ state: "visible", timeout: 8000 });
        } catch (error) {
          console.error(
            "Admin message:",
            (await page.locator("#status").count())
              ? await page.locator("#status").innerText()
              : "No se cargó el panel.",
          );
          throw error;
        }
        await page.locator("[data-tab=site]").click();
        await page.locator("[data-field=heroTitle]").fill("Atelier desde PHP");
        await page.locator("#save").click();
        await page.getByText("Todos los cambios están guardados.").waitFor();
        await page.goto(base);
        await page
          .locator("h1")
          .filter({ hasText: "Atelier desde PHP" })
          .waitFor();
        await page.locator('[data-product="clapton-individual"]').click();
        assert.equal(await page.locator("[name=material] option").count(), 1);
        assert.ok(
          (await page.locator("#summary-text").innerText()).includes(
            "Modelo PHP & MySQL",
          ),
        );
        await page.locator("#close").click();
        await page.goto(base + "/admin");
        await page.locator("#panel").waitFor({ state: "visible" });
        await require("../prepared-variants-flow.cjs")(page, base, root, false);
        assert.deepEqual(errors, []);
        console.log(
          "PASS variantes PHP/MySQL: catálogo único, casillas en dos telas, galerías por producto/color, migración sin pérdida, encuadre y WhatsApp.",
        );
        console.log(
          "PASS navegador móvil contra PHP/MySQL: admin, guardar contenido, portada, catálogo y configurador.",
        );
      } finally {
        await browser.close();
      }
    }
  } finally {
    if (phpStarted) await docker(["rm", "-f", phpName]).catch(() => {});
    if (dbStarted) await docker(["rm", "-f", "-v", dbName]).catch(() => {});
    if (networkStarted)
      await docker(["network", "rm", network]).catch(() => {});
    await rm(folder, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
