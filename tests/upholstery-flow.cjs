const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const { join } = require("node:path");
module.exports = async function upholsteryFlow(
  page,
  base,
  root,
  mobile = false,
) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.locator("[data-tab=products]").click();
  await page.locator("#add-upholstery-demo").click();
  const preview = page.locator("[data-upholstery-canvas]");
  await page.waitForFunction(
    () => document.querySelector("[data-upholstery-canvas]")?.width === 1100,
  );
  const pixels = () =>
    preview.evaluate((c) => {
      const ctx = c.getContext("2d");
      return [
        [0.5, 0.4],
        [0.145, 0.82],
        [0.04, 0.1],
        [0.5, 0.62],
      ].map(([x, y]) =>
        Array.from(
          ctx.getImageData(
            Math.floor(c.width * x),
            Math.floor(c.height * y),
            1,
            1,
          ).data,
        ),
      );
    });
  const original = await pixels();
  await page.locator("[data-upholstery-variant]").selectOption("2");
  await page.waitForFunction(
    () => document.querySelector("[data-preview-status]").textContent === "",
  );
  await page.waitForTimeout(120);
  const blue = await pixels();
  assert.notDeepEqual(blue[0], original[0]);
  assert.deepEqual(blue[1], original[1]);
  assert.deepEqual(blue[2], original[2]);
  assert.ok(blue[0][2] > blue[0][0]);
  const fixture = {
    name: "base.png",
    mimeType: "image/png",
    buffer: await readFile(join(root, "images/demo/armchair-base.png")),
  };
  page.once("dialog", (d) => d.accept());
  await page.locator("[data-upholstery-base]").setInputFiles(fixture);
  await page.waitForFunction(() =>
    document.querySelector("[data-mask-info]").textContent.includes("Todavía"),
  );
  assert.equal(
    await page.locator("[data-upholstery-enabled]").isChecked(),
    false,
  );
  await page.locator("[data-edit-mask]").click();
  await page.locator(".mask-editor").waitFor();
  await page.locator("[data-import]").setInputFiles({
    name: "mask.png",
    mimeType: "image/png",
    buffer: await readFile(join(root, "images/demo/armchair-mask.png")),
  });
  await page
    .locator("[data-mask-status]")
    .filter({ hasText: "importada" })
    .waitFor();
  const editor = page.locator(".mask-stage canvas");
  await page.locator("[data-erase]").click();
  const bounds = await editor.boundingBox();
  if (mobile) {
    const session = await page.context().newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: bounds.x + bounds.width * 0.5, y: bounds.y + bounds.height * 0.4 },
      ],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await session.detach();
  } else
    await editor.click({
      position: { x: bounds.width * 0.5, y: bounds.height * 0.4 },
    });
  await page.locator("[data-undo]").click();
  await page.locator("[data-confirm]").click();
  await page.locator(".mask-editor").waitFor({ state: "detached" });
  await page.waitForFunction(() => !document.querySelector("#save").disabled);
  await page.locator("[data-upholstery-enabled]").check();
  // Mantener el piloto oculto hasta la publicación explícita dentro de esta prueba aislada.
  const before = await page.evaluate(() =>
    fetch("/api/content").then((r) => r.json()),
  );
  assert.ok(!before.content.products.some((p) => p.id === "prueba-tapizado"));
  await page.locator("[data-field=visible]").check();
  await page.locator("#save").click();
  await page
    .locator("#save-state")
    .filter({ hasText: "Todos los cambios" })
    .waitFor();
  const data = await page.evaluate(() =>
    fetch("/api/admin/content").then((r) => r.json()),
  );
  const product = data.content.products.find((p) => p.id === "prueba-tapizado");
  assert.ok(product.upholstery.mask.endsWith(".png"));
  const info = await page.evaluate(
    (url) =>
      fetch("/api/admin/image-info?url=" + encodeURIComponent(url)).then((r) =>
        r.json(),
      ),
    product.upholstery.base,
  );
  const retained = await page.evaluate(
    (url) =>
      fetch(url).then(async (r) =>
        Array.from(new Uint8Array(await r.arrayBuffer())),
      ),
    info.sourceUrl,
  );
  assert.deepEqual(Buffer.from(retained), fixture.buffer);
  const oldMask = product.upholstery.mask;
  // Reabrir, cancelar y volver a editar sin cambiar la foto base.
  await page.locator("[data-edit-mask]").click();
  await page.locator(".mask-editor").waitFor();
  await page.keyboard.press("Escape");
  await page.locator(".mask-editor").waitFor({ state: "detached" });
  await page.locator("[data-edit-mask]").click();
  await page.locator(".mask-editor").waitFor();
  await page.locator("[data-confirm]").click();
  await page.locator(".mask-editor").waitFor({ state: "detached" });
  await page.waitForFunction(() => !document.querySelector("#save").disabled);
  await page.locator("#save").click();
  await page
    .locator("#save-state")
    .filter({ hasText: "Todos los cambios" })
    .waitFor();
  const after = await page.evaluate(() =>
    fetch("/api/admin/content").then((r) => r.json()),
  );
  const edited = after.content.products.find((p) => p.id === "prueba-tapizado");
  assert.notEqual(edited.upholstery.mask, oldMask);
  assert.equal(edited.upholstery.base, product.upholstery.base);
  assert.equal(
    await page.evaluate((url) => fetch(url).then((r) => r.status), oldMask),
    200,
  );
  // Tela, código, textura y nombre del color desde el administrador.
  await page.locator("[data-tab=materials]").click();
  await page.getByRole("button", { name: /Tela de demostración/ }).click();
  const viewport = page.viewportSize();
  await page.setViewportSize({ width: 800, height: 900 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
    true,
  );
  await page.setViewportSize(viewport);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
    true,
  );
  await page.locator("[data-field=code]").fill("DEMO-T02");
  await page.locator("[data-field=colorname-2]").fill("Azul prueba");
  await page.locator("#save").click();
  await page
    .locator("#save-state")
    .filter({ hasText: "Todos los cambios" })
    .waitFor();
  await page.goto(base);
  await page.locator("[data-product=prueba-tapizado]").click();
  await page
    .locator("select[name=material]")
    .selectOption("Tela de demostración");
  await page.locator("select[name=color]").selectOption("DEMO-Z");
  await page.waitForFunction(
    () => document.querySelector("#upholstery-status")?.textContent === "",
  );
  assert.match(
    await page.locator("#summary-text").innerText(),
    /Código de tela: DEMO-T02/,
  );
  assert.match(
    await page.locator("#summary-text").innerText(),
    /Azul prueba · DEMO-Z/,
  );
  assert.ok(await page.locator(".selected-fabric img").getAttribute("src"));
  await page.locator("#upholstery-canvas").screenshot({
    path: `/tmp/atelier-upholstery-preview-${mobile ? "mobile" : "desktop"}.png`,
  });
  await page.screenshot({
    path: `/tmp/atelier-upholstery-${mobile ? "mobile" : "desktop"}.png`,
    fullPage: true,
  });
  const first = await page
    .locator("#upholstery-canvas")
    .evaluate((c) => c.toDataURL());
  await page.locator("[data-code=DEMO-O]").click();
  await page.waitForFunction(
    () => document.querySelector("#upholstery-status").textContent === "",
  );
  assert.notEqual(
    await page.locator("#upholstery-canvas").evaluate((c) => c.toDataURL()),
    first,
  );
  assert.match(
    await page.locator("#summary-text").innerText(),
    /Oliva · DEMO-O/,
  );
  assert.equal(
    await page
      .locator("#customizer")
      .evaluate((d) => d.scrollWidth <= d.clientWidth + 1),
    true,
  );
  await page.locator("#close").click();
  assert.deepEqual(errors, []);
};
