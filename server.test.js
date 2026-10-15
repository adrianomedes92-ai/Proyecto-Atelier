import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
test("admin autenticado, fotos, validación, conflicto y persistencia", async () => {
  const store = await mkdtemp(join(tmpdir(), "atelier-test-"));
  const password = randomBytes(24).toString("hex");
  let child;
  async function start() {
    child = spawn(process.execPath, ["server.js"], {
      env: {
        ...process.env,
        PORT: "0",
        ATELIER_DATA_DIR: store,
        ADMIN_PASSWORD: password,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let error = "";
    child.stderr.on("data", (data) => (error += data));
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(Error("Servidor no inició: " + error)),
        10000,
      );
      child.stdout.on("data", (data) => {
        output += data;
        if (output.includes("Panel:")) {
          clearTimeout(timeout);
          resolve();
        }
      });
      child.once("exit", () => {
        clearTimeout(timeout);
        reject(Error("Servidor terminó: " + error));
      });
    });
    return output.match(/http:\/\/localhost:(\d+)/)[1];
  }
  async function stop() {
    const exited = once(child, "exit");
    child.kill();
    await exited;
  }
  try {
    let port = await start();
    let base = "http://127.0.0.1:" + port;
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
      (await request("/api/admin/login", "POST", { password: "wrong" })).status,
      401,
    );
    const login = await request("/api/admin/login", "POST", { password });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0];
    assert.match(login.headers.get("set-cookie"), /HttpOnly; SameSite=Strict/);
    const saved = await (
      await request("/api/admin/content", "GET", null, cookie)
    ).json();
    saved.content.products[0].name = "Modelo actualizado";
    saved.content.products[1].visible = false;
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4pUAAAAASUVORK5CYII=",
      "base64",
    );
    const upload = await fetch(base + "/api/admin/upload", {
      method: "POST",
      headers: { Origin: base, Cookie: cookie },
      body: png,
    });
    assert.equal(upload.status, 201);
    const { url } = await upload.json();
    saved.content.products[0].image = url;
    saved.content.products[0].images = [url];
    saved.content.materials[0].codes = ["001"];
    saved.content.materials[0].swatches = [{ code: "001", image: url }];
    assert.equal(
      (await request("/api/admin/content", "PUT", saved, cookie)).status,
      200,
    );
    assert.equal(
      (await request("/api/admin/content", "PUT", saved, cookie)).status,
      409,
    );
    const publicData = await (await request("/api/content")).json();
    assert.equal(publicData.content.products.length, 10);
    assert.equal(publicData.content.products[0].name, "Modelo actualizado");
    assert.equal((await fetch(base + url)).status, 200);
    const invalid = structuredClone(publicData);
    invalid.content.site.heroImage = "javascript:alert(1)";
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
    assert.equal((await request("/server.js")).status, 404);
    assert.equal((await request("/.storage/content.json")).status, 404);
    assert.equal(
      (await request("/api/admin/logout", "POST", {}, cookie)).status,
      200,
    );
    assert.equal(
      (await request("/api/admin/content", "GET", null, cookie)).status,
      401,
    );
    await stop();
    port = await start();
    base = "http://127.0.0.1:" + port;
    const restored = await (await request("/api/content")).json();
    assert.equal(restored.content.products[0].name, "Modelo actualizado");
    assert.equal(restored.content.products[0].image, url);
    assert.equal((await fetch(base + url)).status, 200);
    assert.equal(
      (await request("/api/admin/content", "GET", null, cookie)).status,
      401,
    );
  } finally {
    if (child && child.exitCode === null) await stop();
    await rm(store, { recursive: true, force: true });
  }
});
test("configurar contraseña desde terminal sin guardarla en texto plano", async () => {
  const dir = await mkdtemp(join(tmpdir(), "atelier-password-"));
  const password = randomBytes(20).toString("hex");
  const child = spawn(process.execPath, ["admin-password.js"], {
    env: { ...process.env, ATELIER_DATA_DIR: dir },
    stdio: ["pipe", "pipe", "pipe"],
  });
  let output = "",
    sent = 0;
  child.stdout.on("data", (data) => {
    output += data;
    if (sent === 0 && output.includes("Nueva contraseña")) {
      sent = 1;
      child.stdin.write(password + "\n");
    } else if (sent === 1 && output.includes("Repetí la contraseña")) {
      sent = 2;
      child.stdin.write(password + "\n");
    }
  });
  const timeout = setTimeout(() => child.kill(), 10000);
  try {
    const [code] = await once(child, "exit");
    assert.equal(code, 0);
    assert.ok(!output.includes(password));
    const credentials = JSON.parse(
      await (
        await import("node:fs/promises")
      ).readFile(join(dir, "admin.json"), "utf8"),
    );
    assert.equal(credentials.hash.length, 128);
    assert.ok(!JSON.stringify(credentials).includes(password));
  } finally {
    clearTimeout(timeout);
    await rm(dir, { recursive: true, force: true });
  }
});
