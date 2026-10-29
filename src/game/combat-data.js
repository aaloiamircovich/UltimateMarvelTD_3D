import heroes from "../legacy/data/heroes.json" with { type: "json" };
import enemies from "../legacy/data/enemies.json" with { type: "json" };
import items from "../legacy/data/items.json" with { type: "json" };
import levels from "../legacy/data/levels.json" with { type: "json" };
import evolutionVisuals from "../legacy/data/evolutionVisuals.json" with { type: "json" };
import { HEROES as prototypeModels } from "./data.js";
import { normalizeLevelPath } from "../legacy/src/utils/PathUtils.js";

export const SOURCE = { heroes, enemies, items, levels, evolutionVisuals };
export const DEFAULT_TEAM = prototypeModels.map(h => h.id);
export const PIXELS_PER_UNIT = 32;
export const BATTLE_LEVEL = levels[0];
export const WIDTH = 800, HEIGHT = 600;
export const toWorld = ({ x, y }) => ({ x: (x - WIDTH / 2) / PIXELS_PER_UNIT, z: (y - HEIGHT / 2) / PIXELS_PER_UNIT });
export const toRules = ({ x, z }) => ({ x: x * PIXELS_PER_UNIT + WIDTH / 2, y: z * PIXELS_PER_UNIT + HEIGHT / 2 });
export const BATTLE_PATH = normalizeLevelPath(BATTLE_LEVEL, WIDTH, HEIGHT);
const legend = { W: 0, G: 1, S: 11, P: 2, M: 3, B: 5, X: 5 };
export const TERRAIN_MAP = BATTLE_LEVEL.rendering.terrainRows.map(row => [...row].map(key => legend[key] ?? 1));
const colors = { Tecnologico: "#73d8ff", Tecnológico: "#73d8ff", Mistico: "#c99aff", Místico: "#c99aff", Mutante: "#a8e678", Urbano: "#ff6278", Cosmico: "#ffc55b", Cósmico: "#ffc55b" };
// Presentation metadata only. No prototype damage, prices or powers enter combat.
export const HEROES = Object.values(heroes).map(source => {
  const model = prototypeModels.find(h => h.id === source.id);
  return { ...source, color: model?.color || colors[source.category] || "#8ee5f3",
    body: model?.body || colors[source.category] || "#507e9b", accent: model?.accent || "#eff6ff",
    role: source.niche || source.category, description: source.abilityDesc,
    range: source.range / PIXELS_PER_UNIT, interval: 1 / source.fireRate,
    kind: source.special?.supportAura ? "aura" : "projectile", avenger: source.tags?.includes("Avengers"),
    portrait: `${import.meta.env?.BASE_URL || "/"}legacy/${source.visual?.portrait || source.sprite}` };
});
export const HERO_BY_ID = Object.fromEntries(HEROES.map(h => [h.id, h]));
export const ENEMIES = Object.fromEntries([...Object.values(enemies.normal), ...Object.values(enemies.bosses)].map(e => [e.id, {
  ...e, color: colors[e.category] || "#bda6ff", scale: e.isBoss ? 1.1 : 0.65,
}]));
