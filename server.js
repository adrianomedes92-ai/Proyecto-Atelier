import { createMedia, mediaInfo, originalBytes } from "./media-store.js";
import http from "node:http";
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { resolve, extname, join } from "node:path";
import {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { initialContent } from "./data.js";
import { validateContent } from "./content-schema.js";
const root = process.cwd(),
  store = resolve(process.env.ATELIER_DATA_DIR || join(root, ".storage"));
await mkdir(join(store, "uploads"), { recursive: true });
const contentFile = join(store, "content.json"),
  credentialFile = join(store, "admin.json");
async function atomic(file, data) {
  const temp = file + "." + randomUUID() + ".tmp";
  await writeFile(temp, JSON.stringify(data, null, 2), { mode: 0o600 });
  await rename(temp, file);
}
let saved;
try {
  saved = JSON.parse(await readFile(contentFile, "utf8"));
  saved.content = validateContent(saved.content);
} catch (e) {
  if (e.code !== "ENOENT") throw e;
  saved = { revision: 0, content: validateContent(initialContent()) };
  await atomic(contentFile, saved);
}
const developmentLogin = process.argv.includes("--development-login");
const host = process.env.HOST || "127.0.0.1";
if (
  developmentLogin &&
  (process.env.NODE_ENV === "production" ||
    !["127.0.0.1", "localhost", "::1"].includes(host))
) {
  throw Error(
    "La contraseña de desarrollo solo está disponible en localhost y fuera de producción. Usá npm start con una contraseña propia.",
  );
}
let credentials;
try {
  credentials = JSON.parse(await readFile(credentialFile, "utf8"));
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
if (process.env.ADMIN_PASSWORD && !developmentLogin) {
  if (process.env.ADMIN_PASSWORD.length < 12)
    throw Error("ADMIN_PASSWORD debe tener al menos 12 caracteres.");
  const salt = randomBytes(16).toString("hex");
  credentials = {
    salt,
    hash: scryptSync(process.env.ADMIN_PASSWORD, salt, 64).toString("hex"),
  };
}
if (developmentLogin) {
  const salt = randomBytes(16).toString("hex");
  credentials = {
    salt,
    hash: scryptSync("atelier123", salt, 64).toString("hex"),
  };
}
const sessions = new Map(),
  attempts = new Map();
let saving = false;
const json = (res, status, data) => {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
};
async function body(req, max = 1024 * 1024) {
  let size = 0;
  const parts = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > max)
      throw Object.assign(Error("Archivo o contenido demasiado grande."), {
        status: 413,
      });
    parts.push(chunk);
  }
  return Buffer.concat(parts);
}
async function input(req) {
  try {
    return JSON.parse((await body(req)).toString());
  } catch (e) {
    if (e.status) throw e;
    throw Object.assign(Error("JSON inválido."), { status: 400 });
  }
}
function session(req) {
  const token = (req.headers.cookie || "")
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("atelier_session="))
    ?.slice(16);
  const item = sessions.get(token);
  if (item && item.expires > Date.now()) return { token, ...item };
  if (token) sessions.delete(token);
  return null;
}
function sameOrigin(req) {
  if (req.headers["sec-fetch-site"] === "cross-site") return false;
  try {
    return (
      req.headers.origin &&
      new URL(req.headers.origin).host === req.headers.host
    );
  } catch {
    return false;
  }
}
const publicFiles = new Set([
  "index.html",
  "style.css",
  "app.js",
  "data.js",
  "quote.js",
  "admin.html",
  "admin.js",
  "admin.css",
  "content-schema.js",
  "image-urls.js",
  "product-gallery.js",
  "hero-slideshow.js",
  "brand.js",
  "image-editor.js",
  "upholstery-preview.js",
  "mask-editor.js",
  "upholstery-demo.js",
  "upholstery-admin.js",
  "crop-geometry.js",
]);
const server = http.createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' blob: data:; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  );
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    if (pathname.startsWith("/api/")) {
      if (!["GET", "POST", "PUT"].includes(req.method))
        return json(res, 405, { error: "Método no permitido." });
      if (req.method !== "GET" && !sameOrigin(req))
        return json(res, 403, { error: "Solicitud de origen no permitido." });
      if (pathname === "/api/content" && req.method === "GET")
        return json(res, 200, {
          revision: saved.revision,
          content: {
            ...saved.content,
            products: saved.content.products.filter((p) => p.visible),
          },
        });
      if (pathname === "/api/admin/session" && req.method === "GET")
        return json(res, 200, {
          authenticated: !!session(req),
          configured: !!credentials,
          developmentLogin,
        });
      if (pathname === "/api/admin/login" && req.method === "POST") {
        if (!credentials)
          return json(res, 503, {
            error:
              "Configurá la contraseña en la terminal con npm run admin:password y reiniciá el servidor.",
          });
        const key = req.socket.remoteAddress,
          entry = attempts.get(key) || { count: 0, until: 0 };
        if (entry.until > Date.now())
          return json(res, 429, {
            error: "Demasiados intentos. Esperá 15 minutos.",
          });
        const { password } = await input(req);
        const hash = scryptSync(
          typeof password === "string" ? password.slice(0, 1024) : "",
          credentials.salt,
          64,
        );
        if (!timingSafeEqual(hash, Buffer.from(credentials.hash, "hex"))) {
          entry.count++;
          if (entry.count >= 5) {
            entry.until = Date.now() + 900000;
            entry.count = 0;
          }
          attempts.set(key, entry);
          return json(res, 401, { error: "Contraseña incorrecta." });
        }
        attempts.delete(key);
        const token = randomBytes(32).toString("hex");
        sessions.set(token, { expires: Date.now() + 8 * 3600000 });
        res.setHeader(
          "Set-Cookie",
          `atelier_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.COOKIE_SECURE === "true" ? "; Secure" : ""}`,
        );
        return json(res, 200, { ok: true });
      }
      if (!session(req))
        return json(res, 401, { error: "Ingresá al panel para continuar." });
      if (pathname === "/api/admin/logout" && req.method === "POST") {
        sessions.delete(session(req).token);
        res.setHeader(
          "Set-Cookie",
          "atelier_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
        );
        return json(res, 200, { ok: true });
      }
      if (pathname === "/api/admin/content" && req.method === "GET")
        return json(res, 200, saved);
      if (pathname === "/api/admin/content" && req.method === "PUT") {
        const data = await input(req);
        if (saving || data.revision !== saved.revision)
          return json(res, 409, {
            error:
              "El contenido cambió en otra sesión. Copiá tus cambios y recargá el panel antes de guardar.",
          });
        const content = validateContent(data.content);
        saving = true;
        try {
          const next = { revision: saved.revision + 1, content };
          await atomic(contentFile, next);
          saved = next;
          return json(res, 200, { revision: saved.revision, ok: true });
        } finally {
          saving = false;
        }
      }
      if (pathname === "/api/admin/image-info" && req.method === "GET") {
        const url = new URL(req.url, "http://localhost").searchParams.get(
          "url",
        );
        return json(res, 200, await mediaInfo(store, url));
      }
      if (pathname === "/api/admin/image-source" && req.method === "GET") {
        const url = new URL(req.url, "http://localhost").searchParams.get(
          "url",
        );
        const info = await mediaInfo(store, url),
          bytes = await originalBytes(store, info);
        res.setHeader(
          "Content-Type",
          info.original?.endsWith(".jpg")
            ? "image/jpeg"
            : info.original?.endsWith(".png")
              ? "image/png"
              : "image/webp",
        );
        res.setHeader("Cache-Control", "no-store");
        res.end(bytes);
        return;
      }
      if (pathname === "/api/admin/recrop" && req.method === "POST") {
        const request = await input(req);
        const info = await mediaInfo(store, request.url);
        if (!request.crop)
          return json(res, 400, { error: "Falta el encuadre." });
        return json(
          res,
          201,
          await createMedia(
            store,
            await originalBytes(store, info),
            request.kind,
            request.crop,
            info.legacy ? null : info.original,
          ),
        );
      }
      if (pathname === "/api/admin/upload" && req.method === "POST") {
        const bytes = await body(req, 20 * 1024 * 1024);
        const kind = req.headers["x-image-kind"] || "product";
        let crop = null;
        try {
          if (req.headers["x-image-crop"])
            crop = JSON.parse(req.headers["x-image-crop"]);
        } catch {
          return json(res, 400, { error: "El encuadre no es válido." });
        }
        return json(res, 201, await createMedia(store, bytes, kind, crop));
      }
      return json(res, 404, { error: "No encontrado." });
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405);
      return res.end();
    }
    let file;
    if (
      /^\/uploads\/[a-f0-9-]+(?:-(?:optimized|card))?\.(jpg|png|webp)$/.test(
        pathname,
      )
    )
      file = join(store, pathname.slice(1));
    else if (/^\/images\/[a-zA-Z0-9_/-]+\.(jpg|jpeg|png|webp)$/.test(pathname))
      file = join(root, pathname);
    else {
      const name =
        pathname === "/"
          ? "index.html"
          : pathname === "/admin" || pathname === "/admin/"
            ? "admin.html"
            : pathname.slice(1);
      if (!publicFiles.has(name)) {
        res.writeHead(404);
        return res.end("No encontrado");
      }
      file = join(root, name);
    }
    const data = await readFile(file);
    res.setHeader(
      "Content-Type",
      {
        ".html": "text/html; charset=utf-8",
        ".css": "text/css",
        ".js": "text/javascript",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
      }[extname(file)],
    );
    res.setHeader(
      "Cache-Control",
      pathname.startsWith("/uploads/")
        ? "public, max-age=31536000, immutable"
        : "no-cache",
    );
    res.end(req.method === "HEAD" ? undefined : data);
  } catch (e) {
    if (e.code === "ENOENT") {
      if (req.url.startsWith("/api/"))
        return json(res, 404, {
          error:
            "No se encontró la imagen o su original. Revisá el respaldo del almacenamiento.",
        });
      res.writeHead(404);
      res.end("No encontrado");
    } else {
      console.error(
        e.status ? e.message : "Error interno al procesar solicitud",
      );
      json(res, e.status || 500, {
        error: e.status ? e.message : "No se pudo completar la operación.",
      });
    }
  }
});
const port = process.env.PORT === undefined ? 3000 : Number(process.env.PORT);
server.listen(port, host, () => {
  console.log(
    `Proyecto Atelier: http://localhost:${server.address().port}\nPanel: http://localhost:${server.address().port}/admin`,
  );
  if (developmentLogin)
    console.log(
      "Modo local de desarrollo: contraseña del panel atelier123. La contraseña personal guardada no se modifica.",
    );
  if (!credentials)
    console.log(
      "Para habilitar el panel: npm run admin:password, luego reiniciar el servidor.",
    );
});
