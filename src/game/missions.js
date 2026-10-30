import levels from "../legacy/data/levels.json" with { type: "json" };
import manhattan from "./maps/manhattan.json" with { type: "json" };
import { normalizeLevelPath } from "../legacy/src/utils/PathUtils.js";
import { getFixedDifficultyKey, getLevelUnlockRequirement, isLevelUnlockedByStars } from "../legacy/src/utils/LevelProgression.js";

export const PLAYABLE_MISSIONS = ["level_1", "level_2", "level_3"];
const legend = { W: 0, G: 1, S: 11, P: 2, M: 3, B: 5, X: 5 };
export function missionAccess(id, collection) {
  const index = levels.findIndex(level => level.id === id);
  if (index < 0 || !PLAYABLE_MISSIONS.includes(id)) return "Esta misión todavía no está integrada.";
  const stars = collection?.getTotalStars() ?? 0;
  return isLevelUnlockedByStars(index, stars) ? null : `Requiere ${getLevelUnlockRequirement(index)} estrellas totales. Tenés ${stars}.`;
}
export function missionOptions(collection) {
  return levels.filter(level => PLAYABLE_MISSIONS.includes(level.id)).map(level => ({
    ...level, error: missionAccess(level.id, collection), progress: collection.getMapProgress(level.id),
  }));
}
export function missionEndpoints(mission) {
  const exact = mission.level.rendering?.pathMode === "exact";
  return { start: mission.path[exact ? 0 : 1], end: mission.path.at(exact ? -1 : -2) };
}
export function getMission(id = "level_1") {
  if (!PLAYABLE_MISSIONS.includes(id)) throw Error("Misión no integrada");
  const index = levels.findIndex(level => level.id === id), level = structuredClone(levels[index]);
  const terrain = id === "level_2" ? structuredClone(manhattan.rows)
    : level.rendering.terrainRows.map(row => [...row].map(key => legend[key] ?? 1));
  return { level, index, terrain, path: normalizeLevelPath(level, 800, 600), difficulty: getFixedDifficultyKey(level) };
}
