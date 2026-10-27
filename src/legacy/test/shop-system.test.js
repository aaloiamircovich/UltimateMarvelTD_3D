import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ProgressionManager } from '../src/systems/ProgressionManager.js';
import { HERO_BOX_BASE_COST, ShopSystem, getHeroBoxCost, HERO_RARITY_WEIGHTS, sortItemsWeakestFirst } from '../src/systems/ShopSystem.js';

const data = {
    heroes: JSON.parse(fs.readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8')),
    items: JSON.parse(fs.readFileSync(new URL('../data/items.json', import.meta.url), 'utf8')),
    levels: JSON.parse(fs.readFileSync(new URL('../data/levels.json', import.meta.url), 'utf8'))
};

test('ShopSystem muestra los tres objetos mas debiles disponibles', () => {
    const { shop } = createShop();
    const first = shop.getRotation().map((slot) => slot.item.id);
    const second = shop.getRotation().map((slot) => slot.item.id);
    const expected = sortItemsWeakestFirst(Object.values(data.items)).slice(0, 3).map((item) => item.id);

    assert.deepEqual(first, second);
    assert.deepEqual(first, expected);
});

test('ShopSystem abre la tienda con una respuesta basica contra blindaje', () => {
    const { shop } = createShop();
    const [firstSlot] = shop.getRotation();

    assert.equal(firstSlot.item.id, 'chaleco_tactico');
    assert.ok(firstSlot.item.effects.damagePct > 0);
    assert.ok(firstSlot.item.effects.fireRatePct > 0);
    assert.ok(firstSlot.item.effects.armorPenetration > 0);
});

test('ShopSystem rellena la vitrina con el siguiente objeto al comprar', () => {
    const { shop, progression } = createShop();
    const expectedQueue = sortItemsWeakestFirst(Object.values(data.items)).map((item) => item.id);
    progression.setCredits(10000);
    const [first, second, third, fourth] = expectedQueue;

    assert.deepEqual(shop.getRotation().map((slot) => slot.item.id), [first, second, third]);
    assert.equal(shop.purchaseItem(first).ok, true);
    assert.deepEqual(shop.getRotation().map((slot) => slot.item.id), [second, third, fourth]);
    assert.deepEqual(progression.state.shop, { heroPity: 0, heroBoxCost: HERO_BOX_BASE_COST });
});

test('ShopSystem impide comprar dos veces el mismo objeto', () => {
    const { shop, progression } = createShop();
    const item = shop.getRotation()[0].item;
    progression.setCredits(10000);

    assert.equal(shop.purchaseItem(item.id).ok, true);
    assert.equal(shop.purchaseItem(item.id).ok, false);
    assert.equal(progression.hasItem(item.id), true);
});

test('ShopSystem recluta heroes sin duplicados', () => {
    const { shop, progression } = createShop();
    progression.startProfile('iron_man');
    progression.setCredits(5000);
    const result = shop.recruitHero();

    assert.equal(result.ok, true);
    assert.notEqual(result.hero.id, 'iron_man');
    assert.ok(result.hero.visual);
    assert.equal(new Set(progression.state.unlockedHeroIds).size, progression.state.unlockedHeroIds.length);
});

test('ShopSystem aumenta el costo de la caja de heroe un 12% por apertura', () => {
    const { shop, progression } = createShop();
    progression.startProfile('iron_man');
    progression.setCredits(5000);

    const first = shop.recruitHero();
    const second = shop.recruitHero();

    assert.equal(first.ok, true);
    assert.equal(first.cost, HERO_BOX_BASE_COST);
    assert.equal(first.nextCost, Math.ceil(HERO_BOX_BASE_COST * 1.12));
    assert.equal(second.ok, true);
    assert.equal(second.cost, first.nextCost);
    assert.equal(getHeroBoxCost(progression.state.shop), Math.ceil(second.cost * 1.12));
});

test('ShopSystem pondera las seis rarezas de heroes', () => {
    assert.deepEqual(Object.keys(HERO_RARITY_WEIGHTS), ['Common', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Secret']);
    assert.ok(HERO_RARITY_WEIGHTS.Common > HERO_RARITY_WEIGHTS.Rare);
    assert.ok(HERO_RARITY_WEIGHTS.Rare > HERO_RARITY_WEIGHTS.Epic);
    assert.ok(HERO_RARITY_WEIGHTS.Epic > HERO_RARITY_WEIGHTS.Legendary);
    assert.ok(HERO_RARITY_WEIGHTS.Legendary > HERO_RARITY_WEIGHTS.Mythic);
    assert.ok(HERO_RARITY_WEIGHTS.Mythic > HERO_RARITY_WEIGHTS.Secret);
});

test('objetos usan las mismas seis rarezas auditadas que los heroes', () => {
    const rarities = new Set(Object.values(data.items).map((item) => item.rarity));

    assert.deepEqual([...rarities].sort(), ['Common', 'Epic', 'Legendary', 'Mythic', 'Rare', 'Secret']);
    Object.values(data.items).forEach((item) => {
        assert.ok(Object.hasOwn(HERO_RARITY_WEIGHTS, item.rarity), `${item.id} tiene rareza invalida`);
    });
});

function createShop() {
    const storage = { value: null, getItem() { return this.value; }, setItem(key, value) { this.value = value; } };
    const game = {
        heroes: [], audio: { setEnabled: () => {} }, itemDatabase: data.items, heroDatabase: data.heroes,
        random: { pick: (values) => values[0] }, resourceManager: { lives: 20, maxLives: 20 }, currentLevel: { id: 'level_1' }
    };
    const progression = new ProgressionManager(storage);
    progression.initialize(game, data);
    const shop = new ShopSystem(game, progression, () => new Date('2026-06-21T12:00:00Z'));
    return { shop, progression };
}
