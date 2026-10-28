import test from "node:test";
import assert from "node:assert/strict";
import { LegacyCombat, runLegacyTrial, legacyToWorld, COMBAT_STEP } from "../src/game/legacy-combat.js";
import { LEGACY } from "../src/game/legacy-catalog.js";
import { Hero } from "../src/legacy/src/entities/Hero.js";
import { Enemy } from "../src/legacy/src/entities/Enemy.js";
import { OriginalCombatLoop } from "./fixtures/original-combat-loop.js";

const path = [{ x: 120, y: 120 }, { x: 1200, y: 120 }];

function scenario(id, reference = false, itemId = "") {
  const game = new LegacyCombat({ path, seed: 927, teamIds: [...new Set([id, "iron_man", "capitan_america"])] });
  for (const [i, heroId] of game.activeTeam.map(h => h.id).entries()) {
    const hero = game.addHero(heroId, { x: 160 + 30 * i, y: 155, level: 50, itemId: i ? "" : itemId });
    if (reference) {
      const original = new Hero(structuredClone(hero.config), hero.x, hero.y, game);
      original.items = structuredClone(hero.items);
      game.heroes[i] = original;
    }
  }
  for (let i = 0; i < 4; i++) {
    const source = { ...LEGACY.enemies.normal.hydra_soldier, hp: 50000, speed: 8 };
    const enemy = game.spawnEnemy(source);
    if (reference) {
      const original = new Enemy(structuredClone(source), game.path, game);
      original.uid = enemy.uid;
      game.enemies[i] = original;
    }
    game.enemies[i].moveForward(i * 25);
  }
  if (reference) {
    game.update = OriginalCombatLoop.prototype.update;
    game.handleEnemyReachedEnd = OriginalCombatLoop.prototype.handleEnemyReachedEnd;
    game.vfx.update = () => {};
    game.uiManager = null;
  }
  game.drainEvents();
  return game;
}

function observable(game) {
  const { totals, ...state } = game.snapshot();
  return state;
}

test("los 105 kits coinciden con entidades y bucle originales en escenarios de 20 segundos", () => {
  for (const id of Object.keys(LEGACY.heroes)) {
    const adapted = scenario(id);
    const reference = scenario(id, true);
    for (let frame = 0; frame < 1200; frame++) {
      adapted.step();
      reference.tick++;
      reference.update(COMBAT_STEP);
      // Include timing, targets, ailments, barriers, damage, aura modifiers and credits.
      if (frame % 60 === 59) assert.deepEqual(observable(adapted), observable(reference), `${id}, segundo ${(frame + 1) / 60}`);
      adapted.drainEvents(); reference.drainEvents();
    }
  }
});

test("objetos, críticos y efectos preservan resultados al cambiar frecuencia de presentación", () => {
  for (const itemId of Object.keys(LEGACY.items)) {
    const a = scenario("spiderman", false, itemId);
    const b = scenario("spiderman", false, itemId);
    for (let i = 0; i < 120; i++) a.advance(1 / 30);
    for (let i = 0; i < 576; i++) b.advance(1 / 144);
    assert.deepEqual(a.snapshot(), b.snapshot(), itemId);
    assert.deepEqual(a.drainEvents(), b.drainEvents(), itemId);
  }
});

test("recompensa única, proyectiles reutilizados y daño con crédito de baja", () => {
  const game = new LegacyCombat({ path, teamIds: ["iron_man"] });
  const hero = game.addHero("iron_man", { x: 160, y: 155 });
  for (let i = 0; i < 5; i++) { game.spawnEnemy("hydra_soldier"); game.step(180); }
  assert.equal(game.totals.defeated, 5);
  assert.equal(game.resourceManager.credits, 650 + 5 * 11);
  assert.equal(hero.combatStats.kills, 5);
  assert.ok(game.projectilePool.getStats().reused > 0);
  game.step(60);
  assert.equal(game.resourceManager.credits, 705);
  assert.equal(game.drainEvents().filter(e => e.type === "defeated").length, 5);
});

test("fuga normal cuesta una vida y fuga de jefe causa derrota inmediata una sola vez", () => {
  const game = new LegacyCombat({ path: [{ x: 0, y: 0 }, { x: 1, y: 0 }] });
  game.spawnEnemy("hydra_soldier"); game.step(10);
  assert.equal(game.resourceManager.lives, 19);
  assert.equal(game.resourceManager.credits, 650);
  game.spawnEnemy("loki"); game.step(10);
  assert.equal(game.resourceManager.lives, 0);
  assert.equal(game.isGameOver, true);
  const tick = game.tick;
  game.step(600);
  assert.equal(game.tick, tick);
  const events = game.drainEvents();
  assert.equal(events.filter(e => e.type === "defeat").length, 1);
  assert.equal(events.filter(e => e.type === "leak").length, 2);
});

test("49 enemigos conservan geometría y comportamiento original sin cargar imágenes ni guardar", () => {
  const before = JSON.stringify(LEGACY);
  const descriptors = ["Image", "localStorage", "document"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  try {
    for (const [key] of descriptors) Object.defineProperty(globalThis, key, { configurable: true, get() { throw Error(`Acceso prohibido: ${key}`); } });
    for (const config of [...Object.values(LEGACY.enemies.normal), ...Object.values(LEGACY.enemies.bosses)]) {
      const game = new LegacyCombat({ path, level: { rendering: { pathMode: "exact", tileSize: 32 } } });
      const enemy = game.spawnEnemy(config);
      assert.equal(enemy.size, config.visualSize || (config.isFinalBoss ? 62 : config.isBoss ? 54 : 30));
      assert.equal(enemy.path.at(-1).x, 1200 + Math.max(12, 24, Math.round((config.visual?.size || config.visualSize || (config.isBoss ? 96 : 30)) * .22)));
      game.step(600);
      assert.ok(Number.isFinite(enemy.hp) && Number.isFinite(enemy.x), config.id);
    }
    for (const id of Object.keys(LEGACY.heroes)) runLegacyTrial({ heroId: id, level: 100 });
  } finally {
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
  assert.equal(JSON.stringify(LEGACY), before);
});

test("eventos y snapshots son datos independientes, coordenadas convertidas sólo al presentar", () => {
  const game = scenario("iron_man");
  const p = game.enemies[0];
  game.vfx.addBeam(game.heroes[0], p, { color: "red" });
  const event = game.drainEvents()[0];
  p.x = 999;
  assert.notEqual(event.to.x, p.x);
  const snapshot = game.snapshot();
  snapshot.heroes[0].combat.kills = 500;
  assert.notEqual(game.heroes[0].combatStats.kills, 500);
  assert.doesNotThrow(() => JSON.stringify(snapshot));
  assert.deepEqual(legacyToWorld({ x: 120, y: 80 }), { x: 3, y: 0, z: 2 });
  assert.equal(game.path[0].x, 120);
  assert.throws(() => game.advance(NaN));
  assert.throws(() => game.step(-1));
  assert.throws(() => legacyToWorld(p, 0));
  assert.throws(() => new LegacyCombat({ path, teamIds: ["iron_man", "iron_man"] }));
  assert.throws(() => game.addHero("iron_man", { x: 0, y: 0 }));
});
