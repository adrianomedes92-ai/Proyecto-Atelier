const assert = require("node:assert/strict");
module.exports = async function flow(page, base, root, mobile = false) {
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
  const blue = await fixture("azul.png", "#235987"),
    side = await fixture("azul-lado.png", "#426e98"),
    arena = await fixture("arena.png", "#d2bb9c"),
    olive = await fixture("oliva.png", "#6e794c");
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  async function cropped(action, count = 1) {
    await action();
    for (let i = 0; i < count; i++) {
      await page.locator(".image-editor").waitFor();
      await page.locator("[data-crop-confirm]").click();
      await page.locator(".image-editor").waitFor({ state: "detached" });
    }
  }
  const codes = ["C-PR-AZ", "C-PR-AR", "C-PR-OL", "C-PR-IN", "C-PR-SF"],
    names = ["Azul", "Arena", "Oliva", "Inactivo", "Sin fotos"],
    indices = [];
  await page.locator("[data-tab=site]").click();
  await page
    .locator("[data-field=whatsappInternational]")
    .fill("5491112345678");
  await page.locator("[data-tab=materials]").click();
  const initialColors = await page.locator("[data-global-color]").count();
  for (let i = 0; i < codes.length; i++) {
    await page.locator("#add-color").click();
    const index = initialColors + i;
    indices.push(index);
    const row = page.locator(`[data-global-color="${index}"]`);
    await row.locator("[data-color-field=name]").fill(names[i]);
    await row.locator("[data-color-field=code]").fill(codes[i]);
  }
  assert.equal(
    await page
      .locator("[data-swatch], #color-catalog input[type=file]")
      .count(),
    0,
  );
  const suffix = mobile ? "móvil" : "escritorio",
    a = "Tela A " + suffix,
    b = "Tela B " + suffix;
  async function fabric(name, code, enabled) {
    await page.locator("#new-material").click();
    await page.locator("[data-field=name]").fill(name);
    await page.locator("[data-field=code]").fill(code);
    for (const i of enabled)
      await page.locator(`[data-color-choice="${indices[i]}"]`).check();
  }
  await fabric(a, "T-A", [0, 1, 4]);
  await fabric(b, "T-B", [0, 2]);
  assert.equal(
    await page.locator("[data-global-color]").count(),
    initialColors + 5,
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
  await page.locator("[data-tab=products]").click();
  await page.locator("[data-product=clapton-individual]").click();
  async function associate(code, files) {
    const choice = page.locator("[data-associate-choice]"),
      value = await choice
        .locator("option")
        .evaluateAll(
          (options, code) =>
            options.find((o) => o.textContent.includes(code)).value,
          code,
        );
    await choice.selectOption(value);
    await page.locator("[data-add-association]").click();
    const index = (await page.locator("[data-association]").count()) - 1,
      card = page.locator(`[data-association="${index}"]`);
    if (files.length) {
      await cropped(
        () => card.locator("[data-upload-variant]").setInputFiles(files),
        files.length,
      );
      await page.waitForFunction(
        ({ index, n }) =>
          document
            .querySelector(`[data-association="${index}"]`)
            ?.querySelectorAll(".image-item").length === n,
        { index, n: files.length },
      );
    }
  }
  await associate(codes[0], [blue, side]);
  await associate(codes[1], [arena]);
  await associate(codes[2], [olive]);
  await associate(codes[3], [olive]);
  await associate(codes[4], []);
  const card = page.locator('[data-association="0"]'),
    urls = () =>
      card
        .locator(".image-item img")
        .evaluateAll((list) => list.map((i) => i.getAttribute("src")));
  const first = await urls();
  await card.locator('[data-move-image="0"][data-delta="1"]').click();
  assert.deepEqual(await urls(), [first[1], first[0]]);
  await cropped(() =>
    card.locator('[data-replace-variant="0"]').setInputFiles(blue),
  );
  await page.waitForFunction(
    (old) =>
      document
        .querySelector('[data-association="0"] img')
        .getAttribute("src") !== old,
    first[1],
  );
  await card.locator('[data-remove-variant-image="1"]').click();
  await cropped(() =>
    card.locator("[data-upload-variant]").setInputFiles(side),
  );
  await page.waitForFunction(
    () =>
      document.querySelectorAll('[data-association="0"] .image-item').length ===
      2,
  );
  const beforeCrop = await urls();
  await card.locator('[data-recrop][data-crop-index="0"]').click();
  await page.locator(".image-editor").waitFor();
  await page.locator("[data-crop-zoom]").fill("2");
  await page.locator("[data-crop-confirm]").click();
  await page.waitForFunction(
    (old) =>
      document
        .querySelector('[data-association="0"] img')
        .getAttribute("src") !== old,
    beforeCrop[0],
  );
  const expected = await urls();
  await card.locator('[data-replace-variant="0"]').setInputFiles(blue);
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
  await page.locator("#save").click();
  await page.getByText("Todos los cambios están guardados.").waitFor();
  await page.reload();
  await page.locator("#panel").waitFor({ state: "visible" });
  await page.locator("[data-product=clapton-individual]").click();
  assert.deepEqual(await urls(), expected);
  const saved = await page.evaluate(() =>
    fetch("/api/admin/content").then((r) => r.json()),
  );
  assert.equal(saved.content.colors.length, initialColors + 5);
  assert.equal(
    saved.content.products[0].variants.filter((v) => v.code === codes[0])
      .length,
    1,
  );
  const product = saved.content.products.find(
      (p) => p.id === "clapton-individual",
    ),
    arenaUrl = product.variants.find((v) => v.code === codes[1]).images[0],
    oliveUrl = product.variants.find((v) => v.code === codes[2]).images[0];
  assert.deepEqual(
    saved.content.materials.find((m) => m.name === a).colorCodes,
    [codes[0], codes[1], codes[4]],
  );
  assert.equal(
    saved.content.materials.find((m) => m.name === a).swatches,
    undefined,
  );
  await page.goto(base);
  await page.locator("[data-product=clapton-individual]").click();
  const material = page.locator("select[name=material]"),
    color = page.locator("select[name=color]"),
    gallery = page.locator("#variant-preview");
  await material.selectOption(a);
  assert.deepEqual(
    await color.locator("option").evaluateAll((o) => o.map((x) => x.value)),
    ["", codes[0], codes[1]],
  );
  await color.selectOption(codes[0]);
  assert.equal(await gallery.locator("img").getAttribute("src"), expected[0]);
  await gallery.locator('[data-variant-step="1"]').click();
  assert.equal(
    await gallery.locator(".gallery-position").innerText(),
    "2 de 2",
  );
  await material.selectOption(b);
  assert.equal(await color.inputValue(), codes[0]);
  assert.deepEqual(
    await color.locator("option").evaluateAll((o) => o.map((x) => x.value)),
    ["", codes[0], codes[2]],
  );
  assert.equal(await gallery.locator("img").getAttribute("src"), expected[1]);
  assert.equal(
    await gallery.locator(".gallery-position").innerText(),
    "2 de 2",
  );
  assert.ok((await page.locator("#summary-text").innerText()).includes(b));
  await color.selectOption(codes[2]);
  assert.equal(await gallery.locator("img").getAttribute("src"), oliveUrl);
  assert.equal(
    await gallery.locator("[data-variant-step], .gallery-position").count(),
    0,
  );
  await material.selectOption(a);
  assert.equal(await color.inputValue(), "");
  assert.equal(await gallery.locator("img").count(), 0);
  await color.selectOption(codes[1]);
  assert.equal(await gallery.locator("img").getAttribute("src"), arenaUrl);
  assert.equal(await gallery.locator("[data-variant-step]").count(), 0);
  await page.evaluate(
    () =>
      (window.open = (url) => {
        window.__whatsapp = url;
        return null;
      }),
  );
  await page.locator("#whatsapp").click();
  const text = new URL(
    await page.evaluate(() => window.__whatsapp),
  ).searchParams.get("text");
  assert.ok(text.includes(a));
  assert.match(text, /Código de tela: T-A/);
  assert.match(text, /Arena · C-PR-AR/);
  assert.ok(text.includes(product.name));
  await color.selectOption(codes[0]);
  assert.equal(await gallery.locator("img").getAttribute("src"), expected[0]);
  if (mobile) {
    const image = gallery.locator("img");
    await image.scrollIntoViewIfNeeded();
    const rect = await image.boundingBox(),
      session = await page.context().newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: rect.x + rect.width * 0.65, y: rect.y + rect.height * 0.5 },
      ],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: rect.x + rect.width * 0.15, y: rect.y + rect.height * 0.5 },
      ],
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
  // Desactivar por casilla en A no afecta B. Renombrar un código global actualiza todas sus referencias.
  await page.goto(base + "/admin");
  await page.locator("#panel").waitFor({ state: "visible" });
  await page.locator("[data-tab=materials]").click();
  await page.getByRole("button", { name: new RegExp(a) }).click();
  await page.locator(`[data-color-choice="${indices[0]}"]`).uncheck();
  const row = page.locator(`[data-global-color="${indices[1]}"]`),
    codeInput = row.locator("[data-color-field=code]");
  await codeInput.fill(codes[0]);
  assert.equal(await codeInput.evaluate((i) => i.validity.valid), false);
  await codeInput.fill(codes[1] + "N");
  await page.locator("#save").click();
  await page.getByText("Todos los cambios están guardados.").waitFor();
  await page.goto(base);
  await page.locator("[data-product=clapton-individual]").click();
  await material.selectOption(a);
  assert.deepEqual(
    await color.locator("option").evaluateAll((o) => o.map((x) => x.value)),
    ["", codes[1] + "N"],
  );
  await color.selectOption(codes[1] + "N");
  assert.equal(await gallery.locator("img").getAttribute("src"), arenaUrl);
  await material.selectOption(b);
  assert.deepEqual(
    await color.locator("option").evaluateAll((o) => o.map((x) => x.value)),
    ["", codes[0], codes[2]],
  );
  await color.selectOption(codes[0]);
  assert.equal(await gallery.locator("img").getAttribute("src"), expected[0]);
  const final = await page.evaluate(() =>
    fetch("/api/content").then((r) => r.json()),
  );
  assert.deepEqual(
    final.content.products
      .find((p) => p.id === "clapton-individual")
      .variants.find((v) => v.code === codes[0]).images,
    expected,
  );
  assert.equal(final.content.colors.length, initialColors + 5);
  await page.locator("#close").click();
  // Revisar conflictos heredados sin publicar nombres/galerías ambiguos.
  const { legacyColors } = await import(
    root + "/tests/fixtures/legacy-colors.js"
  );
  const conflict = legacyColors(true);
  conflict.products[0].variants[0].images = [expected[0], expected[1]];
  conflict.products[0].variants[1].images = [expected[1], arenaUrl];
  await page.evaluate(async (content) => {
    const saved = await fetch("/api/admin/content").then((r) => r.json());
    const response = await fetch("/api/admin/content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revision: saved.revision, content }),
    });
    if (!response.ok) throw Error(await response.text());
  }, conflict);
  await page.goto(base);
  await page.locator("[data-product=clapton-individual]").click();
  await material.selectOption("PANNE");
  assert.ok(
    !(
      await color
        .locator("option")
        .evaluateAll((list) => list.map((o) => o.value))
    ).includes("AZ-01"),
  );
  await page.locator("#close").click();
  await page.goto(base + "/admin");
  await page.locator("#panel").waitFor({ state: "visible" });
  await page.locator("[data-tab=materials]").click();
  await page.locator('[data-global-color="0"] .migration-warning').waitFor();
  await page.locator('[data-confirm-color="0"]').click();
  await page.locator("[data-tab=products]").click();
  await page.locator("[data-product=clapton-individual]").click();
  assert.equal(
    await page.locator('[data-association="0"] .image-item').count(),
    3,
  );
  await page.locator('[data-association="0"] .migration-warning').waitFor();
  await page.locator("[data-confirm-gallery]").click();
  await page.locator("#save").click();
  await page.getByText("Todos los cambios están guardados.").waitFor();
  await page.goto(base);
  await page.locator("[data-product=clapton-individual]").click();
  await material.selectOption("PANNE");
  await color.selectOption("AZ-01");
  assert.equal(
    await gallery.locator(".gallery-position").innerText(),
    "1 de 3",
  );
  assert.equal(await gallery.locator("img").getAttribute("src"), expected[0]);
  await material.selectOption("MECHA");
  assert.equal(await color.inputValue(), "AZ-01");
  assert.equal(await gallery.locator("img").getAttribute("src"), expected[0]);
  await page.locator("#close").click();
  assert.deepEqual(errors, []);
};
