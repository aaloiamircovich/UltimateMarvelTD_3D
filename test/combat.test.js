import test from "node:test";
import assert from "node:assert/strict";
import { CombatGame, CombatHero, STEP } from "../src/game/combat.js";
import { SOURCE, DEFAULT_TEAM, BATTLE_PATH, toWorld, toRules } from "../src/game/combat-data.js";
import { Hero } from "../src/legacy/src/entities/Hero.js";
import { Enemy } from "../src/legacy/src/entities/Enemy.js";
import { loadProfile, saveProfile } from "../src/game/profile.js";

const spot = (x, y) => toWorld({ x: x * 32 + 16, y: y * 32 + 16 });
const deploy = (g, id, x, y) => { const p = spot(x, y), result = g.deploy(id, p.x, p.z); assert.equal(result.error, undefined); return result.unit; };
const advance = (g, n) => { for (let i = 0; i < n; i++) { g.update(STEP); g.drainEvents(); } };

test("combat uses original free unique placement, terrain, level costs and withdrawal", () => {
  const g = new CombatGame(), before = g.cash;
  const iron = deploy(g, "iron_man", 8, 5);
  assert.equal(g.cash, before);
  assert.match(g.deploy("iron_man", ...Object.values(spot(8, 6))).error, /desplegado/);
  assert.match(g.placementError("hulk", ...Object.values(spot(0, 0))), /Agua/);
  assert.match(g.placementError("hulk", ...Object.values(spot(6, 6))), /Camino/);
  assert.equal(g.upgrade(iron.id), true);
  assert.equal(g.cash, before - 180);
  assert.equal(g.units[0].level, 2);
  assert.equal(g.core.heroes[0].damage, 50); // floor(45 * (1 + 1.8 / 14))
  const p = spot(8, 7); assert.ok(g.move(iron.id, p.x, p.z).unit);
  assert.equal(g.units[0].z, p.z);
  const priorities = new Set();
  for (let i = 0; i < 7; i++) { priorities.add(g.units[0].priority); g.cyclePriority(iron.id); }
  assert.equal(priorities.size, 7);
  const credits = g.cash; assert.equal(g.sell(iron.id), true); assert.equal(g.cash, credits);
  assert.equal(deploy(g, "iron_man", 8, 5).level, 2);
  assert.deepEqual(toRules(toWorld({ x: 208, y: 112 })), { x: 208, y: 112 });
});

test("all 105 original heroes deploy and run headlessly without mutating source data", () => {
  const before = JSON.stringify(SOURCE), oldImage = globalThis.Image;
  globalThis.Image = class { constructor() { throw Error("Combat must not allocate DOM images"); } };
  try {
    for (const id of Object.keys(SOURCE.heroes)) {
      const g = new CombatGame("story", { teamIds: [id] }); let position;
      for (let y = 0; y < 19 && !position; y++) for (let x = 0; x < 25 && !position; x++) {
        const p = spot(x, y); if (!g.placementError(id, p.x, p.z)) position = p;
      }
      assert.ok(position, `${id} has a compatible cell`);
      assert.ok(g.deploy(id, position.x, position.z).unit);
      g.startWave(); advance(g, 1800);
      assert.ok(Number.isFinite(g.cash), id);
      assert.ok(Number.isFinite(g.core.heroes[0].combatStats.damageDealt), id);
    }
  } finally { if (oldImage === undefined) delete globalThis.Image; else globalThis.Image = oldImage; }
  assert.equal(JSON.stringify(SOURCE), before);
});

// Reference runner uses the unmodified 2D classes and GameLoop's published order.
// It bypasses the adapter's step(), coordinate views, pooling and image suppression.
function referenceTick(c) {
  c.enemies.forEach(e => e.update(STEP));
  c.heroes.forEach(h => h.update(STEP, c.enemies, c.projectiles));
  c.projectiles.forEach(p => p.update(STEP));
  c.enemies = c.enemies.filter(e => {
    if (!e.isAlive && !e.hasReachedEnd && !e.rewarded) { c.resourceManager.addCredits(e.reward ?? 10); c.missionSystem.onEnemyDefeated(e); e.rewarded = true; }
    return e.isAlive && !e.hasReachedEnd;
  });
  c.projectiles = c.projectiles.filter(p => p.isActive);
}
function setupEncounter(id, level, itemId, reference) {
  const g = new CombatGame("story", { seed: 4201, teamIds: [id, "capitan_america", "iron_man"].filter((x,i,a) => a.indexOf(x)===i) }), c = g.core;
  c.progression.setHeroLevel(id, level, { save: false, sync: false });
  if (itemId) c.progression.state.equippedItems[id] = { [SOURCE.items[itemId].slot]: itemId };
  const config = c.progression.applyHeroLevelStats(structuredClone(SOURCE.heroes[id]));
  const h = reference ? new Hero(config, 300, 270, c) : new CombatHero(config, 300, 270, c);
  h.uid = 1; c.progression.applyEquippedItem(h); c.heroes.push(h);
  // A long, stationary route keeps every range pattern under observation.
  c.path = [{ x: 400, y: 270 }, { x: 740, y: 270 }];
  for (let i = 0; i < 5; i++) {
    const config = { ...SOURCE.enemies.normal.hydra_soldier, hp: 20000, speed: 1, armor: .25, barrierRatio: .1, sprite: null, visual: null };
    const e = reference ? new Enemy(config, c.path, c) : g.spawnEnemy(config);
    if (reference) c.enemies.push(e);
    e.x += i * 8; e.uid = `victim-${i}`;
  }
  c.waveManager.isWaveActive = true; c.waveManager.enemiesQueue = []; g.phase = "combat"; g.wave = 1;
  return g;
}
const snapshot = g => ({ cash: g.cash, hero: g.core.heroes[0].combatStats,
  enemies: g.core.enemies.map(e => ({ hp: e.hp, x: e.x, y: e.y, barrier: e.behavior.barrier,
    effects: e.debuffs.map(d => [d.type, d.duration, d.power, d.stacks]) })),
  projectiles: g.core.projectiles.map(p => [p.x, p.y, p.damage, p.phase]) });

test("all original kits match the 2D reference timeline at levels 1 and 50", () => {
  for (const id of Object.keys(SOURCE.heroes)) for (const level of [1, 50]) {
    const bridged = setupEncounter(id, level, null, false), reference = setupEncounter(id, level, null, true);
    for (let i = 0; i < 720; i++) {
      bridged.step(STEP); referenceTick(reference.core);
      bridged.drainEvents(); reference.drainEvents();
    }
    assert.deepEqual(snapshot(bridged), snapshot(reference), `${id} level ${level}`);
  }
});

test("all 82 equipped items retain original combat effects and signatures", () => {
  for (const itemId of Object.keys(SOURCE.items)) {
    const bridged = setupEncounter("spiderman", 50, itemId, false), reference = setupEncounter("spiderman", 50, itemId, true);
    for (let i = 0; i < 480; i++) { bridged.step(STEP); referenceTick(reference.core); bridged.drainEvents(); reference.drainEvents(); }
    assert.deepEqual(snapshot(bridged), snapshot(reference), itemId);
  }
});

test("wave rewards, summoners and pause/speed use simulation time", () => {
  const g = new CombatGame();
  DEFAULT_TEAM.forEach((id,i) => deploy(g,id, i > 3 ? 9 : 8, 5+i%4));
  g.startWave();
  for(let i=0;i<6000&&g.phase==='combat';i++) advance(g,1);
  assert.equal(g.phase,"preparing"); assert.equal(g.health,20); assert.ok(g.kills>=7);
  assert.ok(g.cash>650+188); assert.equal(g.completed,1);
  const time=g.time; g.paused=true; advance(g,60); assert.equal(g.time,time);
  g.paused=false;g.speed=3;g.update(1/60);assert.ok(Math.abs(g.time-time-.05)<1e-8);
  g.auto=true;advance(g,33);assert.equal(g.wave,2);
  const equalA=new CombatGame(),equalB=new CombatGame();equalA.startWave();equalB.startWave();
  for(let i=0;i<120;i++) {equalA.update(1/30);equalB.update(1/60);equalB.update(1/60);}
  assert.deepEqual(equalA.enemies,equalB.enemies);
});

test("campaign milestones and survival use original wave definitions and terminal states", () => {
  const g=new CombatGame();const w=g.core.waveManager;
  for(const wave of [25,50,75,100]) {w.currentWave=wave;w.prepareNextWave();assert.ok(w.preparedQueue[0].config.isBoss);}
  assert.equal(w.preparedQueue[0].config.id,"thanos_final");
  // Finish the final wave through WaveManager, including its reward and end event.
  g.wave=100;g.phase="combat";w.isWaveActive=true;w.enemiesQueue=[];g.update(STEP);
  assert.equal(g.phase,"victory");assert.ok(g.drainEvents().some(e=>e.type==="end"));
  const loss=new CombatGame();loss.startWave();
  const boss=loss.spawnEnemy(SOURCE.enemies.bosses.ultron_prime);boss.hasReachedEnd=true;
  loss.update(STEP);assert.equal(loss.phase,"defeat");assert.equal(loss.health,0);
  const infinite=new CombatGame("infinite"); assert.equal(infinite.cash,750);
  infinite.core.waveManager.currentWave=101;infinite.core.waveManager.prepareNextWave();assert.ok(infinite.startWave());
  assert.equal(infinite.wave,101);assert.equal(infinite.core.modeSystem.modeId,"survival");
});

test("combat records are isolated from the prototype and 2D saves", () => {
  const store=new Map([["ultimate-marvel-td-profile-v1",JSON.stringify({version:1,bestWave:12})],["marvel_td_save","untouched"]]);
  const storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)};
  const opts={key:"ultimate-marvel-td-combat-v2",version:2,maxWave:100};
  const profile=loadProfile(storage,opts);assert.equal(profile.bestWave,0);profile.bestWave=75;saveProfile(storage,profile,opts);
  assert.equal(loadProfile(storage,opts).bestWave,75);assert.equal(loadProfile(storage).bestWave,12);assert.equal(store.get("marvel_td_save"),"untouched");
});
