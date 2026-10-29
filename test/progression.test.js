import test from "node:test";
import assert from "node:assert/strict";
import { Collection, COLLECTION_KEY } from "../src/game/progression.js";
import { CombatGame } from "../src/game/combat.js";
import { ProgressionManager } from "../src/legacy/src/systems/ProgressionManager.js";
import { ShopSystem } from "../src/legacy/src/systems/ShopSystem.js";
import { RandomSource } from "../src/legacy/src/utils/Random.js";
import { SOURCE, toWorld } from "../src/game/combat-data.js";

function disk() {
  const values = new Map();
  return { values, writes: 0, getItem: key => values.get(key) ?? null,
    setItem(key, value) { this.writes++; values.set(key, value); } };
}
function place(game, id) {
  for (let y = 0; y < 19; y++) for (let x = 0; x < 25; x++) {
    const p = toWorld({ x: x * 32 + 16, y: y * 32 + 16 });
    if (!game.placementError(id, p.x, p.z)) return game.deploy(id, p.x, p.z).unit;
  }
  assert.fail(`No cell for ${id}`);
}

test("new collection preserves original starters and credits without touching other saves", () => {
  const storage = disk();
  storage.setItem("tower-defense-marvel-save", "original");
  storage.setItem("ultimate-marvel-td-combat-v2", "records");
  const p = new Collection(storage);
  assert.equal(p.getCredits(), 1200);
  assert.deepEqual(p.starters.map(h => h.id), ["black_widow", "hawkeye", "korg"]);
  assert.equal(p.recruit().ok, false);
  assert.equal(p.chooseStarter("iron_man"), false);
  assert.equal(p.chooseStarter("black_widow"), true);
  assert.equal(p.chooseStarter("hawkeye"), false);
  assert.deepEqual(new Collection(storage).state.activeTeamIds, ["black_widow"]);
  assert.equal(storage.getItem("tower-defense-marvel-save"), "original");
  assert.equal(storage.getItem("ultimate-marvel-td-combat-v2"), "records");
});

test("recruitment matches original weighted pool, pity, escalating costs and complete collection", () => {
  const storage = disk(), p = new Collection(storage, { random: new RandomSource(21) });
  p.chooseStarter("hawkeye"); p.setCredits(1e10);
  const reference = new ProgressionManager(null);
  reference.state = structuredClone(p.state); reference.data = structuredClone(SOURCE);
  const shop = new ShopSystem({ heroDatabase: reference.data.heroes, random: new RandomSource(21) }, reference);
  for (let i = 0; i < 104; i++) {
    const before = storage.writes;
    const actual = p.recruit(), expected = shop.recruitHero();
    assert.equal(actual.hero.id, expected.hero.id);
    assert.equal(actual.cost, expected.cost);
    assert.equal(p.state.shop.heroPity, reference.state.shop.heroPity);
    assert.equal(storage.writes - before, 1, "a purchase persists once, after cost, hero and pity change");
  }
  assert.equal(new Set(p.state.unlockedHeroIds).size, 105);
  assert.equal(p.recruit().ok, false);
  assert.deepEqual(p.recruitmentOdds(), []);
  const q = new Collection(disk(), { random: { pick: pool => pool[0] } });
  q.chooseStarter("korg"); q.state.shop.heroPity = 4;
  assert.equal(q.recruitmentOdds().some(o => o.rarity === "Common"), false);
  assert.notEqual(q.recruit().hero.rarity, "Common");
  q.setCredits(0); const snapshot = JSON.stringify(q.state);
  assert.equal(q.recruit().ok, false); assert.equal(JSON.stringify(q.state), snapshot);
});

test("progressive shop and single-item transfers survive reload and apply in 3D", () => {
  const storage = disk(), p = new Collection(storage);
  p.chooseStarter("black_widow"); p.unlockHero("hawkeye");
  const showcase = p.shopSystem.getShowcase().map(s => s.item.id);
  const notVisible = Object.keys(SOURCE.items).find(id => !showcase.includes(id));
  assert.equal(p.purchase(notVisible).ok, false);
  const item = p.purchase(showcase[0]).item;
  assert.ok(item); assert.equal(p.purchase(item.id).ok, false);
  assert.ok(!p.shopSystem.getShowcase().some(s => s.item.id === item.id));
  assert.equal(p.equipItem("black_widow", item.id), true);
  assert.equal(p.getOwnedQuantity(item.id), 0);
  assert.equal(p.equipItem("hawkeye", item.id), true);
  assert.equal(p.state.equippedItems.black_widow, undefined);
  const loaded = new Collection(storage), game = new CombatGame("story", { collection: loaded });
  place(game, "hawkeye");
  assert.equal(game.core.heroes[0].items[0].id, item.id);
  assert.ok(game.core.heroes[0].getEffectiveStats().damage > game.core.heroes[0].damage);
  loaded.attachHub(); assert.equal(loaded.unequipItem("hawkeye"), true);
  assert.equal(new Collection(storage).getOwnedQuantity(item.id), 1);
});

test("3D upgrades, targeting and earned credits persist atomically across HUB and mission restarts", () => {
  const storage = disk(), p = new Collection(storage);
  p.chooseStarter("black_widow");
  const game = new CombatGame("story", { collection: p });
  const hero = place(game, "black_widow");
  const before = storage.writes;
  assert.equal(game.upgrade(hero.id), true);
  assert.equal(storage.writes - before, 1);
  assert.equal(game.cash, 1020);
  game.cyclePriority(hero.id);
  game.core.resourceManager.addCredits(57);
  const loaded = new Collection(storage);
  assert.equal(loaded.getHeroLevel("black_widow"), 2);
  assert.equal(loaded.getCredits(), 1077);
  const next = new CombatGame("story", { collection: loaded });
  place(next, "black_widow");
  assert.equal(next.units[0].level, 2); assert.equal(next.units[0].priority, "Último");
  next.reset(); assert.equal(next.cash, 1077);
  assert.equal(next.units.length, 0);
  assert.equal(next.preview("black_widow").level, 2);
});

test("survival follows original 750-credit reset and resource synchronization contract", () => {
  const storage = disk(), p = new Collection(storage); p.chooseStarter("korg");
  const game = new CombatGame("infinite", { collection: p });
  assert.equal(game.cash, 750); assert.equal(p.getCredits(), 1200);
  p.attachHub(); assert.equal(p.getCredits(), 1200, "leaving before earning or spending preserves wallet");
  game.reset(); game.core.resourceManager.addCredits(25);
  assert.equal(new Collection(storage).getCredits(), 775);
  p.attachHub(); game.mode = "story"; game.reset(); assert.equal(game.cash, 775);
});

test("explicit 2D import is preflighted, backed up, normalized and portable", () => {
  const storage = disk(), p = new Collection(storage); p.chooseStarter("korg");
  const previous = storage.getItem(COLLECTION_KEY);
  const original = new ProgressionManager(null); original.data = structuredClone(SOURCE);
  original.startProfile("iron_man"); original.setHeroLevel("iron_man", 50);
  original.addOwnedItem("chaleco_tactico"); original.equipItem("iron_man", "chaleco_tactico");
  const prepared = p.prepareImport(original.exportSave());
  assert.equal(p.state.activeTeamIds[0], "korg", "preview does not apply");
  p.importProfile(prepared);
  assert.equal(storage.getItem(`${COLLECTION_KEY}-backup`), previous);
  assert.equal(p.getHeroLevel("iron_man"), 50);
  const fresh = new Collection(disk()); fresh.importProfile(fresh.prepareImport(p.exportProfile()));
  assert.deepEqual(fresh.state, p.state);
  assert.equal(new CombatGame("story", { collection: fresh }).preview("iron_man").items[0].id, "chaleco_tactico");
});

test("corrupt, incompatible and unavailable saves are visible and never overwritten", () => {
  for (const raw of ["{broken", "null", '{"version":999}', '{"version":9,"credits":4,"unlockedHeroIds":false}']) {
    const storage = disk(); storage.setItem(COLLECTION_KEY, raw);
    const p = new Collection(storage); p.chooseStarter("korg"); p.save();
    assert.ok(p.status); assert.equal(p.rawBackup, raw); assert.equal(storage.getItem(COLLECTION_KEY), raw);
  }
  const storage = disk(), p = new Collection(storage);
  storage.setItem = () => { throw Error("Quota"); };
  p.chooseStarter("hawkeye"); assert.ok(p.status); assert.ok(p.exportProfile().includes("hawkeye"));
  const before = JSON.stringify(p.state);
  assert.throws(() => p.importProfile(p.prepareImport(p.exportProfile())));
  assert.equal(JSON.stringify(p.state), before);
  for (const raw of ["{}", '{"format":"tower-defense-marvel-save","state":{"version":10}}']) assert.throws(() => p.prepareImport(raw));
  const unavailable = new Collection({ getItem() { throw Error("Blocked"); }, setItem() { assert.fail("must not overwrite"); } });
  assert.ok(unavailable.status); unavailable.chooseStarter("korg");
});
