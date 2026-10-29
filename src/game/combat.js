import { CombatHero, createCombatEnemy } from "./combat-entities.js";
export { CombatHero, createCombatEnemy } from "./combat-entities.js";
import { Projectile } from "../legacy/src/entities/Projectile.js";
import { WaveManager } from "../legacy/src/systems/WaveManager.js";
import { ResourceManager } from "../legacy/src/systems/ResourceManager.js";
import { ProgressionManager } from "../legacy/src/systems/ProgressionManager.js";
import { MissionSystem } from "../legacy/src/systems/MissionSystem.js";
import { GameModeSystem } from "../legacy/src/systems/GameModeSystem.js";
import { TeamSynergySystem } from "../legacy/src/systems/TeamSynergySystem.js";
import { TacticalActionSystem } from "../legacy/src/systems/TacticalActionSystem.js";
import { RandomSource } from "../legacy/src/utils/Random.js";
import { ObjectPool } from "../legacy/src/utils/ObjectPool.js";
import { calculateHeroLevelCost } from "../legacy/src/utils/HeroLevel.js";
import { getNextTargetingPriority } from "../legacy/src/utils/TargetingPriority.js";
import { canPlaceOnTerrain, getTerrainLabel, getAllowedTerrainLabels } from "../legacy/src/utils/TerrainRules.js";
import { isPointInRangePattern } from "../legacy/src/utils/RangePattern.js";
import { SOURCE, DEFAULT_TEAM, BATTLE_LEVEL, BATTLE_PATH, TERRAIN_MAP, PIXELS_PER_UNIT, toWorld, toRules } from "./combat-data.js";

export const STEP = 1 / 60;
// Original coordinates, seconds and classes stay inside core. Three.js consumes
// read-only projections; moving a mesh can never change an attack or its target.
export class CombatGame {
  constructor(mode = "story", { seed = 12345, teamIds = DEFAULT_TEAM, collection = null } = {}) {
    this.mode = mode;
    this.seed = seed;
    this.teamIds = [...teamIds];
    this.collection = collection;
    this.reset();
  }
  reset() {
    if (this.collection) this.teamIds = [...this.collection.state.activeTeamIds];
    this.events = []; this.time = 0; this.accumulator = 0; this.wave = 0; this.kills = 0;
    this.phase = "preparing"; this.paused = false; this.speed = 1; this.auto = false; this.betweenTimer = 1.6;
    this.nextId = 1; this.units = []; this.enemies = []; this.projectiles = [];
    const data = structuredClone(SOURCE);
    const c = this.core = {
      heroes: [], enemies: [], projectiles: [], path: structuredClone(BATTLE_PATH),
      currentLevel: structuredClone(BATTLE_LEVEL), gridSize: BATTLE_LEVEL.rendering.tileSize,
      terrainMap: TERRAIN_MAP.map(row => [...row]), currentLevelIndex: 0, difficulty: "normal",
      activeTeam: this.teamIds.map(id => data.heroes[id]).filter(Boolean),
      heroDatabase: data.heroes, enemyDatabase: data.enemies, levelsData: data.levels,
      completedWaves: [], stars: 0, isGameOver: false, random: new RandomSource(this.seed),
      pause: () => { this.paused = true; }, gameOver: () => this.end("defeat"),
      spawnEnemy: (config, source) => this.spawnEnemy(config, source),
      spawnProjectile: (x, y, target, config) => this.spawnProjectile(x, y, target, config),
    };
    c.progression = this.collection || new ProgressionManager(null);
    c.resourceManager = new ResourceManager(c, 20, 650);
    if (this.collection) this.collection.attach(c, data);
    else {
      c.progression.data = data; c.progression.game = c;
      c.progression.state.unlockedHeroIds = [...this.teamIds];
      c.progression.state.activeTeamIds = [...this.teamIds];
      c.progression.state.credits = this.mode === "infinite" ? 750 : 650;
    }
    c.teamSynergy = new TeamSynergySystem(c);
    c.tacticalActions = new TacticalActionSystem(c);
    c.projectilePool = new ObjectPool(() => new Projectile(0, 0, null), p => p.deactivate(), 768);
    const ring = (x, y, options = {}) => this.events.push({ type: "impact", ...toWorld({ x, y }), radius: (options.radius || 20) / PIXELS_PER_UNIT, ...options, worldRadius: (options.radius || 20) / PIXELS_PER_UNIT });
    c.vfx = {
      addRing: ring, addBurst: ring,
      addBeam: (from, to, options = {}) => this.events.push({ type: "attack", from: toWorld(from), to: toWorld(to), ...options }),
      addFloatingText: (x, y, value, options = {}) => this.events.push({ type: "text", ...toWorld({ x, y }), value, color: options.color }),
    };
    c.uiManager = {
      showToast: message => this.events.push({ type: "notice", message }),
      showVictory: () => this.end("victory"),
      renderWavePreview() {}, setNextWaveEnabled() {}, updateModeStatus() {}, updateMissionStatus() {},
    };
    c.modeSystem = new GameModeSystem(c, c.progression);
    if (this.mode === "infinite") c.modeSystem.modeId = "survival";
    c.missionSystem = new MissionSystem(c);
    c.missionSystem.loadLevel(c.currentLevel);
    c.waveManager = new WaveManager(c, data.enemies);
    c.modeSystem.configureRun();
    this.syncViews();
  }
  get cash() { return this.core.resourceManager.credits; }
  get health() { return this.core.resourceManager.lives; }
  get maxHealth() { return this.core.resourceManager.maxLives; }
  get maxWaves() { return this.core.waveManager.maxWaves; }
  get spawnQueue() { return this.core.waveManager.enemiesQueue; }
  get synergy() { return this.core.teamSynergy.getSnapshot(); }
  get completed() { return this.core.completedWaves.length; }
  cell(point) {
    const p = toRules(point), size = this.core.gridSize;
    return { x: Math.floor(p.x / size) * size + size / 2, y: Math.floor(p.y / size) * size + size / 2 };
  }
  snap(point) { return toWorld(this.cell(point)); }
  preview(heroId, point = { x: 0, z: 0 }) {
    const c = this.core, config = c.heroDatabase[heroId];
    if (!config) return null;
    const p = this.cell(point);
    const hero = new CombatHero(c.progression.applyHeroLevelStats(structuredClone(config)), p.x, p.y, c);
    c.progression.applyHeroTargetingPriority(hero);
    c.progression.applyEquippedItem(hero);
    return hero;
  }
  placementError(heroId, x, z, movingId = null) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return "Fuera del mapa";
    if (!["preparing", "combat"].includes(this.phase)) return "La misión ya terminó";
    if (!this.teamIds.includes(heroId)) return "Ese héroe no está en tu escuadrón";
    const c = this.core, p = this.cell({ x, z });
    const terrain = c.terrainMap[Math.floor(p.y / c.gridSize)]?.[Math.floor(p.x / c.gridSize)];
    if (terrain === undefined) return "Fuera del mapa";
    const hero = this.preview(heroId, { x, z }), stats = hero.getEffectiveStats();
    if (!canPlaceOnTerrain(hero, terrain)) return `Requiere ${getAllowedTerrainLabels(hero.allowedTerrains)}; esta celda es ${getTerrainLabel(terrain)}`;
    if (!movingId && c.heroes.some(h => h.id === heroId)) return "Este héroe ya está desplegado";
    if (c.heroes.some(h => h.uid !== movingId && Math.hypot(h.x - p.x, h.y - p.y) < c.gridSize * 0.8)) return "Este espacio ya está ocupado";
    let closest = null, distance = Infinity;
    for (let i = 1; i < c.path.length; i++) {
      const a = c.path[i - 1], b = c.path[i], dx = b.x - a.x, dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
      const q = { x: a.x + t * dx, y: a.y + t * dy }, d = Math.hypot(p.x - q.x, p.y - q.y);
      if (d < distance) { closest = q; distance = d; }
    }
    if (!isPointInRangePattern(p, closest, stats.range, hero.rangePattern, stats.rangeGeometryScale)) return "El camino está fuera del alcance de este héroe";
    return null;
  }
  deploy(heroId, x, z) {
    const error = this.placementError(heroId, x, z);
    if (error) return { error };
    const hero = this.preview(heroId, { x, z });
    hero.uid = this.nextId++;
    this.core.heroes.push(hero);
    this.events.push({ type: "deploy", ...toWorld(hero), color: "#8ee5f3" });
    this.syncViews();
    return { unit: this.units.find(u => u.id === hero.uid) };
  }
  move(id, x, z) {
    const hero = this.core.heroes.find(h => h.uid === id);
    if (!hero) return { error: "Héroe no disponible" };
    const error = this.placementError(hero.id, x, z, id);
    if (error) return { error };
    Object.assign(hero, this.cell({ x, z }));
    this.core.tacticalActions.markRepositioned(hero);
    this.syncViews();
    return { unit: this.units.find(u => u.id === id) };
  }
  stats(unit) {
    const hero = this.core.heroes.find(h => h.uid === unit.id);
    if (!hero) return null;
    const s = hero.getEffectiveStats(), cost = calculateHeroLevelCost(hero.level);
    return { damage: Math.round(s.damage * 10) / 10, range: s.range / PIXELS_PER_UNIT, interval: 1 / s.fireRate,
      upgradeCost: Number.isFinite(cost) ? cost : null, sellValue: 0, support: hero.isSupportAuraOnly(),
      pattern: hero.rangePattern, geometryScale: s.rangeGeometryScale || 1, critChance: s.critChance,
      name: this.core.progression.getHeroEvolution(hero.id)?.name || hero.name };
  }
  upgrade(id) {
    if (!["combat", "preparing"].includes(this.phase)) return false;
    const hero = this.core.heroes.find(h => h.uid === id);
    if (!hero) return false;
    const purchase = () => {
      if (!this.core.resourceManager.removeCredits(calculateHeroLevelCost(hero.level))) return false;
      this.core.progression.setHeroLevel(hero.id, hero.level + 1, { save: true, sync: false });
      return true;
    };
    if (!(this.collection ? this.collection.transaction(purchase) : purchase())) return false;
    this.core.progression.applyHeroLevelStats(hero);
    this.events.push({ type: "upgrade", ...toWorld(hero), color: "#8ee5f3" });
    this.syncViews(); return true;
  }
  sell(id) {
    if (!["combat", "preparing"].includes(this.phase)) return false;
    const hero = this.core.heroes.find(h => h.uid === id);
    const result = this.core.tacticalActions.sell(hero);
    this.syncViews(); return result.ok;
  }
  cyclePriority(id) {
    const h = this.core.heroes.find(h => h.uid === id);
    if (h) this.core.progression.setHeroTargetingPriority(h.id, getNextTargetingPriority(h.targetingPriority));
    this.syncViews();
  }
  spawnEnemy(config, source = null) {
    const enemy = createCombatEnemy(config, this.core.path, this.core);
    if (source) enemy.copyPathPosition(source, 24);
    enemy.viewId = this.nextId++;
    this.core.enemies.push(enemy);
    if (enemy.isBoss) this.events.push({ type: "boss", name: enemy.name });
    return enemy;
  }
  spawnProjectile(x, y, target, config) {
    const p = this.core.projectilePool.acquire(p => p.reset(x, y, target, config));
    p.viewId = this.nextId++;
    this.core.projectiles.push(p);
    if (config.attacker) config.attacker.angle = Math.atan2(target.x - x, target.y - y);
    return p;
  }
  startWave() {
    if (this.phase !== "preparing" || this.paused) return false;
    const wm = this.core.waveManager;
    wm.prepareNextWave();
    wm.startNextWave();
    this.wave = wm.currentWave; this.phase = "combat";
    this.events.push({ type: "wave", wave: this.wave });
    return true;
  }
  end(result) {
    if (["victory", "defeat"].includes(this.phase)) return;
    this.phase = result; this.core.isGameOver = true;
    this.core.modeSystem.finishRun(result);
    this.core.progression.recordMissionSummary(this.core, result);
    this.events.push({ type: "end" });
  }
  update(dt) {
    if (this.paused || !["combat", "preparing"].includes(this.phase) || !Number.isFinite(dt) || dt <= 0) return;
    this.accumulator += Math.min(dt, 0.25) * this.speed;
    while (this.accumulator + 1e-10 >= STEP) {
      this.accumulator -= STEP;
      this.step(STEP);
      if (this.core.isGameOver) { this.accumulator = 0; break; }
    }
    this.syncViews();
  }
  step(dt) {
    this.time += dt;
    if (this.phase === "preparing") {
      if (this.auto && this.wave > 0 && (this.betweenTimer -= dt) <= 0) this.startWave();
    }
    const c = this.core, wm = c.waveManager, previousWave = wm.currentWave;
    wm.update(dt);
    if (wm.currentWave !== previousWave) {
      this.events.push({ type: "clear", wave: previousWave, bonus: wm.getWaveBounty(previousWave) });
      this.betweenTimer = 1.6;
      if (!c.isGameOver) this.phase = "preparing";
    }
    c.missionSystem.update(dt); c.modeSystem.update(dt);
    c.enemies.forEach(enemy => {
      const x = enemy.x, y = enemy.y;
      enemy.update(dt);
      if (x !== enemy.x || y !== enemy.y) enemy.angle = Math.atan2(enemy.x - x, enemy.y - y);
      if (enemy.hasReachedEnd && !enemy.processed) {
        const loss = enemy.isBoss ? c.resourceManager.lives : 1;
        if (!enemy.isBoss) c.missionSystem.handleLeak(enemy);
        wm.recordLeak(enemy, { lifeLoss: loss });
        c.resourceManager.removeLife(loss); enemy.processed = true;
        this.events.push({ type: "leak" });
      }
    });
    c.heroes.forEach(h => h.update(dt, c.enemies, c.projectiles));
    c.projectiles.forEach(p => p.update(dt));
    c.enemies = c.enemies.filter(enemy => {
      if (!enemy.isAlive && !enemy.hasReachedEnd && !enemy.rewarded) {
        c.resourceManager.addCredits(enemy.reward ?? 10);
        c.missionSystem.onEnemyDefeated(enemy); enemy.rewarded = true; this.kills++;
        this.events.push({ type: "kill", ...toWorld(enemy), color: "#ffd166" });
      }
      return enemy.isAlive && !enemy.hasReachedEnd;
    });
    c.projectiles = c.projectiles.filter(p => { if (p.isActive) return true; c.projectilePool.release(p); return false; });
  }
  syncViews() {
    this.units = this.core.heroes.map(h => ({ id: h.uid, heroId: h.id, ...toWorld(h), level: h.level,
      damageDealt: h.combatStats.damageDealt, priority: h.targetingPriority, angle: h.angle || 0,
      stunned: h.stunTimer > 0, pattern: h.rangePattern }));
    this.enemies = this.core.enemies.filter(e => e.isAlive && !e.hasReachedEnd).map(e => ({ id: e.viewId,
      kind: e.config.id, ...toWorld(e), hp: e.hp, maxHp: e.maxHp, speed: e.speed / PIXELS_PER_UNIT,
      angle: e.angle || 0, isBoss: e.isBoss, name: e.name, flying: e.flying, stealth: e.stealth,
      barrier: e.behavior.barrier, debuffs: e.debuffs.map(d => d.type), telegraph: e.telegraph }));
    this.projectiles = this.core.projectiles.filter(p => p.isActive).map(p => ({ id: p.viewId, ...toWorld(p), color: p.color, style: p.visualStyle }));
  }
  drainEvents() { return this.events.splice(0); }
  wavePreview() {
    const wm = this.core.waveManager;
    return { wave: wm.currentWave, entries: wm.preparedQueue, bonus: wm.getWaveBounty(), modifier: wm.waveModifier.label };
  }
}
