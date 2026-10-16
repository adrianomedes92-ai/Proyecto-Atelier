const { chromium } = require("playwright");
const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { resolve, join } = require("node:path");
const { once } = require("node:events");
(async () => {
  const root = resolve(__dirname, "..");
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    });
    for (const mobile of [false, true]) {
      const store = await mkdtemp(join(tmpdir(), "atelier-prepared-"));
      let child;
      try {
        child = spawn(process.execPath, ["server.js", "--development-login"], {
          cwd: root,
          env: {
            ...process.env,
            PORT: "0",
            HOST: "127.0.0.1",
            NODE_ENV: "development",
            ATELIER_DATA_DIR: store,
          },
          stdio: ["ignore", "pipe", "pipe"],
        });
        const port = await new Promise((resolve, reject) => {
          let output = "",
            error = "";
          const timer = setTimeout(
            () => reject(Error("No inició: " + error)),
            10000,
          );
          child.stderr.on("data", (data) => (error += data));
          child.on("exit", () => {
            clearTimeout(timer);
            reject(Error("Servidor terminó: " + error));
          });
          child.stdout.on("data", (data) => {
            output += data;
            const match = output.match(/Panel: http:\/\/localhost:(\d+)/);
            if (match) {
              clearTimeout(timer);
              resolve(match[1]);
            }
          });
        });
        const base = "http://127.0.0.1:" + port,
          context = await browser.newContext(
            mobile
              ? {
                  viewport: { width: 320, height: 740 },
                  isMobile: true,
                  hasTouch: true,
                }
              : { viewport: { width: 1440, height: 1100 } },
          ),
          page = await context.newPage();
        page.setDefaultTimeout(12000);
        await page.goto(base + "/admin");
        await page.locator("[name=password]").fill("atelier123");
        await page.locator("#login-form button").click();
        await page.locator("#panel").waitFor({ state: "visible" });
        await require("./prepared-variants-flow.cjs")(page, base, root, mobile);
        await context.close();
        console.log(
          "PASS variantes preparadas " +
            (mobile ? "móvil 320 px y gestos" : "escritorio") +
            ": cargar, ordenar, reemplazar, quitar, publicar, galerías 1/varias, inactivar, renombrar y WhatsApp.",
        );
      } finally {
        if (child && child.exitCode === null) {
          const exit = once(child, "exit");
          child.kill();
          await exit;
        }
        await rm(store, { recursive: true, force: true });
      }
    }
  } finally {
    if (browser) await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
