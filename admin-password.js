import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { mkdir, writeFile, rename } from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomBytes, scryptSync } from "node:crypto";
// Filtrar la salida del lector evita mostrar la contraseña sin APIs privadas.
let hidden = false;
const output = new Writable({
  write(chunk, encoding, callback) {
    if (!hidden) process.stdout.write(chunk, encoding);
    callback();
  },
});
output.columns = process.stdout.columns;
const rl = createInterface({
  input: process.stdin,
  output,
  terminal: !!process.stdin.isTTY,
});
console.log(
  "Configurar contraseña del panel de Proyecto Atelier. Reiniciá el servidor después.",
);
async function ask(label) {
  process.stdout.write(label);
  hidden = true;
  const value = await rl.question("");
  hidden = false;
  process.stdout.write("\n");
  return value;
}
try {
  const password = await ask(
    "Nueva contraseña (mínimo 12 caracteres; no se mostrará): ",
  );
  if (password.length < 12) throw Error("Debe tener al menos 12 caracteres.");
  if (password !== (await ask("Repetí la contraseña: ")))
    throw Error("Las contraseñas no coinciden.");
  const dir = resolve(process.env.ATELIER_DATA_DIR || ".storage");
  await mkdir(dir, { recursive: true });
  const salt = randomBytes(16).toString("hex");
  const file = join(dir, "admin.json"),
    temp = file + ".tmp";
  await writeFile(
    temp,
    JSON.stringify({
      salt,
      hash: scryptSync(password, salt, 64).toString("hex"),
    }),
    { mode: 0o600 },
  );
  await rename(temp, file);
  console.log("Contraseña guardada. Reiniciá npm run dev.");
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  rl.close();
}
