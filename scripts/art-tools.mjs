import { existsSync, lstatSync } from "node:fs";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { assetId, taskId, taskKind, imageRequest, MeshyClient, modelDownloads, glbDocument } from "./lib/art-pipeline.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env.local");
if (existsSync(envPath)) process.loadEnvFile(envPath);
const work = join(root, "artifacts", "3d");
const [command = "help", ...args] = process.argv.slice(2);
const jobPath = name => join(work, assetId(name), "job.json");
const loadJob = async name => JSON.parse(await readFile(jobPath(name), "utf8"));
const saveJob = async (name, job, exclusive = false) => {
  const path = jobPath(name); await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(job, null, 2), { flag: exclusive ? "wx" : "w" });
};
async function blenderPath() {
  if (process.env.BLENDER_PATH) return process.env.BLENDER_PATH;
  // Store applications must run through their execution alias, not WindowsApps.
  const storeAlias = join(process.env.LOCALAPPDATA || root, "Microsoft", "WindowsApps", "blender-launcher.exe");
  try { lstatSync(storeAlias); return storeAlias; } catch { /* Store alias not installed. */ }
  const base = join(process.env.LOCALAPPDATA || root, "UltimateMarvelTD", "tools");
  const candidates = existsSync(base) ? (await readdir(base)).filter(n => /^blender-4\.5\.\d+-windows-x64$/.test(n)).sort((a, b) => b.localeCompare(a, undefined, { numeric: true })) : [];
  return candidates.length ? join(base, candidates[0], "blender.exe") : "blender";
}
async function runBlender(path, script, parameters = []) {
  const jobs = join(work, "blender-jobs"); await mkdir(jobs, { recursive: true });
  const report = join(jobs, `${randomUUID()}.json`);
  const result = spawnSync(path, ["--background", "--factory-startup", "--python-exit-code", "1", "--python", join(root, "scripts", "blender", "run_job.py"), "--", report, script ? join(root, "scripts", "blender", script) : "probe", ...parameters], { stdio: "inherit", windowsHide: true, timeout: 300000 });
  if (result.error || result.status !== 0) throw Error("No se pudo iniciar Blender. Ver BLENDER_PATH y la instalación de Microsoft Store.");
  // The Store launcher exits before Blender. Verify the script's receipt instead
  // of mistaking the launcher's exit code for a completed export or render.
  const deadline = Date.now() + 300000;
  while (!existsSync(report) && Date.now() < deadline) await delay(250);
  if (!existsSync(report)) throw Error("Blender no confirmó la operación en cinco minutos. Revisar artifacts/3d/blender-jobs.");
  const outcome = JSON.parse(await readFile(report, "utf8"));
  if (!outcome.ok) throw Error(`Falló el script de Blender. Diagnóstico: ${report}`);
  return outcome;
}
async function main() {
  if (command === "doctor") {
    try { const result = await runBlender(await blenderPath(), null); console.log(`Blender ${result.blender}: automatización verificada.`); }
    catch (error) { console.log(`Blender: ${error.message}`); }
    console.log(`Meshy: ${process.env.MESHY_API_KEY ? "clave configurada (todavía no validada)" : "pendiente de MESHY_API_KEY en .env.local"}.`);
    console.log("Referencias: usar una imagen PNG/JPG/WebP. Archivos de trabajo: artifacts/3d (fuera de Git). La clave nunca se envía al navegador.");
    return;
  }
  if (command === "fixture") {
    const output = join(work, "pipeline-fixture"); await mkdir(output, { recursive: true });
    await runBlender(await blenderPath(), "pipeline_fixture.py", ["--output", output]); console.log(`Prueba exportada: ${output}`); return;
  }
  if (command === "inspect") {
    if (!args[0]) throw Error("Uso: npm run art -- inspect ruta/modelo.glb");
    const input = resolve(args[0]); glbDocument(await readFile(input));
    const output = join(work, "reports"); await mkdir(output, { recursive: true });
    await runBlender(await blenderPath(), "inspect_asset.py", ["--input", input, "--output", output]); console.log(`Informe y render: ${output}`); return;
  }
  if (command === "balance") {
    const result = await new MeshyClient(process.env.MESHY_API_KEY).balance();
    console.log(`Créditos Meshy disponibles: ${result.balance}. Consulta gratuita; no se generó un modelo.`); return;
  }
  if (command === "plan") {
    const payload = await imageRequest(resolve(args[0] || ""));
    console.log(JSON.stringify({ ...payload, image_url: "[imagen local; se enviará solamente al ejecutar generate]" }, null, 2)); return;
  }
  if (["generate", "rig"].includes(command)) {
    const name = assetId(args[0]), client = new MeshyClient(process.env.MESHY_API_KEY);
    const kind = command === "generate" ? "image-to-3d" : "rigging";
    const payload = command === "generate" ? await imageRequest(resolve(args[1] || "")) : { input_task_id: taskId(args[1]), height_meters: 1.8 };
    const job = { kind, createdAt: new Date().toISOString(), status: "SUBMITTING" };
    // Reserve the name first. Repeating a command cannot silently buy a second task.
    await saveJob(name, job, true);
    try {
      const result = await client.create(kind, payload); job.id = taskId(result.result); job.status = "PENDING";
      await saveJob(name, job); console.log(`Tarea creada: ${job.id}. Consultar: npm run art -- status ${name}`);
    } catch (error) {
      job.status = "UNKNOWN"; await saveJob(name, job);
      throw Error(`${error.message} No repetir la compra: comprobar el panel de Meshy y usar adopt si hay una tarea creada.`);
    }
    return;
  }
  if (command === "adopt") {
    const [name, kind, id] = args;
    const job = { kind: taskKind(kind), id: taskId(id), status: "ADOPTED", createdAt: new Date().toISOString() };
    const path = jobPath(name);
    if (existsSync(path) && (await loadJob(name)).id) throw Error("Ese nombre ya tiene una tarea. Usar otro nombre.");
    await saveJob(name, job); console.log("ID registrado. Consultar status antes de descargar."); return;
  }
  if (["status", "download"].includes(command)) {
    const name = assetId(args[0]), job = await loadJob(name);
    const task = await new MeshyClient(process.env.MESHY_API_KEY).status(job.kind, job.id);
    job.status = task.status; job.progress = task.progress; await saveJob(name, job);
    console.log(`${task.status} · ${task.progress ?? 0}%`);
    if (command === "download") for (const { name: file, url } of modelDownloads(task, job.kind)) {
      const output = join(work, name, `${file}.glb`);
      if (existsSync(output)) { glbDocument(await readFile(output)); console.log(`Ya descargado: ${output}`); continue; }
      // Download without the API Authorization header, and never print signed URLs.
      const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(120000) });
      if (!response.ok) throw Error(`Falló la descarga HTTP ${response.status}. Volver a consultar status.`);
      const limit = 100 * 1024 * 1024;
      if (Number(response.headers.get("content-length")) > limit) { await response.body.cancel(); throw Error("El GLB supera 100 MB; reducirlo en Meshy antes de descargar."); }
      const chunks = []; let size = 0;
      for await (const chunk of response.body) { size += chunk.length; if (size > limit) throw Error("El GLB supera 100 MB."); chunks.push(chunk); }
      const bytes = Buffer.concat(chunks); glbDocument(bytes);
      await writeFile(output, bytes, { flag: "wx" }); console.log(`Guardado: ${output}`);
    }
    return;
  }
  console.log(`Herramientas 3D (Node, sin credenciales en el juego):
  npm run art -- doctor
  npm run art -- fixture
  npm run art -- inspect ruta/modelo.glb
  npm run art -- balance
  npm run art -- plan ruta/referencia.png
  npm run art -- generate iron-man-v1 ruta/referencia.png   [consume créditos]
  npm run art -- status iron-man-v1
  npm run art -- download iron-man-v1
  npm run art -- rig iron-man-rig-v1 ID_TAREA_MODELO        [consume créditos]
  npm run art -- adopt nombre image-to-3d ID_EXISTENTE
Ver docs/ARTE_3D.md. No hay compras ni generación automática al iniciar el juego.`);
}
main().catch(error => { console.error(`No se pudo completar: ${error.code === "EEXIST" ? "El nombre ya está reservado; usar status/adopt para reanudar, sin repetir la compra." : error.message}`); process.exitCode = 1; });
