import test from "node:test";
import assert from "node:assert/strict";
import { getMission, missionAccess, missionEndpoints } from "../src/game/missions.js";
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
  assert.throws(() => getMission("level_5"), /no integrada/);
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


test("Wakanda keeps exact endpoints, hard difficulty, terrain and 50-star access", () => {
  const m = getMission("level_3");
  assert.equal(m.difficulty, "hard");
  assert.deepEqual(m.path, m.level.path);
  assert.deepEqual(missionEndpoints(m), { start:{x:80,y:592}, end:{x:368,y:560} });
  assert.equal(m.level.mission.mechanic.type, "manual_assault");
  const legend = { W:0,G:1,S:11,P:2,M:3,B:5,X:5 };
  assert.deepEqual(m.terrain, m.level.rendering.terrainRows.map(row => [...row].map(c => legend[c])));
  assert.match(missionAccess("level_3", {getTotalStars:()=>49}), /50/);
  assert.equal(missionAccess("level_3", {getTotalStars:()=>50}), null);
  const g = new CombatGame("story", {missionId:"level_3"});
  assert.equal(g.core.currentLevelIndex,2);
  assert.equal(g.core.difficulty,"hard");
  g.startWave();
  for(let i=0;i<120 && !g.enemies.length;i++) g.update(1/60);
  assert.ok(g.enemies.length > 0);
  // Enemy's original exact-path travel adds 24 pixels of goal overshoot.
  assert.deepEqual(g.core.path, m.path);
  assert.deepEqual(g.core.enemies[0].path, [...m.path, {x:368,y:584}]);
  assert.equal(g.core.missionSystem.state.vegetation,0);
});

test("Wakanda original kill and boss objectives pay once and stay isolated", () => {
  const g = new CombatGame("story", {missionId:"level_3"});
  const p = g.core.progression, mission = g.core.missionSystem;
  for(let i=0;i<89;i++) mission.onEnemyDefeated({isBoss:false});
  mission.onWaveFinished();
  assert.deepEqual(p.getMapProgress("level_3").missionObjectives,[]);
  const before=p.getCredits();
  mission.onEnemyDefeated({isBoss:true}); mission.onWaveFinished();
  assert.equal(p.getCredits(),before+600);
  assert.deepEqual(p.getMapProgress("level_3").missionObjectives,["wakanda_route_hold","wakanda_boss"]);
  mission.onWaveFinished(); assert.equal(p.getCredits(),before+600);
  assert.deepEqual(p.getMapProgress("level_2").missionObjectives,[]);
});


test("Sanctum preserves generated 40px terrain and 75-star access", async () => {
  const {default:fixture} = await import("./fixtures/sanctum-terrain.json", {with:{type:"json"}});
  const m=getMission("level_4");
  assert.equal(m.gridSize,40); assert.equal(m.difficulty,"hard");
  assert.deepEqual(m.terrain,fixture.rows);
  assert.match(missionAccess("level_4",{getTotalStars:()=>74}),/75/);
  assert.equal(missionAccess("level_4",{getTotalStars:()=>75}),null);
  const g=new CombatGame("story",{missionId:"level_4"});
  assert.equal(g.core.gridSize,40);
  assert.match(g.placementError("iron_man",-5,.625),/reservada/);
});

test("Sanctum wards mark at most four nearby enemies and expire outside the zone", () => {
  const g=new CombatGame("story",{missionId:"level_4"});
  const enemies=Array.from({length:6},()=>g.spawnEnemy(g.core.enemyDatabase.normal.hydra_soldier));
  enemies.forEach(e=>{e.x=240;e.y=320;}); enemies[5].x=400;
  g.core.missionSystem.update(1/60);
  for(const e of enemies.slice(0,4)) assert.equal(e.getDamageTakenMultiplier(),1.12);
  assert.equal(enemies[4].getDamageTakenMultiplier(),1);
  assert.equal(enemies[5].getDamageTakenMultiplier(),1);
  enemies[0].x=400; enemies[0].y=400;
  enemies[0].update(.5);
  assert.equal(enemies[0].getDamageTakenMultiplier(),1);
  const p=g.core.progression, before=p.getCredits();
  for(let i=0;i<59;i++) g.core.missionSystem.onEnemyDefeated({isBoss:false});
  g.core.missionSystem.onEnemyDefeated({isBoss:true});
  g.core.missionSystem.onWaveFinished();
  assert.equal(p.getCredits(),before+660);
  g.core.missionSystem.onWaveFinished(); assert.equal(p.getCredits(),before+660);
  assert.deepEqual(p.getMapProgress("level_3").missionObjectives,[]);
});
