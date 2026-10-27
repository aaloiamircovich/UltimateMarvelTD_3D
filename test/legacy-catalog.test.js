import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { LEGACY, LEGACY_COUNTS, previewLegacyHero, findLegacyEntries, legacyAsset,
  EVOLUTION_CATALOG, SYNERGY_DEFINITIONS, CAMPAIGN_MAX_WAVES } from "../src/game/legacy-catalog.js";
import manifest from "../src/legacy/manifest.json" with { type: "json" };

test("imported files match their pinned source bytes across platforms", () => {
  assert.equal(manifest.commit, "84797a5a0c0f344145a7b3442b02e46f13ebdb8b");
  for (const file of manifest.files) {
    const bytes = readFileSync(new URL(`../${file.local}`, import.meta.url));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), file.sha256, file.local);
  }
});

test("catalog retains the full original roster and progression references", () => {
  assert.deepEqual(LEGACY_COUNTS, { heroes: 105, items: 82, enemies: 30, bosses: 19, levels: 11 });
  assert.equal(Object.keys(EVOLUTION_CATALOG).length, 105);
  assert.equal(Object.keys(SYNERGY_DEFINITIONS).length, 23);
  assert.equal(CAMPAIGN_MAX_WAVES, 100);
  for (const hero of Object.values(LEGACY.heroes)) {
    assert.ok(Object.values(EVOLUTION_CATALOG).some(e => e.baseHeroId === hero.id), hero.id);
    const path = hero.visual?.portrait || hero.sprite;
    assert.ok(existsSync(new URL(`../public/legacy/${path}`, import.meta.url)), path);
  }
  for (const evolution of Object.values(EVOLUTION_CATALOG))
    for (const transform of evolution.itemTransforms) assert.ok(LEGACY.items[transform.itemId]);
});

test("all heroes can preview original levels without DOM, images, saves or catalogue mutation", () => {
  const before = JSON.stringify(LEGACY);
  const previousImage = globalThis.Image;
  globalThis.Image = class { constructor() { throw Error("No images may be created by the rules preview"); } };
  try {
    for (const hero of Object.values(LEGACY.heroes)) for (const level of [1, 49, 50, 99, 100]) {
      const p = previewLegacyHero(hero.id, { level });
      for (const stat of ["damage", "fireRate", "range", "critChance"])
        assert.ok(Number.isFinite(p.stats[stat]), `${hero.id} ${level} ${stat}`);
      if (level === 1) assert.equal(p.evolution, null);
      if (level === 100) assert.ok(p.evolution);
    }
    for (const itemId of Object.keys(LEGACY.items))
      assert.ok(Number.isFinite(previewLegacyHero("iron_man", { level: 100, itemId }).stats.damage));
  } finally { if (previousImage === undefined) delete globalThis.Image; else globalThis.Image = previousImage; }
  assert.equal(JSON.stringify(LEGACY), before);
});

test("original item transformations, support identity and team effects survive the adapter", () => {
  assert.equal(previewLegacyHero("spiderman", { level: 49 }).evolution, null);
  assert.equal(previewLegacyHero("spiderman", { level: 50 }).evolution.id, "iron_spider");
  assert.equal(previewLegacyHero("spiderman", { level: 50, itemId: "simbionte" }).evolution.transformId, "spiderman_black_suit");
  assert.equal(previewLegacyHero("capitan_america").support, true);
  const base = previewLegacyHero("iron_man");
  const team = previewLegacyHero("iron_man", { teamIds: ["iron_man", "capitan_america"] });
  assert.ok(team.stats.damage > base.stats.damage);
  assert.ok(team.team.pairs.some(pair => pair.active && pair.id === "ciencia_y_escudo"));
  assert.equal(previewLegacyHero("iron_man", { teamIds: Array(8).fill("iron_man") }).team.size, 1);
});

test("catalog searches normalize accents and respect rarity; symbolic thumbnails are not URLs", () => {
  assert.equal(findLegacyEntries("heroes", "CAPITAN AMERICA")[0].id, "capitan_america");
  assert.ok(findLegacyEntries("heroes", "", "Common").every(hero => hero.rarity === "Common"));
  assert.equal(findLegacyEntries("enemies").length, 49);
  assert.equal(findLegacyEntries("items").length, 82);
  assert.equal(findLegacyEntries("heroes", "__missing__").length, 0);
  assert.equal(legacyAsset("city_streets"), "");
});
