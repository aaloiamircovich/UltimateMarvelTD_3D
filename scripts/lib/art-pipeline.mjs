import { readFile, stat } from "node:fs/promises";
import { extname } from "node:path";

export function assetId(value) {
  if (!/^[a-z][a-z0-9_-]{0,63}$/.test(value || "")) throw Error("Usar un nombre como iron-man-v1 (sin rutas ni espacios).");
  return value;
}
export function taskId(value) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(value || "")) throw Error("ID de tarea inválido.");
  return value;
}
export function taskKind(value) {
  if (!["image-to-3d", "rigging"].includes(value)) throw Error("Tipo de tarea no soportado.");
  return value;
}
export async function imageRequest(path) {
  const mime = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" }[extname(path).toLowerCase()];
  if (!mime) throw Error("La referencia debe ser PNG, JPG o WebP.");
  const info = await stat(path);
  if (!info.isFile() || !info.size || info.size > 20 * 1024 * 1024) throw Error("La referencia debe pesar entre 1 byte y 20 MB.");
  const bytes = await readFile(path);
  return { image_url: `data:${mime};base64,${bytes.toString("base64")}`, ai_model: "meshy-7.1",
    should_texture: true, enable_pbr: true, should_remesh: true,
    topology: "triangle", target_polycount: 3000, pose_mode: "a-pose", target_formats: ["glb"] };
}
export class MeshyClient {
  constructor(key, fetcher = fetch) {
    if (!key || key.trim() === "TU_CLAVE") throw Error("Falta MESHY_API_KEY en .env.local. Ver docs/ARTE_3D.md.");
    this.key = key.trim(); this.fetcher = fetcher;
  }
  async request(path, body) {
    let response;
    try {
      response = await this.fetcher(`https://api.meshy.ai/openapi/v1/${path}`, {
        method: body ? "POST" : "GET", redirect: "error", signal: AbortSignal.timeout(60000),
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch { throw Error("No se pudo completar la conexión con Meshy. No se reintentó la solicitud."); }
    if (!response.ok) {
      const reasons = { 401: "Clave inválida", 402: "Revisar plan y créditos de la cuenta", 403: "Acceso denegado", 429: "Límite de solicitudes; esperar antes de consultar otra vez" };
      // Never echo provider bodies: they may contain input images, keys or signed URLs.
      throw Error(`Meshy HTTP ${response.status}: ${reasons[response.status] || "Solicitud rechazada; revisar el panel de Meshy"}.`);
    }
    return response.json();
  }
  balance() { return this.request("balance"); }
  create(kind, payload) { return this.request(taskKind(kind), payload); }
  status(kind, id) { return this.request(`${taskKind(kind)}/${taskId(id)}`); }
}
export function modelDownloads(task, kind) {
  taskKind(kind);
  if (task.status !== "SUCCEEDED") throw Error(`La tarea todavía no está lista: ${task.status}.`);
  const result = kind === "image-to-3d" ? { model: task.model_urls?.glb } : {
    model: task.result?.rigged_character_glb_url,
    walk: task.result?.basic_animations?.walking_glb_url,
    run: task.result?.basic_animations?.running_glb_url,
  };
  if (!result.model) throw Error("Meshy no devolvió el GLB esperado.");
  return Object.entries(result).filter(([, url]) => url).map(([name, url]) => {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || !(parsed.hostname === "assets.meshy.ai" || parsed.hostname.endsWith(".assets.meshy.ai"))) {
      throw Error("Origen de descarga no reconocido. Revisar el resultado en Meshy.");
    }
    return { name, url };
  });
}
export function glbDocument(bytes) {
  if (bytes.length < 20 || bytes.toString("ascii", 0, 4) !== "glTF" || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw Error("Archivo GLB inválido o incompleto.");
  const jsonLength = bytes.readUInt32LE(12);
  if (bytes.readUInt32LE(16) !== 0x4e4f534a || 20 + jsonLength > bytes.length) throw Error("Cabecera GLB inválida.");
  const document = JSON.parse(bytes.toString("utf8", 20, 20 + jsonLength));
  if ([...(document.buffers || []), ...(document.images || [])].some(resource => resource.uri && !resource.uri.startsWith("data:"))) throw Error("El GLB debe tener todos los recursos embebidos.");
  return document;
}
