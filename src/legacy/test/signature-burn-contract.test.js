import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Hero } from '../src/entities/Hero.js';
import { Enemy } from '../src/entities/Enemy.js';
import { CombatSystem } from '../src/systems/CombatSystem.js';
import { getHeroDamageAtLevel } from '../src/utils/HeroLevel.js';
import { getEvolutionForHero } from '../src/systems/EvolutionSystem.js';
import { buildSignatureAttackContext, resolveSignatureAfterAttack, getSignatureConfig } from '../src/systems/ItemSignatureSystem.js';

const heroes = JSON.parse(fs.readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8'));
const items = JSON.parse(fs.readFileSync(new URL('../data/items.json', import.meta.url), 'utf8'));
const cases = [
    ['human_torch', 'traje_moleculas_inestables', 7, 0.45, 4],
    ['jubilee', 'protocolo_danger_room', 10, 0.2, 3],
    ['jean_grey', 'formula_phoenix', 8, 0.36, 5],
    ['crystal', 'cristal_terrigeno', 7, 0.2, 4]
];
const closeTo = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);

function makeHero(id, itemId, level = 50) {
    let hero;
    const game = {
        heroes: [], enemies: [], random: { next: () => 0.99 }, resourceManager: { lives: 20 },
        progression: {
            getHeroBonuses: () => ({ damage: 0, range: 0, fireRate: 0, critChance: 0 }),
            getHeroEvolution: () => getEvolutionForHero(hero, {}, { level: hero?.level ?? level, equippedItemIds: (hero?.items || []).map((item) => item.id) })
        }
    };
    hero = new Hero({ ...heroes[id], level, damage: getHeroDamageAtLevel(heroes[id].damage, level, heroes[id].rarity) }, 0, 0, game);
    hero.items = [items[itemId]];
    game.heroes = [hero];
    return hero;
}

function makeEnemy(x = 80, hp = 100000) {
    return new Enemy({ id: 'dummy', hp, speed: 10 }, [{ x, y: 0 }, { x: 500, y: 0 }]);
}

function advanceSignature(hero, target, attacks) {
    for (let index = 0; index < attacks; index++) {
        const stats = hero.getEffectiveStats();
        const context = buildSignatureAttackContext(hero, target, stats);
        resolveSignatureAfterAttack(hero, target, context.stats, {}, [], context);
    }
}

for (const [id, itemId, interval, power, duration] of cases) {
    test(`${id}: firma requiere evolucion de nivel 50 y objeto en el unico slot`, () => {
        const locked = makeHero(id, itemId, 49);
        const target = makeEnemy();
        locked.game.enemies = [target];
        advanceSignature(locked, target, interval * 2);
        assert.equal(getSignatureConfig(locked), null);
        assert.equal(target.hp, target.maxHp);
        assert.equal(target.debuffs.length, 0);
        const evolved = makeHero(id, itemId);
        assert.equal(getSignatureConfig(evolved).interval, interval);
        evolved.items = [{ id: 'unrelated', effects: {} }, items[itemId]];
        assert.equal(getSignatureConfig(evolved), null);
        evolved.items = [];
        assert.equal(getSignatureConfig(evolved), null);
        assert.equal(evolved.game.progression.getHeroEvolution().levelEvolved, true);
    });

    test(`${id}: firma escala con poder evolucionado y no con salud del enemigo`, () => {
        let previous = 0;
        for (const level of [50, 75, 100]) {
            for (const hp of [100000, 1000000]) {
                const hero = makeHero(id, itemId, level);
                const primary = makeEnemy(80, hp);
                const neighbor = makeEnemy(100, hp);
                const outside = makeEnemy(400, hp);
                hero.game.enemies = [primary, neighbor, outside];
                const expected = hero.getEffectiveStats().damage * power;
                advanceSignature(hero, primary, interval - 1);
                assert.equal(primary.hp, hp);
                advanceSignature(hero, primary, 1);
                for (const target of [primary, neighbor]) {
                    const burn = target.debuffs.find((effect) => effect.type === 'burn');
                    assert.equal(burn.damageBasis, 'attackDamage');
                    assert.equal(burn.duration, duration);
                    assert.equal(burn.source, hero);
                    closeTo(burn.damagePerSecond, expected);
                    const beforeTick = target.hp;
                    target.updateDebuffs(1);
                    closeTo(beforeTick - target.hp, expected);
                }
                assert.equal(outside.hp, hp);
                assert.equal(outside.debuffs.length, 0);
                assert.equal(hero.game.resourceManager.lives, 20);
                if (hp === 100000) {
                    assert.ok(expected > previous);
                    previous = expected;
                }
            }
        }
    });

    test(`${id}: quemadura de firma captura buffs una vez y no se acumula`, () => {
        const hero = makeHero(id, itemId);
        const target = makeEnemy();
        hero.game.enemies = [target];
        const expected = hero.getEffectiveStats().damage * power;
        advanceSignature(hero, target, interval);
        hero.damage *= 2;
        const before = target.hp;
        target.updateDebuffs(1);
        closeTo(before - target.hp, expected);
        target.applyStatus({ type: 'burn', power: 0.01, duration: 5, damageBasis: 'attackDamage' }, hero);
        assert.equal(target.debuffs.filter((effect) => effect.type === 'burn').length, 1);
        closeTo(target.debuffs[0].damagePerSecond, expected);
    });
}

test('Crystal inicia con fuego y repite fuego-hielo-rayos sin perder una activacion', () => {
    const hero = makeHero('crystal', 'cristal_terrigeno');
    for (const expected of ['burn', 'slow', 'chain', 'burn']) {
        const primary = makeEnemy();
        const near = makeEnemy(100);
        const chainOnly = makeEnemy(180);
        hero.game.enemies = [primary, near, chainOnly];
        advanceSignature(hero, primary, 7);
        if (expected === 'chain') {
            assert.ok(chainOnly.hp < chainOnly.maxHp);
            assert.equal(primary.debuffs.length, 0);
        } else {
            assert.ok(primary.debuffs.some((effect) => effect.type === expected));
            assert.ok(near.debuffs.some((effect) => effect.type === expected));
            assert.equal(chainOnly.hp, chainOnly.maxHp);
            if (expected === 'slow') assert.ok(primary.debuffs.some((effect) => effect.type === 'stun'));
        }
    }
});

test('Nova Flame y Dark Phoenix superan su fuego normal sin sumar dos quemaduras', () => {
    for (const [id, itemId, interval, power] of [cases[0], cases[2]]) {
        const hero = makeHero(id, itemId);
        hero.game.random.next = () => 0;
        const target = makeEnemy();
        hero.game.enemies = [target];
        CombatSystem.applyEffects(hero.getProjectileEffects(target), target, hero);
        const normal = target.debuffs.find((effect) => effect.type === 'burn').damagePerSecond;
        advanceSignature(hero, target, interval);
        const burns = target.debuffs.filter((effect) => effect.type === 'burn');
        assert.equal(burns.length, 1);
        closeTo(burns[0].damagePerSecond, hero.getEffectiveStats().damage * power);
        assert.ok(burns[0].damagePerSecond > normal);
    }
});

test('shoot activa la primera Nova Flame exactamente al septimo ataque', () => {
    const hero = makeHero('human_torch', 'traje_moleculas_inestables');
    const target = makeEnemy();
    hero.game.enemies = [target];
    const projectiles = [];
    for (let count = 1; count <= 7; count++) {
        hero.shoot(target, hero.getEffectiveStats(), projectiles);
        assert.equal(projectiles.length, count);
        assert.equal(target.debuffs.some((effect) => effect.type === 'burn'), count === 7);
    }
});
