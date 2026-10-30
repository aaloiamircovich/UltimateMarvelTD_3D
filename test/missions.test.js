import test from "node:test";
import assert from "node:assert/strict";
import { getMission, missionAccess } from "../src/game/missions.js";
import { Collection } from "../src/game/progression.js";
import { CombatGame } from "../src/game/combat.js";

test("Manhattan preserves original manual terrain, forced grass cells and independent copies", () => {
  const m = getMission("level_2");
  assert.equal(m.difficulty, "easy");
  assert.equal(m.terrain.length, 19);
  assert.ok(m.terrain.every(row => row.length === 25));
  const count = m.terrain.flat().reduce((out, cell) => { out[cell] = (out[cell] || 0) + 1; return out; }, {});
  assert.deepEqual(count, { 0:53, 1:252, 2:41, 3:65, 5:64 });
  for (const id of [108,109,110,111,112,...Array.from({length:12}, (_,i)=>264+i)])
    assert.equal(m.terrain[Math.floor((id-1)/25)][(id-1)%25], 1);
  m.terrain[0][0] = 99; m.level.name = "changed";
  assert.equal(getMission("level_2").terrain[0][0], 0);
  assert.equal(getMission("level_2").level.name, "Calles de Nueva York");
  assert.throws(() => getMission("level_3"), /no integrada/);
});

test("25 original stars unlock Manhattan; wave rewards and objectives persist per map", () => {
  const values = new Map(), disk = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const collection = new Collection(disk);
  assert.match(missionAccess("level_2", collection), /25/);
  assert.throws(() => new CombatGame("story", {collection, missionId:"level_2"}), /25/);
  const base = new CombatGame("story", {collection});
  collection.recordWave(base.core,24);
  assert.match(missionAccess("level_2",collection), /25/);
  collection.recordWave(base.core,25);
  assert.equal(missionAccess("level_2",collection), null);
  const city = new CombatGame("story", {collection,missionId:"level_2"});
  assert.equal(city.core.currentLevelIndex,1);
  assert.equal(city.core.missionSystem.level.id,"level_2");
  const before = collection.getCredits();
  assert.equal(collection.recordWave(city.core,1),21);
  assert.equal(collection.getCredits(),before+21);
  assert.equal(collection.completeMissionObjective("level_2","ny_control",180),true);
  assert.equal(collection.completeMissionObjective("level_2","ny_control",180),false);
  const loaded = new Collection(disk);
  assert.equal(loaded.getMapProgress("level_1").bestWave,25);
  assert.equal(loaded.getMapProgress("level_2").bestWave,1);
  assert.deepEqual(loaded.getMapProgress("level_1").missionObjectives,[]);
  assert.deepEqual(loaded.getMapProgress("level_2").missionObjectives,["ny_control"]);
  city.reset(); assert.equal(city.core.currentLevel.id,"level_2");
});
