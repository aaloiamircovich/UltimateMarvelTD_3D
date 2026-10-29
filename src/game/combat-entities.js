import { Hero } from "../legacy/src/entities/Hero.js";
import { Enemy } from "../legacy/src/entities/Enemy.js";

// Shared by the numeric laboratory and the playable mission. Suppress only
// Canvas presentation; the inherited entities retain all original combat rules.
export class CombatHero extends Hero {
  syncVisual() {}
}

export function createCombatEnemy(config, path, game) {
  // visual.size participates in path overshoot, so retain it during construction.
  const enemy = new Enemy({ ...config, sprite: null, visual: config.visual ? { size: config.visual.size } : null }, path, game);
  enemy.config = config;
  enemy.visual = config.visual || null;
  enemy.sprite = config.sprite;
  enemy.animator = null;
  return enemy;
}
