const assert = require("node:assert/strict");
module.exports = async function variantsFlow(page, base, root, mobile = false) {
  const sharp = require(root + "/node_modules/sharp");
  const fixture = async (name, color) => ({
    name,
    mimeType: "image/png",
    buffer: await sharp({
      create: { width: 600, height: 400, channels: 3, background: color },
    })
      .png()
      .toBuffer(),
  });
  const blue = await fixture("azul-frente.png", "#235987"),
    side = await fixture("azul-lateral.png", "#426e98"),
    beige = await fixture("arena-frente.png", "#d2bb9c"),
    replacement = await fixture("azul-nueva.png", "#316988");
  async function cropped(action, count = 1) {
    await action();
    for (let i = 0; i < count; i++) {
      await page.locator(".image-editor").waitFor();
      await page.locator("[data-crop-confirm]").click();
      await page.locator(".image-editor").waitFor({ state: "detached" });
    }
  }
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.locator("[data-tab=site]").click();
  await page
    .locator("[data-field=whatsappInternational]")
    .fill("5491112345678");
  await page.locator("[data-tab=materials]").click();
  await page.locator("#new-material").click();
  const fabric = "Tela preparada " + (mobile ? "móvil" : "escritorio");
  await page.locator("[data-field=name]").fill(fabric);
  await page.locator("[data-field=type]").fill("Tela");
  await page.locator("[data-field=code]").fill("T-01");
  async function color(code, name, file, active = true) {
    await page.locator("#add-code").click();
    const count = await page.locator("[data-color-row]").count(),
      i = count - 1,
      row = page.locator(`[data-color-row="${i}"]`);
    await row.locator(`[data-field="variant-code-${i}"]`).fill(code);
    await row.locator(`[data-field="variant-name-${i}"]`).fill(name);
    await cropped(() => row.locator("[data-swatch]").setInputFiles(file));
    await row.locator("img").waitFor();
    if (!active) await row.locator("[data-active]").uncheck();
  }
  await color("AZ-01", "Azul", blue);
  await color("AR-02", "Arena", beige);
  await color("IN-03", "Inactivo", beige, false);
  await color("SF-04", "Sin fotos", side);
  assert.equal(await page.locator(".image-editor, .mask-editor").count(), 0);
  await page.locator("[data-tab=products]").click();
  await page.locator("[data-product=clapton-individual]").click();
  async function associate(code, files) {
    const choice = page.locator("[data-associate-choice]");
    const value = await choice
      .locator("option")
      .evaluateAll(
        (options, code) =>
          options.find(
            (o) =>
              o.textContent.includes(" / ") && o.textContent.includes(code),
          ).value,
        code,
      );
    await choice.selectOption(value);
    await page.locator("[data-add-association]").click();
    const count = await page.locator("[data-association]").count(),
      card = page.locator(`[data-association="${count - 1}"]`);
    if (files?.length) {
      await cropped(
        () => card.locator("[data-upload-variant]").setInputFiles(files),
        files.length,
      );
      await page.waitForFunction(
        ({ index, n }) =>
          document
            .querySelector(`[data-association="${index}"]`)
            ?.querySelectorAll(".image-item").length === n,
        { index: count - 1, n: files.length },
      );
    }
    return count - 1;
  }
  const a = await associate("AZ-01", [blue, side]);
  await associate("AR-02", [beige]);
  await associate("IN-03", [side]);
  await associate("SF-04", []);
  const card = page.locator(`[data-association="${a}"]`),
    urls = () =>
      card
        .locator(".image-item img")
        .evaluateAll((list) => list.map((i) => i.getAttribute("src")));
  const uploaded = await urls();
  await card.locator('[data-move-image="0"][data-delta="1"]').click();
  assert.deepEqual(await urls(), [uploaded[1], uploaded[0]]);
  await cropped(() =>
    card.locator('[data-replace-variant="0"]').setInputFiles(replacement),
  );
  await page.waitForFunction(
    (old) =>
      document
        .querySelector('[data-association="0"] .image-item img')
        .getAttribute("src") !== old,
    uploaded[1],
  );
  const replaced = await urls();
  assert.notEqual(replaced[0], uploaded[1]);
  assert.equal(replaced[1], uploaded[0]);
  await card.locator('[data-remove-variant-image="1"]').click();
  assert.equal((await urls()).length, 1);
  await cropped(() =>
    card.locator("[data-upload-variant]").setInputFiles(side),
  );
  await page.waitForFunction(
    () =>
      document.querySelectorAll('[data-association="0"] .image-item').length ===
      2,
  );
  const beforeRecrop = await urls();
  await card.locator('[data-recrop][data-crop-index="0"]').click();
  await page.locator(".image-editor").waitFor();
  await page.locator("[data-crop-zoom]").fill("2");
  await page.locator("[data-crop-confirm]").click();
  await page.waitForFunction(
    (old) =>
      document
        .querySelector('[data-association="0"] .image-item img')
        .getAttribute("src") !== old,
    beforeRecrop[0],
  );
  const expected = await urls();
  assert.notEqual(expected[0], beforeRecrop[0]);
  await card.locator('[data-replace-variant="0"]').setInputFiles(replacement);
  await page.locator(".image-editor").waitFor();
  await page.locator("[data-crop-cancel]").first().click();
  await page.waitForFunction(() => !document.querySelector("#save").disabled);
  assert.deepEqual(await urls(), expected);

  const before = await page.evaluate(() =>
    fetch("/api/content").then((r) => r.json()),
  );
  assert.equal(
    (
      before.content.products.find((p) => p.id === "clapton-individual")
        .variants || []
    ).length,
    0,
  );
  const viewport = page.viewportSize();
  await page.setViewportSize({ width: 800, height: 900 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    true,
  );
  await page.setViewportSize(viewport);
  await page.locator("#save").click();
  await page.getByText("Todos los cambios están guardados.").waitFor();
  await page.reload();
  await page.locator("#panel").waitFor({ state: "visible" });
  await page.locator("[data-product=clapton-individual]").click();
  assert.deepEqual(await urls(), expected);
  const stored = await page.evaluate(() =>
    fetch("/api/admin/content").then((r) => r.json()),
  );
  const product = stored.content.products.find(
      (p) => p.id === "clapton-individual",
    ),
    m = stored.content.materials.find((m) => m.name === fabric);
  assert.equal(m.swatches.find((v) => v.code === "IN-03").active, false);
  assert.deepEqual(product.variants[0].images, expected);
  const beigeUrl = product.variants[1].images[0];
  await page.goto(base);
  await page.locator("[data-product=clapton-individual]").click();
  await page.locator("select[name=material]").selectOption(fabric);
  assert.deepEqual(
    await page
      .locator("select[name=color] option")
      .evaluateAll((options) => options.map((o) => o.value)),
    ["", "AZ-01", "AR-02"],
  );
  await page.locator("select[name=color]").selectOption("AZ-01");
  const gallery = page.locator("#variant-preview");
  assert.equal(await gallery.locator("img").getAttribute("src"), expected[0]);
  assert.equal(
    await gallery.locator(".gallery-position").innerText(),
    "1 de 2",
  );
  await gallery.locator('[data-variant-step="1"]').click();
  assert.equal(await gallery.locator("img").getAttribute("src"), expected[1]);
  assert.equal(
    await gallery.locator(".gallery-position").innerText(),
    "2 de 2",
  );
  await gallery.locator('[data-variant-step="-1"]').click();
  assert.equal(await gallery.locator("img").getAttribute("src"), expected[0]);
  await page.locator("[data-code=AR-02]").click();
  assert.equal(await gallery.locator("img").getAttribute("src"), beigeUrl);
  assert.equal(
    await gallery.locator("[data-variant-step], .gallery-position").count(),
    0,
  );
  assert.match(
    await page.locator("#summary-text").innerText(),
    /Arena · AR-02/,
  );
  await page.evaluate(
    () =>
      (window.open = (url) => {
        window.__whatsapp = url;
        return null;
      }),
  );
  await page.locator("#whatsapp").click();
  const link = await page.evaluate(() => window.__whatsapp),
    text = new URL(link).searchParams.get("text");
  assert.match(text, /Código de tela: T-01/);
  assert.ok(text.includes(fabric));
  assert.match(text, /Arena · AR-02/);
  await page.locator("select[name=color]").selectOption("AZ-01");
  assert.equal(await gallery.locator("img").getAttribute("src"), expected[0]);
  assert.equal(
    await gallery.locator(".gallery-position").innerText(),
    "1 de 2",
  );
  if (mobile) {
    const image = gallery.locator("img");
    await image.scrollIntoViewIfNeeded();
    const b = await image.boundingBox(),
      session = await page.context().newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: b.x + b.width * 0.65, y: b.y + b.height * 0.5 }],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: b.x + b.width * 0.15, y: b.y + b.height * 0.5 }],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await session.detach();
    assert.equal(
      await gallery.locator(".gallery-position").innerText(),
      "2 de 2",
    );
  }
  assert.equal(
    await page
      .locator("#customizer")
      .evaluate((d) => d.scrollWidth <= d.clientWidth + 1),
    true,
  );
  assert.equal(await page.locator("canvas").count(), 0);
  await page.locator("#close").click();
  await page.locator("[data-product=clapton-martillo]").click();
  assert.equal(await page.locator("select[name=material] option").count(), 1);
  await page.locator("#close").click();
  // Inactivar conserva las fotos; al renombrar el código se actualizan sus asociaciones.
  await page.goto(base + "/admin");
  await page.locator("#panel").waitFor({ state: "visible" });
  await page.locator("[data-tab=materials]").click();
  await page.getByRole("button", { name: new RegExp(fabric) }).click();
  await page.locator('[data-active="0"]').uncheck();
  await page.locator("[data-field=variant-code-1]").fill("AR-02N");
  await page.locator("#save").click();
  await page.getByText("Todos los cambios están guardados.").waitFor();
  await page.goto(base);
  await page.locator("[data-product=clapton-individual]").click();
  await page.locator("select[name=material]").selectOption(fabric);
  assert.deepEqual(
    await page
      .locator("select[name=color] option")
      .evaluateAll((options) => options.map((o) => o.value)),
    ["", "AR-02N"],
  );
  await page.locator("select[name=color]").selectOption("AR-02N");
  assert.equal(
    await page.locator("#variant-preview img").getAttribute("src"),
    beigeUrl,
  );
  const final = await page.evaluate(() =>
    fetch("/api/content").then((r) => r.json()),
  );
  assert.deepEqual(
    final.content.products.find((p) => p.id === "clapton-individual")
      .variants[0].images,
    expected,
  );
  await page.locator("#close").click();
  assert.deepEqual(errors, []);
};
