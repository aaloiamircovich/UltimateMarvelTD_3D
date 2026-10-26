import test from "node:test";
import assert from "node:assert/strict";
import {
  Game,
  pathPosition,
  PATH_LENGTH,
  placementError,
  selectTarget,
} from "../src/game/simulation.js";
import { HEROES, WAVE_COUNT, waveDefinition } from "../src/game/data.js";
import { loadProfile, saveProfile } from "../src/game/profile.js";

function advance(game, seconds) {
  for (let i = 0; i < seconds * 30; i++) {
    game.update(1 / 30);
    game.drainEvents();
  }
}

test("path follows corners and clamps endpoints", () => {
  assert.deepEqual(pathPosition(-10), { x: -15, z: 5, angle: Math.PI / 2 });
  assert.equal(pathPosition(6).x, -9);
  assert.deepEqual(pathPosition(10), { x: -9, z: 1, angle: Math.PI });
  assert.equal(pathPosition(PATH_LENGTH + 100).x, 15);
  assert.equal(pathPosition(PATH_LENGTH + 100).z, -5);
});
test("deployment rejects path, buildings, overlap, bounds, invalid data and insufficient funds atomically", () => {
  const g = new Game();
  for (const [x, z] of [
    [-9, 1],
    [-12, -8],
    [16, 0],
    [NaN, 0],
  ])
    assert.ok(g.deploy("iron_man", x, z).error);
  assert.equal(g.cash, 1000);
  assert.equal(g.units.length, 0);
  const { unit } = g.deploy("iron_man", -6, 3);
  assert.ok(unit);
  assert.equal(g.cash, 700);
  assert.ok(g.deploy("iron_man", -6, 3).error);
  assert.equal(g.cash, 700);
  assert.ok(g.deploy("unknown", 0, 0).error);
  g.cash = 1;
  assert.ok(g.deploy("hulk", 0, 0).error);
});
test("first and last targeting use path progress, strong uses health; out-of-range and dead are excluded", () => {
  const enemies = [
    { id: 1, x: 0, z: 0, hp: 20, distance: 9 },
    { id: 2, x: 0, z: 2, hp: 70, distance: 4 },
    { id: 3, x: 100, z: 0, hp: 100, distance: 20 },
    { id: 4, x: 0, z: 0, hp: 0, distance: 30 },
  ];
  assert.equal(
    selectTarget(enemies, { x: 0, z: 0, priority: "Primero" }, 5).id,
    1,
  );
  assert.equal(
    selectTarget(enemies, { x: 0, z: 0, priority: "Último" }, 5).id,
    2,
  );
  assert.equal(
    selectTarget(enemies, { x: 0, z: 0, priority: "Fuerte" }, 5).id,
    2,
  );
});
test("upgrade cost, cap and sale preserve money accounting", () => {
  const g = new Game();
  g.cash = 10000;
  const { unit } = g.deploy("iron_man", -6, 3);
  const original = g.stats(unit).damage;
  assert.equal(g.upgrade(unit.id), true);
  assert.ok(g.stats(unit).damage > original);
  g.upgrade(unit.id);
  g.upgrade(unit.id);
  assert.equal(unit.level, 4);
  const cash = g.cash;
  assert.equal(g.upgrade(unit.id), false);
  assert.equal(g.cash, cash);
  const refund = g.stats(unit).sellValue;
  assert.ok(g.sell(unit.id));
  assert.equal(g.cash, cash + refund);
  assert.equal(g.sell(unit.id), false);
});
test("Cap aura boosts nearby damage once; distinct Avengers activate synergy", () => {
  const g = new Game();
  g.cash = 10000;
  const a = g.deploy("iron_man", -6, 3).unit;
  const b = g.deploy("capitan_america", -4, 2).unit;
  assert.equal(g.stats(a).damage, 35);
  g.deploy("capitan_america", -4, 4);
  assert.equal(g.stats(a).damage, 35);
  assert.equal(g.avengerCount, 2);
  g.deploy("thor", 1, 1);
  assert.equal(g.avengerCount, 3);
  assert.equal(g.stats(a).damage, 39);
  assert.equal(g.stats(b).damage, 0);
});
test("web applies slow; chain and area attacks affect multiple targets", () => {
  for (const heroId of ["spiderman", "thor", "hulk", "doctor_strange"]) {
    const g = new Game();
    g.cash = 10000;
    const u = g.deploy(heroId, -6, 3).unit;
    g.definition = waveDefinition(1);
    g.spawn("tank");
    g.spawn("tank");
    g.enemies.forEach((e, i) => Object.assign(e, { x: -8, z: 3 + i * 0.5 }));
    g.attack(u, g.enemies[0], g.stats(u));
    assert.ok(g.enemies[0].hp < g.enemies[0].maxHp);
    if (heroId === "spiderman") {
      assert.equal(g.enemies[0].slow, 0.6);
      assert.equal(g.enemies[1].hp, g.enemies[1].maxHp);
    } else assert.ok(g.enemies[1].hp < g.enemies[1].maxHp);
    if (heroId === "doctor_strange") assert.equal(g.enemies[1].slow, 0.7);
  }
});
test("kills are paid exactly once even with repeated hits", () => {
  const g = new Game(),
    u = g.deploy("iron_man", -6, 3).unit;
  g.definition = waveDefinition(1);
  g.spawn("drone");
  const e = g.enemies[0],
    before = g.cash;
  g.hit(e, 999, u);
  g.hit(e, 999, u);
  assert.equal(g.kills, 1);
  assert.equal(g.cash - before, 24);
});
test("pause freezes combat, wave cannot start twice, speed changes simulated time", () => {
  const g = new Game();
  assert.ok(g.startWave());
  assert.equal(g.startWave(), false);
  advance(g, 1);
  const d = g.enemies[0].distance;
  g.paused = true;
  advance(g, 3);
  assert.equal(g.enemies[0].distance, d);
  g.paused = false;
  g.speed = 3;
  const t = g.time;
  advance(g, 1);
  assert.ok(Math.abs(g.time - t - 3) < 0.001);
});
test("undefended campaign reaches defeat and restart restores initial state", () => {
  const g = new Game();
  g.auto = true;
  g.startWave();
  advance(g, 250);
  assert.equal(g.phase, "defeat");
  assert.equal(g.health, 0);
  assert.ok(g.wave > 1);
  assert.ok(g.deploy("iron_man", 0, 0).error);
  g.reset();
  assert.equal(g.phase, "preparing");
  assert.equal(g.cash, 1000);
  assert.equal(g.units.length, 0);
  assert.equal(g.enemies.length, 0);
});
test("wave completion waits for surviving enemies and grants bonus once", () => {
  const g = new Game();
  g.startWave();
  g.spawnQueue = [];
  g.spawn("drone");
  advance(g, 1);
  assert.equal(g.phase, "combat");
  g.enemies[0].hp = 0;
  g.update(1 / 30);
  assert.equal(g.phase, "preparing");
  const cash = g.cash;
  advance(g, 10);
  assert.equal(g.cash, cash);
  assert.equal(cash, 1000 + waveDefinition(1).bonus);
});
test("12-wave campaign can be won with earned funds using placement and upgrades", () => {
  const g = new Game();
  const plan = [
    ["iron_man", -6, -1],
    ["spiderman", -6, 3],
    ["thor", 1, 1],
    ["capitan_america", -4, 2],
    ["hulk", 5, 1],
    ["iron_man", 4, -4],
    ["doctor_strange", 10, -3],
  ];
  let index = 0;
  for (let wave = 1; wave <= WAVE_COUNT; wave++) {
    while (
      index < plan.length &&
      g.cash >= HEROES.find((h) => h.id === plan[index][0]).cost
    ) {
      const result = g.deploy(...plan[index]);
      assert.ok(result.unit, result.error);
      index++;
    }
    for (const unit of g.units.filter((u) => u.heroId !== "capitan_america")) {
      if (unit.level < 4 && (index >= 4 || wave > 3)) g.upgrade(unit.id);
    }
    assert.ok(g.startWave());
    let ticks = 0;
    while (g.phase === "combat" && ticks++ < 6000) {
      g.update(1 / 30);
      g.drainEvents();
    }
    assert.notEqual(g.phase, "defeat", `defeated on wave ${wave}`);
    assert.ok(ticks < 6000);
  }
  assert.equal(g.phase, "victory");
  assert.equal(g.wave, 12);
  assert.ok(g.health > 0);
});
test("all waves valid and bosses present on 6 and 12 only", () => {
  for (let n = 1; n <= 12; n++)
    assert.equal(waveDefinition(n).enemies.includes("boss"), n % 6 === 0);
});
test("corrupt, missing and blocked storage cannot break the game", () => {
  assert.equal(loadProfile({ getItem: () => "{" }).bestWave, 0);
  assert.equal(
    loadProfile({
      getItem: () => '{"version":1,"bestWave":999,"victories":-4}',
    }).bestWave,
    12,
  );
  assert.equal(
    loadProfile({
      getItem: () => {
        throw Error();
      },
    }).sound,
    true,
  );
  assert.equal(
    saveProfile(
      {
        setItem: () => {
          throw Error();
        },
      },
      {},
    ),
    false,
  );
});
