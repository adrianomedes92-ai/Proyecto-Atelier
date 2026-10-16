const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtemp, rm, readdir, readFile } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const { once } = require("node:events");
(async () => {
  const root = resolve(__dirname, ".."),
    sharp = require(join(root, "node_modules/sharp"));
  const dir = await mkdtemp(join(tmpdir(), "atelier-editor-"));
  let browser, child;
  try {
    child = spawn(process.execPath, ["server.js", "--development-login"], {
      cwd: root,
      env: {
        ...process.env,
        PORT: "0",
        HOST: "127.0.0.1",
        NODE_ENV: "development",
        ATELIER_DATA_DIR: dir,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const port = await new Promise((resolve, reject) => {
        let out = "";
        const timer = setTimeout(
          () => reject(Error("No inició el servidor")),
          10000,
        );
        child.stdout.on("data", (d) => {
          out += d;
          const match = out.match(/Panel: http:\/\/localhost:(\d+)/);
          if (match) {
            clearTimeout(timer);
            resolve(match[1]);
          }
        });
      }),
      base = "http://127.0.0.1:" + port;
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    });
    const raw = Buffer.alloc(1200 * 800 * 3);
    for (let i = 0; i < 1200 * 800; i++) {
      raw[i * 3] = i % 1200 < 600 ? 230 : 20;
      raw[i * 3 + 1] = 50;
      raw[i * 3 + 2] = i % 1200 < 600 ? 20 : 230;
    }
    const original = await sharp(raw, {
      raw: { width: 1200, height: 800, channels: 3 },
    })
      .png()
      .toBuffer();
    for (const mobile of [false, true]) {
      const context = await browser.newContext(
          mobile
            ? {
                viewport: { width: 320, height: 700 },
                hasTouch: true,
                isMobile: true,
              }
            : { viewport: { width: 1440, height: 1000 } },
        ),
        page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(base + "/admin");
      await page.locator("[name=password]").fill("atelier123");
      await page.locator("#login-form button").click();
      await page.locator("#panel").waitFor({ state: "visible" });
      const product = mobile ? "baby-clapton" : "clapton-individual";
      await page.locator('[data-product="' + product + '"]').click();
      const fixture = {
        name: "original.png",
        mimeType: "image/png",
        buffer: original,
      };
      await page.locator("[data-upload=product]").setInputFiles(fixture);
      await page.locator(".image-editor").waitFor();
      assert.equal(
        await page
          .locator("[data-crop-canvas]")
          .evaluate((c) => c.width / c.height),
        1.25,
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.locator("[data-crop-zoom]").fill("2");
      const box = await page.locator(".crop-stage").boundingBox();
      const x = box.x + box.width * 0.7,
        y = box.y + box.height * 0.5;
      if (mobile) {
        const session = await context.newCDPSession(page);
        await session.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x, y }],
        });
        for (let i = 1; i <= 4; i++)
          await session.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: x - (box.width * 0.4 * i) / 4, y }],
          });
        await session.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
      } else {
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x - box.width * 0.4, y, { steps: 6 });
        await page.mouse.up();
      }
      const preview = await page
        .locator("[data-crop-preview]")
        .evaluate((canvas) =>
          [
            ...canvas
              .getContext("2d")
              .getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data,
          ].slice(0, 3),
        );
      await page.screenshot({
        path:
          "/tmp/atelier-image-editor-" +
          (mobile ? "mobile" : "desktop") +
          ".png",
      });
      await page.locator("[data-crop-confirm]").click();
      await page.locator("[data-recrop]").waitFor();
      const first = await page
        .locator(".image-item img")
        .first()
        .getAttribute("src");
      let info = await (
        await context.request.get(
          base + "/api/admin/image-info?url=" + encodeURIComponent(first),
        )
      ).json();
      assert.equal(info.crop.width, 500);
      assert.equal(info.crop.height, 400);
      assert.ok(info.crop.x > 100);
      assert.deepEqual(
        Buffer.from(
          await (await context.request.get(base + info.sourceUrl)).body(),
        ),
        original,
      );
      assert.equal((await fetch(base + info.sourceUrl)).status, 401);
      let saved = await (await fetch(base + "/api/content")).json();
      assert.equal(
        saved.content.products.find((p) => p.id === product).images.length,
        0,
      );
      await page.locator("#save").click();
      await page.getByText("Todos los cambios están guardados.").waitFor();
      const published = Buffer.from(
          await (await fetch(base + first)).arrayBuffer(),
        ),
        meta = await sharp(published).metadata();
      const pixel = await sharp(published)
        .extract({
          left: Math.floor(meta.width / 2),
          top: Math.floor(meta.height / 2),
          width: 1,
          height: 1,
        })
        .removeAlpha()
        .raw()
        .toBuffer();
      assert.ok(
        preview.every((n, i) => Math.abs(n - pixel[i]) < 20),
        "El recorte publicado no coincide con la vista previa",
      );
      const publicPage = await context.newPage();
      await publicPage.goto(base);
      await publicPage.locator('[data-gallery-open="' + product + '"]').click();
      assert.equal(
        await publicPage.locator("[data-lightbox-image]").getAttribute("src"),
        first,
      );
      await publicPage.close();
      await page.locator("[data-recrop]").click();
      await page.locator(".image-editor").waitFor();
      await page.locator("[data-crop-reset]").click();
      assert.equal(await page.locator("[data-crop-zoom]").inputValue(), "1");
      await page.locator("[data-crop-zoom]").fill("3");
      await page.locator("[data-crop-confirm]").click();
      await page.waitForFunction(
        (old) =>
          document.querySelector(".image-item img").getAttribute("src") !== old,
        first,
      );
      const second = await page.locator(".image-item img").getAttribute("src");
      const secondInfo = await (
        await context.request.get(
          base + "/api/admin/image-info?url=" + encodeURIComponent(second),
        )
      ).json();
      assert.equal(secondInfo.original, info.original);
      saved = await (await fetch(base + "/api/content")).json();
      assert.equal(
        saved.content.products.find((p) => p.id === product).image,
        first,
      );
      await page.locator("#save").click();
      await page.getByText("Todos los cambios están guardados.").waitFor();
      await page.reload();
      await page.locator('[data-product="' + product + '"]').click();
      await page.locator("[data-recrop]").click();
      await page.locator(".image-editor").waitFor();
      await page.keyboard.press("Escape");
      await page.waitForFunction(
        () => !document.querySelector(".image-editor"),
      );
      assert.equal(
        await page.locator(".image-item img").getAttribute("src"),
        second,
      );
      await page.locator("[data-upload=product]").setInputFiles(fixture);
      await page.locator(".image-editor").waitFor();
      await page.locator("[data-crop-cancel]").first().click();
      await page.waitForFunction(
        () => !document.querySelector(".image-editor"),
      );
      assert.equal(await page.locator(".image-item img").count(), 1);
      await page.locator("[data-tab=site]").click();
      await page.locator("#hero-upload").setInputFiles(fixture);
      await page.locator(".image-editor").waitFor();
      assert.equal(
        await page
          .locator("[data-crop-canvas]")
          .evaluate((c) => c.width / c.height),
        16 / 9,
      );
      await page.locator("[data-crop-confirm]").click();
      await page.locator("[data-recrop][data-crop-kind=hero]").waitFor();
      await page.locator("#save").click();
      await page.getByText("Todos los cambios están guardados.").waitFor();
      await page.locator("[data-tab=materials]").click();
      if (!(await page.locator("[data-field=variant-code-0]").count())) {
        await page.locator("#add-code").click();
        await page.locator("[data-field=variant-code-0]").fill("001");
      }
      await page.locator('[data-swatch="0"]').setInputFiles(fixture);
      await page.locator(".image-editor").waitFor();
      assert.equal(
        await page
          .locator("[data-crop-canvas]")
          .evaluate((c) => c.width / c.height),
        1,
      );
      await page.locator("[data-crop-confirm]").click();
      await page.locator("[data-recrop][data-crop-kind=swatch]").waitFor();
      await page.locator("#save").click();
      await page.getByText("Todos los cambios están guardados.").waitFor();
      assert.deepEqual(errors, []);
      console.log(
        "PASS editor " +
          (mobile ? "móvil 320 px y arrastre táctil" : "escritorio y mouse") +
          ": cargar, zoom, mover, preview fiel, original privado, guardar/publicar, reeditar, restablecer, cancelar/Escape y marcos producto/portada/tela.",
      );
      await context.close();
    }
  } finally {
    if (browser) await browser.close();
    if (child?.exitCode === null) {
      const exited = once(child, "exit");
      child.kill();
      await exited;
    }
    await rm(dir, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
