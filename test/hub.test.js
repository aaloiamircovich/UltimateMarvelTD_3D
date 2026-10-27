import test from "node:test";
import assert from "node:assert/strict";
import { moveAvatar, nearbyStation, HUB_STATIONS } from "../src/game/hub.js";
import { Game } from "../src/game/simulation.js";
import { waveDefinition } from "../src/game/data.js";
import { loadProfile, saveProfile } from "../src/game/profile.js";

test("avatar movement normalizes diagonals, bounds elapsed time and respects plaza walls", () => {
  const straight = moveAvatar({ x: 0, z: 0 }, 1, 0, 0.1);
  const diagonal = moveAvatar({ x: 0, z: 0 }, 1, 1, 0.1);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.z) - straight.x) < 1e-10);
  assert.deepEqual(moveAvatar({ x: 19, z: 0 }, 1, 0, 1), { x: 19, z: 0 });
  assert.deepEqual(moveAvatar({ x: 0, z: 0 }, 1, 0, 100), straight);
  const s = HUB_STATIONS[0];
  const front = { x: s.x, z: s.z - 0.5 };
  assert.deepEqual(moveAvatar(front, 0, -1, 0.1), front);
  assert.equal(nearbyStation({ x: s.x, z: s.z }).id, "story");
  assert.equal(nearbyStation({ x: 0, z: 0 }), undefined);
});

test("infinite completes wave 12 without victory and can start wave 13", () => {
  const g = new Game("infinite");
  g.wave = 11;
  assert.ok(g.startWave());
  g.spawnQueue = [];
  g.step(1 / 30);
  assert.equal(g.phase, "preparing");
  assert.equal(g.drainEvents().some(e => e.type === "end"), false);
  assert.ok(g.startWave());
  assert.equal(g.wave, 13);
  assert.ok(g.definition.multiplier > waveDefinition(12).multiplier);
  g.reset();
  assert.equal(g.mode, "infinite");
  assert.equal(g.wave, 0);
  const story = new Game();
  story.wave = 12;
  assert.equal(story.startWave(), false);
});

test("infinite waves retain periodic bosses with bounded simultaneous content", () => {
  assert.ok(waveDefinition(18).enemies.includes("boss"));
  assert.equal(waveDefinition(19).enemies.includes("boss"), false);
  assert.ok(waveDefinition(10000).enemies.length <= 66);
  assert.ok(Number.isFinite(waveDefinition(10000).multiplier));
});

test("existing profiles retain story progress and persist independent infinite record", () => {
  let value = JSON.stringify({ version: 1, bestWave: 9, victories: 2, sound: false });
  const storage = { getItem: () => value, setItem: (_, next) => { value = next; } };
  const p = loadProfile(storage);
  assert.equal(p.bestWave, 9);
  assert.equal(p.bestInfinite, 0);
  assert.equal(p.sound, false);
  p.bestInfinite = 23;
  assert.ok(saveProfile(storage, p));
  assert.equal(loadProfile(storage).bestInfinite, 23);
  value = JSON.stringify({ ...p, bestInfinite: -10 });
  assert.equal(loadProfile(storage).bestInfinite, 0);
});
