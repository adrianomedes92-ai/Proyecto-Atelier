import sharp from "sharp";
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
    const png = await sharp({
      create: { width: 100, height: 80, channels: 3, background: "#aabbcc" },
    })
      .png()
      .toBuffer();
    const upload = await fetch(base + "/api/admin/upload", {
      method: "POST",
      headers: { Origin: base, Cookie: cookie },
      body: png,
    });
    assert.equal(upload.status, 201);
    const { url, thumbnailUrl } = await upload.json();
    assert.match(url, /-optimized\.webp$/);
    assert.equal((await fetch(base + thumbnailUrl)).status, 200);
    const photo = await fetch(base + url);
    assert.equal(photo.headers.get("content-type"), "image/webp");
    assert.equal(
      (await sharp(Buffer.from(await photo.arrayBuffer())).metadata()).format,
      "webp",
    );
    const info = await (
      await request(
        "/api/admin/image-info?url=" + encodeURIComponent(url),
        "GET",
        null,
        cookie,
      )
    ).json();
    const source = await request(info.sourceUrl, "GET", null, cookie);
    assert.deepEqual(Buffer.from(await source.arrayBuffer()), png);
    assert.equal((await request(info.sourceUrl)).status, 401);
    const crop = { x: 10, y: 8, width: 50, height: 40 };
    const croppedResponse = await request(
      "/api/admin/recrop",
      "POST",
      { url, kind: "product", crop },
      cookie,
    );
    assert.equal(croppedResponse.status, 201);
    const cropped = await croppedResponse.json();
    assert.notEqual(cropped.url, url);
    assert.equal(cropped.original, info.original);
    assert.deepEqual(cropped.crop, crop);
    assert.equal(
      (
        await sharp(
          Buffer.from(await (await fetch(base + cropped.url)).arrayBuffer()),
        ).metadata()
      ).width,
      50,
    );
    assert.equal(
      (
        await request(
          "/api/admin/recrop",
          "POST",
          { url, kind: "product", crop: { ...crop, x: 999 } },
          cookie,
        )
      ).status,
      400,
    );
    saved.content.site.heroImages = [url];
    saved.content.site.brandFontSize = 30;
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
    assert.deepEqual(restored.content.site.heroImages, [url]);
    assert.equal(restored.content.site.brandFontSize, 30);
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
test("contraseña simple solo en desarrollo local y sin cambiar credenciales guardadas", async () => {
  const dir = await mkdtemp(join(tmpdir(), "atelier-dev-"));
  const fs = await import("node:fs/promises");
  const crypto = await import("node:crypto");
  const original = JSON.stringify({
    salt: "test-salt",
    hash: crypto
      .scryptSync("contraseña-personal", "test-salt", 64)
      .toString("hex"),
  });
  await fs.writeFile(join(dir, "admin.json"), original);
  const env = {
    ...process.env,
    HOST: "127.0.0.1",
    PORT: "0",
    NODE_ENV: "development",
    ATELIER_DATA_DIR: dir,
  };
  delete env.ADMIN_PASSWORD;
  let child;
  try {
    child = spawn(process.execPath, ["server.js", "--development-login"], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const port = await new Promise((resolve, reject) => {
      let output = "";
      const timeout = setTimeout(() => reject(Error("No inició")), 10000);
      child.stdout.on("data", (d) => {
        output += d;
        const match = output.match(/Panel: http:\/\/localhost:(\d+)/);
        if (match) {
          clearTimeout(timeout);
          resolve(match[1]);
        }
      });
      child.once("exit", () => {
        clearTimeout(timeout);
        reject(Error("Servidor terminó"));
      });
    });
    const base = "http://127.0.0.1:" + port;
    assert.equal(
      (await (await fetch(base + "/api/admin/session")).json())
        .developmentLogin,
      true,
    );
    const login = await fetch(base + "/api/admin/login", {
      method: "POST",
      headers: { Origin: base, "Content-Type": "application/json" },
      body: JSON.stringify({ password: "atelier123" }),
    });
    assert.equal(login.status, 200);
    assert.equal(await fs.readFile(join(dir, "admin.json"), "utf8"), original);
    const exited = once(child, "exit");
    child.kill();
    await exited;
    for (const overrides of [{ NODE_ENV: "production" }, { HOST: "0.0.0.0" }]) {
      child = spawn(process.execPath, ["server.js", "--development-login"], {
        env: { ...env, ...overrides },
        stdio: "ignore",
      });
      const [code] = await once(child, "exit");
      assert.notEqual(code, 0);
    }
  } finally {
    if (child?.exitCode === null) {
      const exited = once(child, "exit");
      child.kill();
      await exited;
    }
    await rm(dir, { recursive: true, force: true });
  }
});
