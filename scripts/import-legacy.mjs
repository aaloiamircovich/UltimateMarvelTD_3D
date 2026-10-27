import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync, unlinkSync } from "node:fs";
import { dirname, resolve, posix } from "node:path";
import { createHash } from "node:crypto";

// Read committed blobs, never the source working tree (which may contain unfinished work).
const source = process.argv[2];
const revision = process.argv[3] || "84797a5a0c0f344145a7b3442b02e46f13ebdb8b";
if (!source) throw Error("Uso: node scripts/import-legacy.mjs <repositorio-2D-local> [commit]");
const git = args => execFileSync("git", ["-C", resolve(source), ...args], { maxBuffer: 300 * 1024 * 1024 });
const commit = git(["rev-parse", `${revision}^{commit}`]).toString().trim();
const tree = git(["ls-tree", "-r", "-z", commit]).toString().split("\0").filter(Boolean);
const blobs = new Map(tree.map(row => { const [meta, path] = row.split("\t"); return [path, meta.split(" ")[2]]; }));
const cache = new Map();
function read(path) {
  if (!blobs.has(path)) throw Error(`No existe en ${commit}: ${path}`);
  if (!cache.has(path)) cache.set(path, git(["cat-file", "blob", blobs.get(path)]));
  return cache.get(path);
}
const selected = new Set();
function include(path) {
  if (selected.has(path)) return;
  selected.add(path);
  const content = read(path).toString();
  if (!path.endsWith(".js")) return;
  for (const match of content.matchAll(/(?:from\s+|import\s*)['"]([^'"]+)['"]/g)) {
    if (!match[1].startsWith(".")) continue;
    include(posix.normalize(posix.join(posix.dirname(path), match[1])));
  }
}
for (const path of [
  "src/entities/Hero.js", "src/entities/Enemy.js", "src/systems/WaveManager.js",
  "src/systems/ProgressionManager.js", "src/systems/GameModeSystem.js", "src/systems/MissionSystem.js",
  "src/systems/ResourceManager.js", "src/systems/ShopSystem.js", "src/systems/ReplaySystem.js",
  "src/systems/VillainCodexSystem.js", "src/systems/TacticalActionSystem.js",
  "src/utils/StarterSelection.js", "src/utils/TargetingPriority.js", "src/utils/ObjectPool.js",
  "src/utils/TerrainRules.js",
]) include(path);
const dataFiles = ["heroes", "enemies", "items", "levels", "waves", "evolutionVisuals"];
for (const name of dataFiles) include(`data/${name}.json`);
if (blobs.has("NOTICE.md")) include("NOTICE.md");
include("docs/MATRIZ_IDENTIDAD_HEROES.md");
const excludedTests = ["audio-manager", "core-hero-visuals", "evolution-visual-assets", "new-hero-additions", "rivals-roster"];

// Carry the original behavioral tests with their imports intact. UI/browser and
// repository-layout tests belong to the old frontend, not the portable kernel.
for (const path of blobs.keys()) {
  if (!path.startsWith("test/") || !path.endsWith(".test.js")) continue;
  if (excludedTests.some(name => path === `test/${name}.test.js`)) continue;
  const content = read(path).toString();
  const deps = [...content.matchAll(/from\s+['"](\.[^'"]+)['"]/g)]
    .map(m => posix.normalize(posix.join("test", m[1])));
  if (!deps.length || deps.some(d => !selected.has(d))) continue;
  if (/execFile|spawnSync|playwright|fetch\(/.test(content)) continue;
  selected.add(path);
}

// Portraits, item icons and map thumbnails are directly reused by the new codex.
// Preserve the other sprite paths in the data; their 3D renderer adaptation is tracked separately.
const assets = new Set();
const heroes = JSON.parse(read("data/heroes.json"));
const enemies = JSON.parse(read("data/enemies.json"));
const items = JSON.parse(read("data/items.json"));
const levels = JSON.parse(read("data/levels.json"));
const addAsset = path => { if (path?.startsWith("assets/") && blobs.has(path)) assets.add(path); };
for (const hero of Object.values(heroes)) addAsset(hero.visual?.portrait || hero.sprite);
for (const evolution of Object.values(JSON.parse(read("data/evolutionVisuals.json")))) addAsset(evolution.visual?.portrait || evolution.sprite);
for (const item of Object.values(items)) addAsset(item.icon);
for (const group of Object.values(enemies)) for (const enemy of Object.values(group)) addAsset(enemy.sprite);
for (const level of levels) addAsset(level.thumbnail);
const target = resolve("src/legacy");
const manifestPath = resolve("src/legacy/manifest.json");
const previous = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : null;
if (previous && previous.commit !== commit) throw Error("Revisar una actualización de origen por separado antes de reemplazar el snapshot.");
for (const file of previous?.files || []) {
  if (existsSync(file.local) && createHash("sha256").update(readFileSync(file.local)).digest("hex") !== file.sha256)
    throw Error(`El archivo importado tiene cambios locales: ${file.local}. Usar un adaptador fuera del snapshot.`);
}
for (const file of previous?.files || []) {
  if (selected.has(file.source) || assets.has(file.source)) continue;
  const local = resolve(file.local);
  if (!local.startsWith(target + "/") && !local.startsWith(target + "\\")) throw Error("Ruta generada fuera de destino");
  if (existsSync(local)) {
    if (createHash("sha256").update(readFileSync(local)).digest("hex") !== file.sha256) throw Error(`Cambio local en ${file.local}`);
    unlinkSync(local);
  }
}
const files = [];
for (const path of [...selected, ...assets].sort()) {
  const bytes = read(path);
  const local = assets.has(path) ? `public/legacy/${path}` : `src/legacy/${path}`;
  mkdirSync(dirname(resolve(local)), { recursive: true });
  writeFileSync(resolve(local), bytes);
  files.push({ source: path, local, sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length });
}
const manifest = {
  repository: "https://github.com/aaloiamircovich/TowerDefense_Marvel", commit,
  scope: "Datos completos, núcleo de reglas y pruebas reutilizables, retratos, iconos y miniaturas. No equivale a paridad jugable 3D.",
  excludedTests: { reason: "Validan atlas, audio y sprites del renderizador 2D no incorporados a esta fase.", files: excludedTests },
  counts: { heroes: Object.keys(heroes).length, items: Object.keys(items).length,
    enemies: Object.keys(enemies.normal).length, bosses: Object.keys(enemies.bosses).length,
    levels: levels.length, modules: [...selected].filter(p => p.startsWith("src/")).length,
    tests: [...selected].filter(p => p.startsWith("test/")).length, assets: assets.size },
  files,
};
mkdirSync(target, { recursive: true });
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify({ commit, ...manifest.counts, bytes: files.reduce((s, f) => s + f.bytes, 0) }, null, 2));
