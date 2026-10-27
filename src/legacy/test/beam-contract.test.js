import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Hero } from '../src/entities/Hero.js';
import { Enemy } from '../src/entities/Enemy.js';
import { getEvolutionForHero } from '../src/systems/EvolutionSystem.js';
import { ITEM_SIGNATURES, buildSignatureAttackContext, resolveSignatureAfterAttack } from '../src/systems/ItemSignatureSystem.js';
import { getLineEndpoint, getLineTargets } from '../src/utils/LineTargeting.js';

const heroes = JSON.parse(fs.readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8'));
const items = JSON.parse(fs.readFileSync(new URL('../data/items.json', import.meta.url), 'utf8'));
const closeTo = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);

function makeHero(id, itemId = null) {
    let hero;
    const beams = [];
    const game = {
        heroes: [], enemies: [], resourceManager: { lives: 20 }, random: { next: () => 0.99 },
        vfx: { addBeam: (from, to, options) => beams.push({ from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y }, options }) },
        progression: {
            getHeroBonuses: () => ({ damage: 0, range: 0, fireRate: 0, critChance: 0 }),
            getHeroEvolution: () => getEvolutionForHero(hero, {}, { level: hero?.level ?? 1, equippedItemIds: (hero?.items || []).map((item) => item.id) })
        }
    };
    hero = new Hero({ ...heroes[id], level: itemId ? 100 : 1 }, 0, 0, game);
    hero.items = itemId ? [items[itemId]] : [];
    game.heroes = [hero];
    return { hero, beams };
}

function enemy(x, y = 0, hidden = false) {
    const target = new Enemy({ id: 'dummy', hp: 100000, speed: 10 }, [{ x, y }, { x: 1000, y }]);
    target.stealth = hidden;
    target.distanceTravelled = x;
    return target;
}

test('Captain Marvel no consume energia ni cooldown si solo hay blancos ocultos', () => {
    const { hero, beams } = makeHero('captain_marvel');
    const target = enemy(100, 0, true);
    hero.game.enemies = [target];
    const kit = hero.abilitySystem.cosmicKit;
    kit.resource = 60;
    kit.cooldownRemaining = 0;
    kit.update(0.1, [target], hero.getEffectiveStats());
    assert.equal(kit.resource, 60);
    assert.equal(kit.cooldownRemaining, 0);
    assert.equal(kit.flightOrigin, null);
    assert.equal(target.hp, target.maxHp);
    assert.equal(beams.length, 0);
});

test('Captain Marvel puede fijar un oculto con deteccion efectiva', () => {
    const { hero } = makeHero('captain_marvel');
    const target = enemy(100, 0, true);
    const kit = hero.abilitySystem.cosmicKit;
    kit.resource = 60;
    kit.cooldownRemaining = 0;
    kit.update(0.1, [target], { ...hero.getEffectiveStats(), canSeeStealth: true });
    assert.equal(kit.resource, 0);
    assert.equal(target.hp, target.maxHp);
    kit.update(0.45, [target], hero.getEffectiveStats());
    assert.ok(target.hp < target.maxHp);
    assert.equal(target.stealth, true);
});

test('Captain Marvel fija visible, atraviesa ocultos incidentales y dibuja el alcance real', () => {
    const { hero, beams } = makeHero('captain_marvel');
    const primary = enemy(200);
    const hidden = enemy(400, 0, true);
    const lateral = enemy(200, 27);
    lateral.distanceTravelled = 0;
    const behind = enemy(-10);
    const kit = hero.abilitySystem.cosmicKit;
    kit.resource = 60;
    kit.cooldownRemaining = 0;
    const stats = hero.getEffectiveStats();
    const pastEnd = enemy(stats.range * 2.2 + 1);
    hero.game.enemies = [primary, hidden, lateral, behind, pastEnd];
    kit.update(0.1, hero.game.enemies, stats);
    assert.equal(hero.x, 0);
    assert.equal(hero.y, 0);
    assert.equal(primary.hp, primary.maxHp);
    kit.update(0.45, hero.game.enemies, stats);
    assert.ok(primary.hp < primary.maxHp);
    assert.ok(hidden.hp < hidden.maxHp);
    for (const target of [lateral, behind, pastEnd]) assert.equal(target.hp, target.maxHp);
    assert.deepEqual(beams[0].from, { x: 0, y: 0 });
    closeTo(beams[0].to.x, stats.range * 2.2);
    closeTo(beams[0].to.y, 0);
    assert.equal(kit.resource, 0);
    const hpAfter = primary.hp;
    kit.update(1.25, hero.game.enemies, stats);
    assert.equal(hero.x, 0);
    assert.equal(hero.y, 0);
    kit.resource = 60;
    kit.update(0.1, hero.game.enemies, stats);
    assert.equal(primary.hp, hpAfter);
    assert.equal(kit.resource, 60);
    assert.equal(beams.length, 1);
});

test('Captain Marvel conserva alcance especial 2.2x con limite inclusivo', () => {
    for (const offset of [0, 0.01]) {
        const { hero, beams } = makeHero('captain_marvel');
        const kit = hero.abilitySystem.cosmicKit;
        kit.resource = 60;
        kit.cooldownRemaining = 0;
        const stats = hero.getEffectiveStats();
        const target = enemy(stats.range * 2.2 + offset);
        kit.update(0.1, [target], stats);
        kit.update(0.45, [target], stats);
        assert.equal(beams.length, offset === 0 ? 1 : 0);
        assert.equal(kit.resource, offset === 0 ? 0 : 60);
    }
});

for (const [itemId, configs] of Object.entries(ITEM_SIGNATURES)) {
    for (const [id, config] of Object.entries(configs)) {
        if (!config.line) continue;
        test(`${id}: rayo signature dibuja su longitud completa independientemente del orden enemigo`, () => {
            const { hero, beams } = makeHero(id, itemId);
            const stats = hero.getEffectiveStats();
            const length = config.lineRange || stats.range * 1.25;
            const primary = enemy(length * 0.5);
            const far = enemy(length * 0.9);
            const near = enemy(length * 0.2);
            const hidden = enemy(length * 0.7, 0, true);
            const lateral = enemy(length * 0.5, (config.lineWidth || 30) + 1);
            const behind = enemy(-10);
            const outside = enemy(length + 1);
            hero.game.enemies = [far, hidden, primary, near, lateral, behind, outside];
            for (let attack = 0; attack < config.interval; attack++) {
                const context = buildSignatureAttackContext(hero, primary, stats);
                resolveSignatureAfterAttack(hero, primary, stats, {}, [], context);
            }
            for (const target of [far, hidden, primary, near]) assert.ok(target.hp < target.maxHp);
            for (const target of [lateral, behind, outside]) assert.equal(target.hp, target.maxHp);
            assert.equal(beams.length, 1);
            assert.deepEqual(beams[0].to, { x: length, y: 0 });
            assert.equal(hero.game.resourceManager.lives, 20);
        });
    }
}

test('rayos verticales y diagonales mantienen limites longitudinales y ancho lateral', () => {
    for (const [dx, dy] of [[0, 1], [1, 0], [0.6, 0.8]]) {
        const origin = { x: 20, y: 30 };
        const point = (along, side = 0) => ({ x: origin.x + dx * along - dy * side, y: origin.y + dy * along + dx * side, isAlive: true });
        const aim = point(50);
        const atEnd = point(100);
        const atWidth = point(50, 10);
        const behind = point(-1);
        const outside = point(101);
        const wide = point(50, 11);
        const dead = { ...point(50), isAlive: false };
        const result = getLineTargets(origin, aim, [atEnd, atWidth, behind, outside, wide, dead], 100, 10);
        assert.deepEqual(result, [atEnd, atWidth]);
        const endpoint = getLineEndpoint(origin, aim, 100);
        closeTo(endpoint.x, atEnd.x);
        closeTo(endpoint.y, atEnd.y);
    }
});
