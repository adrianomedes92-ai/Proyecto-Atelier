const assert = require("node:assert/strict");
module.exports = async function (page, base, root, mobile = false) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const saved = await page.evaluate(
    async () => await (await fetch("/api/admin/content")).json(),
  );
  const c = saved.content;
  c.contact.whatsappInternational = "5491112345678";
  // Usar productos existentes y sus fotos; no borrar el resto del catálogo.
  const wood = c.sections.find((s) => s.id === "muebles-de-madera");
  const p = c.products[0],
    q = c.products[1];
  p.name = "Rack de prueba";
  p.sectionId = wood.id;
  p.subsectionId = wood.subsections[0].id;
  p.options = ["notes"];
  p.visible = true;
  p.sortOrder = 0;
  p.reference = "120 × 40 × 60 cm";
  q.name = "Rack segundo";
  q.sectionId = wood.id;
  q.subsectionId = wood.subsections[0].id;
  q.options = ["notes"];
  q.visible = true;
  q.sortOrder = 1;
  const result = await page.evaluate(
    async ({ content, revision }) => {
      const r = await fetch("/api/admin/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, revision }),
      });
      return { status: r.status, body: await r.text() };
    },
    { content: c, revision: saved.revision },
  );
  assert.equal(result.status, 200, result.body);
  await page.reload();
  await page.locator("#panel").waitFor({ state: "visible" });
  await page.locator("[data-tab=sections]").click();
  const woodRow = () => page.locator('[data-node="muebles-de-madera"]');
  await woodRow().locator("[data-name]").fill("Muebles de madera a medida");
  // Crear, editar, ordenar y eliminar una sección vacía.
  await page.locator("#add-section").click();
  let rows = page.locator('[data-node][data-parent=""]');
  const addedId = await rows.last().getAttribute("data-node");
  await rows.last().locator("[data-name]").fill("Nueva colección");
  await rows.last().locator('[data-move="-1"]').click();
  assert.equal(await rows.nth(1).getAttribute("data-node"), addedId);
  page.once("dialog", (d) => d.accept());
  await page.locator(`[data-node="${addedId}"] [data-delete]`).click();
  // Añadir una subsección y asignar un producto sin volver a cargar fotos.
  await page.locator('[data-add-sub="muebles-de-madera"]').click();
  let subs = page.locator('[data-parent="muebles-de-madera"]');
  const subId = await subs.last().getAttribute("data-node");
  await subs.last().locator("[data-name]").fill("Racks especiales");
  await subs.last().locator('[data-move="-1"]').click();
  await page.locator("[data-tab=products]").click();
  await page.locator(`[data-product="${p.id}"]`).click();
  assert.equal(await page.locator("[data-option=material]").isChecked(), false);
  await page.locator('[data-product-move="1"]').click();
  await page.locator("#save").click();
  await page.getByText("Todos los cambios están guardados.").waitFor();
  const after = await page.evaluate(
    async () => (await (await fetch("/api/admin/content")).json()).content,
  );
  assert.deepEqual(after.products.find((x) => x.id === p.id).images, p.images);
  await page.goto(
    base + "/?section=muebles-de-madera&subsection=madera-1#catalogo",
  );
  await page.locator("#cards article").first().waitFor();
  assert.deepEqual(await page.locator("#cards h3").allTextContents(), [
    "Rack segundo",
    "Rack de prueba",
  ]);
  const link = page
    .locator("#cards article")
    .filter({ hasText: "Rack de prueba" })
    .locator("a.text-button");
  const text = new URL(await link.getAttribute("href")).searchParams.get(
    "text",
  );
  assert.ok(text.includes("Rack de prueba"));
  assert.ok(text.includes("120 × 40 × 60 cm"));
  assert.ok(!text.includes("Tapizado:"));
  assert.equal(await page.locator("#filters a").count(), 2); // Todos + única subsección con productos.
  assert.ok(
    await page
      .locator("#section-links a")
      .filter({ hasText: "Muebles de madera a medida" })
      .count(),
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    true,
  );
  if (mobile) {
    const widths = await page
      .locator("#cards article")
      .evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect()));
    assert.ok(widths[0].width > 250);
    assert.equal(Math.round(widths[0].x), Math.round(widths[1].x));
  }
  // Cambiar sección desde encabezado, conservar URL y volver con historial.
  await page.locator('#section-links [data-section="sillones"]').click();
  await page.waitForURL(/section=sillones/);
  await page.goBack();
  await page.waitForURL(/subsection=madera-1/);
  assert.equal(await page.locator("#cards article").count(), 2);
  await page.reload();
  await page.locator("#cards article").first().waitFor();
  assert.equal(
    await page.locator("#catalog-current").innerText(),
    "Muebles de madera a medida / Racks",
  );
  await page.goto(base + "/admin");
  await page.locator("#panel").waitFor({ state: "visible" });
  await page.locator("[data-tab=products]").click();
  await page.locator(`[data-product="${p.id}"]`).click();
  await page.locator("#product-subsection").selectOption(subId);
  await page.locator("[data-tab=sections]").click();
  // No permite eliminar sección ocupada sin elegir destino.
  await woodRow().locator("[data-delete]").click();
  assert.match(await page.locator("#status").innerText(), /Elegí otra sección/);
  // Eliminar subsección ocupada reasignando a Racks.
  const subRow = page.locator(`[data-node="${subId}"]`);
  await subRow.locator("[data-destination]").selectOption("madera-1");
  page.once("dialog", (d) => d.accept());
  await subRow.locator("[data-delete]").click();
  await woodRow().locator("[data-active]").uncheck();
  await page.locator("#save").click();
  await page.getByText("Todos los cambios están guardados.").waitFor();
  let publicData = await page.evaluate(
    async () => (await (await fetch("/api/content")).json()).content,
  );
  assert.ok(!publicData.products.some((x) => x.id === p.id));
  assert.ok(!publicData.sections.some((s) => s.id === wood.id));
  await woodRow().locator("[data-active]").check();
  await page.locator("#save").click();
  await page.getByText("Todos los cambios están guardados.").waitFor();
  // Eliminar sección con reasignación preserva los dos productos.
  await woodRow().locator("[data-destination]").selectOption("sillones");
  page.once("dialog", (d) => d.accept());
  await woodRow().locator("[data-delete]").click();
  await page.locator("#save").click();
  await page.getByText("Todos los cambios están guardados.").waitFor();
  const final = await page.evaluate(
    async () => (await (await fetch("/api/admin/content")).json()).content,
  );
  assert.equal(final.products.find((x) => x.id === p.id).sectionId, "sillones");
  assert.equal(final.products.length, c.products.length);
  assert.deepEqual(final.products.find((x) => x.id === p.id).images, p.images);
  assert.ok(!final.sections.some((s) => s.id === wood.id));
  assert.deepEqual(errors, []);
};
