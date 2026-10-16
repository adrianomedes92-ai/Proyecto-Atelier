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
      "image-editor.js",
      "crop-geometry.js",
      "admin.css",
      "style.css",
      "app.js",
      "data.js",
      "quote.js",
      "content-schema.js",
      "image-urls.js",
      "product-gallery.js",
      "hero-slideshow.js",
      "brand.js",
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
    const saved = await (
      await request("/api/admin/content", "GET", null, cookie)
    ).json();
    assert.equal(saved.content.products.length, 11);
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
      assert.deepEqual(
        Buffer.from(
          await (
            await request(info.sourceUrl, "GET", null, cookie)
          ).arrayBuffer(),
        ),
        image,
      );
      assert.equal((await request(info.sourceUrl)).status, 401);
      const crop = { x: 400, y: 300, width: 1000, height: 800 };
      const croppedResponse = await request(
        "/api/admin/recrop",
        "POST",
        { url: uploaded.url, kind: "product", crop },
        cookie,
      );
      assert.equal(
        croppedResponse.status,
        201,
        await croppedResponse.clone().text(),
      );
      const cropped = await croppedResponse.json();
      assert.equal(cropped.original, info.original);
      assert.deepEqual(cropped.crop, crop);
      const croppedMeta = await sharp(
        Buffer.from(await (await fetch(base + cropped.url)).arrayBuffer()),
      ).metadata();
      assert.equal(croppedMeta.width, 1000);
      assert.equal(croppedMeta.height, 800);
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
    // Simula el original y el metadato portable que genera el paquete Node.
    await mkdir(join(priv, "storage", "originals"), { recursive: true });
    await mkdir(join(priv, "storage", "media"), { recursive: true });
    await writeFile(join(priv, "storage", "originals", "abcdef.jpg"), image);
    await writeFile(
      join(priv, "storage", "uploads", "abcdef-optimized.webp"),
      await sharp(image).rotate().resize(800).webp().toBuffer(),
    );
    const portable = {
      url: "/uploads/abcdef-optimized.webp",
      original: "abcdef.jpg",
      kind: "product",
      crop: null,
      sourceWidth: 3200,
      sourceHeight: 2400,
      width: 800,
      height: 600,
    };
    const sidecar = join(
      priv,
      "storage",
      "media",
      "abcdef-optimized.webp.json",
    );
    await writeFile(sidecar, JSON.stringify(portable));
    const imported = await (
      await request(
        "/api/admin/image-info?url=" + encodeURIComponent(portable.url),
        "GET",
        null,
        cookie,
      )
    ).json();
    assert.equal(imported.legacy, false);
    await rm(sidecar);
    const fromDatabase = await (
      await request(
        "/api/admin/image-info?url=" + encodeURIComponent(portable.url),
        "GET",
        null,
        cookie,
      )
    ).json();
    assert.equal(fromDatabase.original, portable.original);
    assert.deepEqual(
      Buffer.from(
        await (
          await request(fromDatabase.sourceUrl, "GET", null, cookie)
        ).arrayBuffer(),
      ),
      image,
    );
    await writeFile(sidecar, JSON.stringify(portable));
    saved.content.products[0].name = "Modelo PHP & MySQL";
    saved.content.products[0].image = uploaded.url;
    saved.content.products[0].images = [uploaded.url];
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
        await page.locator("[data-upload=product]").setInputFiles({
          name: "original.jpg",
          mimeType: "image/jpeg",
          buffer: image,
        });
        await page.locator(".image-editor").waitFor();
        await page.locator("[data-crop-zoom]").fill("1.5");
        await page.locator("[data-crop-confirm]").click();
        await page.waitForFunction(
          () => document.querySelectorAll(".image-item img").length === 2,
        );
        const firstCropUrl = await page
          .locator(".image-item img")
          .nth(1)
          .getAttribute("src");
        await page.locator("#save").click();
        await page.getByText("Todos los cambios están guardados.").waitFor();
        await page.locator("[data-recrop]").nth(1).click();
        await page.locator(".image-editor").waitFor();
        await page.locator("[data-crop-zoom]").fill("2");
        await page.locator("[data-crop-confirm]").click();
        await page.waitForFunction(
          (old) =>
            document
              .querySelectorAll(".image-item img")[1]
              .getAttribute("src") !== old,
          firstCropUrl,
        );
        const recropUrl = await page
          .locator(".image-item img")
          .nth(1)
          .getAttribute("src");
        await page.locator("#save").click();
        await page.getByText("Todos los cambios están guardados.").waitFor();
        const persisted = await (await fetch(base + "/api/content")).json();
        assert.equal(persisted.content.products[0].images[1], recropUrl);
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
        await page.locator("[name=material]").selectOption("PANNE");
        assert.ok(
          (await page.locator("#summary-text").innerText()).includes(
            "Modelo PHP & MySQL",
          ),
        );
        assert.deepEqual(errors, []);
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
