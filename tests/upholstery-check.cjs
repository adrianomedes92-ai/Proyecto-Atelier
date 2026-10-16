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
    const flow = require("./upholstery-flow.cjs");
    for (const mobile of [false, true]) {
      const context = await browser.newContext(
        mobile
          ? {
              viewport: { width: 320, height: 740 },
              isMobile: true,
              hasTouch: true,
            }
          : { viewport: { width: 1440, height: 1100 } },
      );
      const page = await context.newPage();
      await page.goto(base + "/admin");
      await page.locator("[name=password]").fill("atelier123");
      await page.locator("#login-form button").click();
      await page.locator("#panel").waitFor({ state: "visible" });
      // Cada corrida móvil parte del mismo piloto oculto y prueba otra carga completa.
      if (mobile) {
        await page.evaluate(async () => {
          const data = await fetch("/api/admin/content").then((r) => r.json());
          data.content.products = data.content.products.filter(
            (p) => p.id !== "prueba-tapizado",
          );
          data.content.materials = data.content.materials.filter(
            (m) => m.name !== "Tela de demostración",
          );
          await fetch("/api/admin/content", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });
        });
        await page.reload();
        await page.locator("#panel").waitFor({ state: "visible" });
      }
      await flow(page, base, root, mobile);
      await context.close();
    }
    console.log(
      "PASS prueba de tapizados: escritorio y celular, máscara, variantes, originales, publicación, reedición y WhatsApp.",
    );
  } finally {
    if (browser) await browser.close();
    if (child) {
      child.kill();
      await once(child, "exit");
    }
    await rm(dir, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
