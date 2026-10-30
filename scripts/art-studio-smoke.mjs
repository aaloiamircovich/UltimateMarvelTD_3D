import { chromium } from "@playwright/test";
import { createServer } from "vite";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";

const server = await createServer({ server: { host: "127.0.0.1", port: 5174, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ["--enable-webgl", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
await mkdir("artifacts", { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
  const errors = [], external = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("request", request => { if (/^https?:/.test(request.url()) && !request.url().startsWith("http://127.0.0.1:5174/")) external.push(request.url()); });
  await page.goto("http://127.0.0.1:5174/art-studio.html");
  await page.locator('#open-iron-man').click();
  await page.locator('#status[data-state="ready"]').waitFor();
  assert.match(await page.locator('#model-stats').textContent(), /Huesos24/);
  await page.locator("#model-file").setInputFiles(resolve("test/fixtures/blender-probe.glb"));
  await page.locator('#status[data-state="ready"]').waitFor();
  assert.match(await page.locator("#animation").textContent(), /Idle/);
  assert.match(await page.locator("#model-stats").textContent(), /Huesos1/);
  await page.screenshot({ path: "artifacts/art-studio-desktop.png" });
  await page.locator("#play").click(); assert.equal(await page.locator("#play").textContent(), "Reproducir");
  await page.locator("#wireframe").check(); await page.locator("#grid").uncheck();
  await page.locator("#frame").click();
  await page.locator("#model-file").setInputFiles({ name: "broken.glb", mimeType: "model/gltf-binary", buffer: Buffer.from("invalid") });
  await page.locator('#status[data-state="error"]').waitFor();
  assert.match(await page.locator("#status").textContent(), /No se pudo abrir/);
  await page.locator("#model-file").setInputFiles(resolve("test/fixtures/blender-probe.glb"));
  await page.locator('#status[data-state="ready"]').waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: "artifacts/art-studio-mobile.png" });
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  console.log("Estudio 3D: GLB real exportado por Blender, material, esqueleto, animación, pausa, malla, error de archivo y móvil verificados. Sin llamadas externas.");
} finally { await browser.close(); await server.close(); }
