import { orderedProducts } from "./catalog-sections.js";
export function assignmentFields(p, content, esc) {
  const section = content.sections.find((s) => s.id === p.sectionId);
  return `<label>Sección<select id="product-section">${content.sections.map((s) => `<option value="${esc(s.id)}" ${s.id === p.sectionId ? "selected" : ""}>${esc(s.name)}${s.active ? "" : " (inactiva)"}</option>`).join("")}</select></label><label>Subsección<select id="product-subsection"><option value="">Sin subsección</option>${(section?.subsections || []).map((s) => `<option value="${esc(s.id)}" ${s.id === p.subsectionId ? "selected" : ""}>${esc(s.name)}${s.active ? "" : " (inactiva)"}</option>`).join("")}</select></label><div><span>Orden dentro de esta subsección</span><button type="button" class="secondary" data-product-move="-1">↑ Antes</button><button type="button" class="secondary" data-product-move="1">↓ Después</button></div>`;
}
export function bindAssignment(p, content, container, { changed, render }) {
  container.querySelector("#product-section").onchange = (e) => {
    p.sectionId = e.target.value;
    p.subsectionId = "";
    p.sortOrder = nextOrder(content, p);
    changed();
    render();
  };
  container.querySelector("#product-subsection").onchange = (e) => {
    p.subsectionId = e.target.value;
    p.sortOrder = nextOrder(content, p);
    changed();
    render();
  };
  const peers = orderedProducts(
    content.products.filter(
      (x) => x.sectionId === p.sectionId && x.subsectionId === p.subsectionId,
    ),
  );
  container.querySelectorAll("[data-product-move]").forEach((b) => {
    const index = peers.indexOf(p),
      target = index + Number(b.dataset.productMove);
    b.disabled = target < 0 || target >= peers.length;
    b.onclick = () => {
      [peers[index], peers[target]] = [peers[target], peers[index]];
      peers.forEach((x, i) => (x.sortOrder = i));
      changed();
      render();
    };
  });
}
function nextOrder(content, p) {
  return (
    Math.max(
      -1,
      ...content.products
        .filter(
          (x) =>
            x !== p &&
            x.sectionId === p.sectionId &&
            x.subsectionId === p.subsectionId,
        )
        .map((x) => x.sortOrder),
    ) + 1
  );
}
export function renderSectionAdmin(
  container,
  content,
  { esc, changed, render, status },
) {
  const sectionOptions = (s) =>
    content.sections
      .filter((x) => x !== s)
      .map((x) => `<option value="${esc(x.id)}">${esc(x.name)}</option>`)
      .join("");
  const row = (node, section, index, isSub) => {
    const list = isSub ? section.subsections : content.sections;
    const count = content.products.filter(
      (p) =>
        p.sectionId === section.id && (!isSub || p.subsectionId === node.id),
    ).length;
    return `<div class="taxonomy-row" data-node="${esc(node.id)}" data-parent="${isSub ? esc(section.id) : ""}"><label>Nombre de ${isSub ? "subsección" : "sección"}<input data-name maxlength="100" required value="${esc(node.name)}"></label><label class="check"><input data-active type="checkbox" ${node.active ? "checked" : ""}>Activa</label><div class="taxonomy-actions"><button class="secondary" data-move="-1" ${index === 0 ? "disabled" : ""}>↑</button><button class="secondary" data-move="1" ${index === list.length - 1 ? "disabled" : ""}>↓</button><span>${count} producto(s)</span></div><label>Destino de los productos al eliminar<select data-destination>${
      isSub
        ? `<option value="">Esta sección, sin subsección</option>${section.subsections
            .filter((x) => x !== node)
            .map((x) => `<option value="${esc(x.id)}">${esc(x.name)}</option>`)
            .join("")}`
        : `<option value="">Elegí otra sección</option>${sectionOptions(section)}`
    }</select></label><button class="secondary danger" data-delete>Eliminar ${isSub ? "subsección" : "sección"}</button></div>`;
  };
  container.innerHTML = `<section class="editor-card"><h2>Secciones</h2><p>Los cambios se publican al guardar. Desactivar una sección oculta sus productos sin eliminarlos. Las categorías vacías no aparecen en la web.</p><button id="add-section">＋ Agregar sección</button>${content.sections.map((s, i) => `<section class="taxonomy-section">${row(s, s, i, false)}<h3>Subsecciones de ${esc(s.name)}</h3>${s.subsections.map((sub, j) => row(sub, s, j, true)).join("")}<button class="secondary" data-add-sub="${esc(s.id)}">＋ Agregar subsección</button></section>`).join("")}</section>`;
  const add = () => ({
    id: "categoria-" + crypto.randomUUID(),
    name: "Nueva categoría",
    active: true,
  });
  container.querySelector("#add-section").onclick = () => {
    content.sections.push({ ...add(), subsections: [] });
    changed();
    render();
  };
  container.querySelectorAll("[data-add-sub]").forEach(
    (b) =>
      (b.onclick = () => {
        content.sections
          .find((s) => s.id === b.dataset.addSub)
          .subsections.push(add());
        changed();
        render();
      }),
  );
  container.querySelectorAll("[data-node]").forEach((el) => {
    const isSub = !!el.dataset.parent,
      section = content.sections.find(
        (s) => s.id === (isSub ? el.dataset.parent : el.dataset.node),
      );
    const list = isSub ? section.subsections : content.sections,
      node = list.find((x) => x.id === el.dataset.node);
    el.querySelector("[data-name]").oninput = (e) => {
      node.name = e.target.value;
      changed();
    };
    el.querySelector("[data-active]").onchange = (e) => {
      node.active = e.target.checked;
      changed();
    };
    el.querySelectorAll("[data-move]").forEach(
      (b) =>
        (b.onclick = () => {
          const from = list.indexOf(node),
            to = from + Number(b.dataset.move);
          if (to < 0 || to >= list.length) return;
          [list[from], list[to]] = [list[to], list[from]];
          changed();
          render();
        }),
    );
    el.querySelector("[data-delete]").onclick = () => {
      const affected = content.products.filter(
          (p) =>
            p.sectionId === section.id &&
            (!isSub || p.subsectionId === node.id),
        ),
        destination = el.querySelector("[data-destination]").value;
      if (!isSub && affected.length && !destination) {
        status(
          "Elegí otra sección para reasignar los productos antes de eliminar.",
          true,
        );
        return;
      }
      if (
        !confirm(
          `¿Eliminar «${node.name}»? ${affected.length ? `Se reasignarán ${affected.length} producto(s) al destino indicado sin borrar sus fotos.` : "No tiene productos asignados."} Se aplica al guardar.`,
        )
      )
        return;
      affected.forEach((p) => {
        if (isSub) p.subsectionId = destination;
        else {
          p.sectionId = destination;
          p.subsectionId = "";
        }
        p.sortOrder = nextOrder(content, p);
      });
      list.splice(list.indexOf(node), 1);
      changed();
      render();
    };
  });
}
