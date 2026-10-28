import { LEGACY } from "./legacy-catalog.js";
import { Hero } from "../legacy/src/entities/Hero.js";
import { Enemy } from "../legacy/src/entities/Enemy.js";
import { Projectile } from "../legacy/src/entities/Projectile.js";
import { ResourceManager } from "../legacy/src/systems/ResourceManager.js";
import { ProgressionManager } from "../legacy/src/systems/ProgressionManager.js";
import { TeamSynergySystem } from "../legacy/src/systems/TeamSynergySystem.js";
import { ObjectPool } from "../legacy/src/utils/ObjectPool.js";
import { RandomSource } from "../legacy/src/utils/Random.js";
import { normalizeHeroLevel } from "../legacy/src/utils/HeroLevel.js";

export const COMBAT_STEP = 1 / 60;

class CombatHero extends Hero {
  syncVisual() {} // Only suppress the Canvas presentation; retain every original kit.
}

function point(value) {
  return { x: value.x, y: value.y };
}

// Sandbox bridge, not a campaign: no purchases, placement permissions, waves or saves.
// All rules, paths, ranges and speeds remain in the original pixel coordinates.
export class LegacyCombat {
  constructor({ seed = 1, path, level = null, teamIds = [], lives = 20, credits = 650 } = {}) {
    if (!Array.isArray(path) || path.length < 2 || path.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y)))
      throw Error("El combate necesita una ruta de al menos dos puntos válidos.");
    if (teamIds.length > 6 || new Set(teamIds).size !== teamIds.length || teamIds.some(id => !LEGACY.heroes[id]))
      throw Error("El equipo admite hasta seis héroes distintos del catálogo.");
    this.path = path.map(point);
    this.currentLevel = structuredClone(level);
    this.terrainMap = structuredClone(level?.terrainMap || []);
    this.gridSize = 40;
    this.heroes = [];
    this.enemies = [];
    this.projectiles = [];
    this.activeTeam = teamIds.map(id => structuredClone(LEGACY.heroes[id]));
    this.enemyDatabase = LEGACY.enemies;
    this.random = new RandomSource(seed);
    this.tick = 0;
    this.remainder = 0;
    this.nextEnemyId = 0;
    this.nextProjectileId = 0;
    this.isGameOver = false;
    this.reduceMotion = false;
    this.events = [];
    this.totals = { defeated: 0, leaked: 0, rewards: 0 };
    this.progression = new ProgressionManager(null);
    this.progression.data = LEGACY;
    this.progression.game = this;
    this.resourceManager = new ResourceManager(this, lives, credits);
    this.teamSynergy = new TeamSynergySystem(this);
    this.projectilePool = new ObjectPool(() => new Projectile(0, 0, null), p => p.deactivate());
    // Events carry detached data; consumers never receive live entity references.
    this.vfx = {
      addBeam: (from, to, options = {}) => this.emit("beam", { from: point(from), to: point(to), options }),
      addBurst: (x, y, options = {}) => this.emit("burst", { x, y, options }),
      addRing: (x, y, options = {}) => this.emit("ring", { x, y, options }),
      addFloatingText: (x, y, text, options = {}) => this.emit("text", { x, y, text, options }),
    };
    this.audio = { play: name => this.emit("sound", { name }) };
    this.uiManager = { showToast: message => this.emit("message", { message }) };
  }

  emit(type, data = {}) {
    this.events.push(structuredClone({ type, tick: this.tick, ...data }));
  }
  drainEvents() { return this.events.splice(0); }
  gameOver() {
    if (!this.isGameOver) { this.isGameOver = true; this.emit("defeat"); }
  }

  addHero(id, { x, y, level = 1, itemId = "" } = {}) {
    if (!LEGACY.heroes[id]) throw Error("Héroe desconocido.");
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw Error("Posición de héroe inválida.");
    if (this.heroes.some(hero => hero.id === id)) throw Error("Ese héroe ya está desplegado en la prueba.");
    if (itemId && !LEGACY.items[itemId]) throw Error("Objeto desconocido.");
    const item = itemId ? structuredClone(LEGACY.items[itemId]) : null;
    this.progression.state.heroUpgrades[id] = { level: normalizeHeroLevel(level) };
    if (item) this.progression.state.equippedItems[id] = { [item.slot || "artifact"]: item.id };
    const config = this.progression.applyHeroLevelStats(structuredClone(LEGACY.heroes[id]));
    const hero = new CombatHero(config, x, y, this);
    hero.items = item ? [item] : [];
    this.heroes.push(hero);
    return hero;
  }

  spawnEnemy(config, source = null) {
    if (typeof config === "string") config = LEGACY.enemies.normal[config] || LEGACY.enemies.bosses[config];
    if (!config) throw Error("Enemigo desconocido.");
    config = structuredClone(config);
    // Preserve visual.size for the original path overshoot, without loading images.
    const enemy = new Enemy({ ...config, sprite: null, visual: config.visual ? { size: config.visual.size } : null }, this.path, this);
    enemy.config = config;
    enemy.visual = config.visual || null;
    enemy.sprite = config.sprite;
    enemy.animator = null;
    enemy.uid = `enemy-${this.nextEnemyId++}`;
    if (source) enemy.copyPathPosition(source, 24);
    this.enemies.push(enemy);
    this.emit("spawn", { id: enemy.uid, kind: config.id, ...point(enemy) });
    return enemy;
  }

  spawnProjectile(x, y, target, config) {
    const projectile = this.projectilePool.acquire(p => p.reset(x, y, target, config));
    projectile.uid = `projectile-${this.nextProjectileId++}`;
    this.projectiles.push(projectile);
    return projectile;
  }

  handleEnemyReachedEnd(enemy) {
    if (enemy.processed) return;
    const isBoss = Boolean(enemy.isBoss || enemy.config.isBoss);
    const lifeLoss = isBoss ? Math.max(1, this.resourceManager.lives) : 1;
    this.resourceManager.removeLife(lifeLoss);
    if (isBoss && !this.isGameOver) this.gameOver();
    enemy.processed = true;
    this.totals.leaked++;
    this.emit("leak", { id: enemy.uid, isBoss, lifeLoss });
  }

  step(ticks = 1) {
    if (!Number.isInteger(ticks) || ticks < 0 || ticks > 36000) throw Error("Cantidad de pasos inválida (0–36000).");
    for (let i = 0; i < ticks && !this.isGameOver; i++) {
      this.tick++;
      // Same ordering and forEach spawn semantics as the pinned original GameLoop.update.
      this.enemies.forEach(enemy => {
        enemy.update(COMBAT_STEP);
        if (enemy.hasReachedEnd && !enemy.processed) this.handleEnemyReachedEnd(enemy);
      });
      this.heroes.forEach(hero => hero.update(COMBAT_STEP, this.enemies, this.projectiles));
      this.projectiles.forEach(projectile => projectile.update(COMBAT_STEP));
      let enemyWriteIndex = 0;
      for (const enemy of this.enemies) {
        if (!enemy.isAlive && !enemy.hasReachedEnd && !enemy.rewarded) {
          const reward = enemy.reward ?? enemy.config.reward ?? 10;
          this.resourceManager.addCredits(reward);
          enemy.rewarded = true;
          this.totals.defeated++;
          this.totals.rewards += reward;
          this.emit("defeated", { id: enemy.uid, reward });
        }
        if (enemy.isAlive && !enemy.hasReachedEnd) this.enemies[enemyWriteIndex++] = enemy;
      }
      this.enemies.length = enemyWriteIndex;
      let projectileWriteIndex = 0;
      for (const projectile of this.projectiles) {
        if (projectile.isActive) this.projectiles[projectileWriteIndex++] = projectile;
        else this.projectilePool.release(projectile);
      }
      this.projectiles.length = projectileWriteIndex;
    }
  }

  advance(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 1) throw Error("Intervalo inválido (0–1 segundo).");
    this.remainder += seconds;
    const ticks = Math.floor((this.remainder + 1e-10) / COMBAT_STEP);
    this.remainder = Math.max(0, this.remainder - ticks * COMBAT_STEP);
    this.step(ticks);
  }

  snapshot() {
    return {
      tick: this.tick, seconds: this.tick * COMBAT_STEP, defeated: this.isGameOver,
      lives: this.resourceManager.lives, credits: this.resourceManager.credits, totals: { ...this.totals },
      heroes: this.heroes.map(h => ({ id: h.id, ...point(h), target: h.lastTargetId,
        stats: { ...h.getEffectiveStats() }, combat: { ...h.combatStats }, stun: h.stunTimer })),
      enemies: this.enemies.map(e => ({ id: e.uid, kind: e.config.id, ...point(e), hp: e.hp, maxHp: e.maxHp,
        distance: e.distanceTravelled, barrier: e.behavior.barrier, phase: e.currentPhase,
        statuses: e.debuffs.map(s => ({ type: s.type, duration: s.duration, power: s.power, stacks: s.stacks })) })),
      projectiles: this.projectiles.map(p => ({ id: p.uid, ...point(p), target: p.target?.uid, color: p.color })),
    };
  }
}

// Presentation-only coordinate conversion. Never use these metres in combat rules.
export function legacyToWorld({ x, y }, pixelsPerMeter = 40) {
  if (!Number.isFinite(pixelsPerMeter) || pixelsPerMeter <= 0) throw Error("Escala de presentación inválida.");
  return { x: x / pixelsPerMeter, y: 0, z: y / pixelsPerMeter };
}

export function runLegacyTrial({ heroId, level = 1, itemId = "", enemyId = Object.keys(LEGACY.enemies.normal)[0], teamIds = [] }) {
  const team = [...new Set([heroId, ...teamIds])].slice(0, 6);
  const combat = new LegacyCombat({ seed: 2026, path: [{ x: 120, y: 120 }, { x: 720, y: 120 }], teamIds: team });
  combat.addHero(heroId, { x: 160, y: 155, level, itemId });
  team.filter(id => id !== heroId).forEach((id, i) => combat.addHero(id, { x: 200 + i * 40, y: 160 }));
  // Six unscaled enemies, spaced by one second. This is a fixed lab scenario, not a wave.
  for (let second = 0; second < 15 && !combat.isGameOver; second++) {
    if (second < 6) combat.spawnEnemy(enemyId);
    combat.step(60);
    combat.drainEvents();
  }
  return combat.snapshot();
}
