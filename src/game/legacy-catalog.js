import heroes from "../legacy/data/heroes.json" with { type: "json" };
import items from "../legacy/data/items.json" with { type: "json" };
import enemies from "../legacy/data/enemies.json" with { type: "json" };
import levels from "../legacy/data/levels.json" with { type: "json" };
import evolutionVisuals from "../legacy/data/evolutionVisuals.json" with { type: "json" };
import { Hero } from "../legacy/src/entities/Hero.js";
import { ProgressionManager } from "../legacy/src/systems/ProgressionManager.js";
import { TeamSynergySystem, analyzeTeam, SYNERGY_DEFINITIONS, PAIR_SYNERGIES } from "../legacy/src/systems/TeamSynergySystem.js";
import { EVOLUTION_CATALOG } from "../legacy/src/systems/EvolutionSystem.js";
import { calculateHeroLevelCost, normalizeHeroLevel } from "../legacy/src/utils/HeroLevel.js";
import { getLevelUnlockRequirement, CAMPAIGN_MAX_WAVES } from "../legacy/src/utils/LevelProgression.js";
import { getAllowedTerrainLabels } from "../legacy/src/utils/TerrainRules.js";
import { RandomSource } from "../legacy/src/utils/Random.js";
import { GAME_MODES } from "../legacy/src/systems/GameModeSystem.js";

export const LEGACY = { heroes, items, enemies, levels, evolutionVisuals };
export { SYNERGY_DEFINITIONS, PAIR_SYNERGIES, EVOLUTION_CATALOG, GAME_MODES, CAMPAIGN_MAX_WAVES, getLevelUnlockRequirement, getAllowedTerrainLabels, analyzeTeam };
export const LEGACY_COUNTS = { heroes: Object.keys(heroes).length, items: Object.keys(items).length,
  enemies: Object.keys(enemies.normal).length, bosses: Object.keys(enemies.bosses).length, levels: levels.length };

// Reuse the exact original stat pipeline, without creating any Canvas images.
// This is a preview model; it never mutates the catalogue or either saved profile.
class RulesHero extends Hero {
  syncVisual() {}
}
export function previewLegacyHero(heroId, options = {}) {
  const source = heroes[heroId];
  if (!source) throw Error("Héroe desconocido");
  const level = normalizeHeroLevel(options.level || 1);
  const item = items[options.itemId] || null;
  const teamIds = [...new Set(options.teamIds || [])].filter(id => heroes[id]).slice(0, 6);
  const game = {
    heroes: [], enemies: [], projectiles: [], activeTeam: teamIds.map(id => heroes[id]),
    gridSize: 40, terrainMap: [], random: new RandomSource(1),
    resourceManager: { lives: 20 },
  };
  const progression = new ProgressionManager(null);
  progression.data = LEGACY;
  progression.game = game;
  progression.state.heroUpgrades[heroId] = { level };
  if (item) progression.state.equippedItems[heroId] = { [item.slot || "artifact"]: item.id };
  game.progression = progression;
  game.teamSynergy = new TeamSynergySystem(game);
  const config = progression.applyHeroLevelStats(structuredClone(source));
  const hero = new RulesHero(config, 0, 0, game);
  hero.items = item ? [item] : [];
  game.heroes.push(hero);
  const stats = hero.getEffectiveStats();
  const evolution = progression.getHeroEvolution(heroId);
  return { hero, stats, evolution, level, item, upgradeCost: calculateHeroLevelCost(level),
    support: hero.isSupportAuraOnly(), team: analyzeTeam(game.activeTeam) };
}

export function legacyAsset(path) {
  return path?.startsWith("assets/") ? `${import.meta.env?.BASE_URL || "/"}legacy/${path}` : "";
}

export function findLegacyEntries(section, query = "", rarity = "") {
  const values = section === "heroes" ? Object.values(heroes)
    : section === "items" ? Object.values(items)
    : section === "enemies" ? [...Object.values(enemies.normal), ...Object.values(enemies.bosses)]
    : levels;
  const normalize = value => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const needle = normalize(query.trim());
  return values.filter(entry => (!rarity || entry.rarity === rarity) &&
    normalize([entry.id, entry.name, entry.category, entry.niche, ...(entry.tags || [])].join(" ")).includes(needle));
}
