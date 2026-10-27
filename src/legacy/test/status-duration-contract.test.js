import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Enemy } from '../src/entities/Enemy.js';
import { Hero } from '../src/entities/Hero.js';
import { CombatSystem } from '../src/systems/CombatSystem.js';

const enemies = JSON.parse(fs.readFileSync(new URL('../data/enemies.json', import.meta.url), 'utf8'));
const heroes = JSON.parse(fs.readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8'));
const closeTo = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);
const makeEnemy = (config = {}) => new Enemy({ id: 'dummy', hp: 10000, speed: 100, ...config }, [{ x: 0, y: 0 }, { x: 500, y: 0 }]);

for (const type of ['burn', 'bleed', 'poison', 'curse']) {
    test(`${type}: DoT explicito liquida la fraccion final de su duracion`, () => {
        for (const duration of [0.1, 0.4, 0.5, 0.65, 1.1, 2.4]) {
            const target = makeEnemy();
            target.applyStatus({ type, duration, power: 20, damageBasis: 'flat' });
            target.updateDebuffs(duration + 1);
            closeTo(target.maxHp - target.hp, 20 * duration);
            assert.equal(target.debuffs.length, 0);
            const hp = target.hp;
            target.updateDebuffs(10);
            assert.equal(target.hp, hp);
        }
    });

    test(`${type}: resultado independiente de pasos de simulacion al expirar`, () => {
        const results = [];
        for (const dt of [1 / 60, 0.1, 0.35, 3]) {
            const target = makeEnemy({ statusResistance: 0.35, statusResistances: { [type]: 0.15 } });
            target.applyStatus({ type, duration: 1.3, power: 20, damageBasis: 'flat' });
            for (let time = 0; time < 3; time += dt) target.updateDebuffs(dt);
            results.push(target.maxHp - target.hp);
        }
        for (const result of results) closeTo(result, 13);
    });
}

test('resistencia acorta duracion hasta 20% sin reducir tambien el DPS', () => {
    const target = makeEnemy({ statusResistance: 0.55, statusResistances: { burn: 0.25 } });
    target.applyStatus({ type: 'burn', duration: 2.4, power: 10, damageBasis: 'flat' });
    closeTo(target.debuffs[0].duration, 0.48);
    assert.equal(target.debuffs[0].damagePerSecond, 10);
    target.updateDebuffs(0.2);
    assert.equal(target.hp, target.maxHp);
    target.updateDebuffs(0.3);
    closeTo(target.maxHp - target.hp, 4.8);
});

for (const bossId of ['loki', 'ultron_prime', 'thanos_final']) {
    test(`${bossId}: War Machine y X-23 infligen todo el tiempo permitido por sus resistencias`, () => {
        for (const heroId of ['war_machine', 'x_23']) {
            const game = { heroes: [], enemies: [], resourceManager: { lives: 20 }, random: { next: () => 0 } };
            const hero = new Hero(heroes[heroId], 0, 0, game);
            const target = makeEnemy({ ...enemies.bosses[bossId], hp: 1000000, barrierRatio: 0 });
            const effect = hero.getProjectileEffects(target).find((entry) => ['burn', 'bleed'].includes(entry.type));
            const duration = effect.duration * Math.max(0.2, 1 - target.statusResistance - (target.config.statusResistances?.[effect.type] || 0));
            const expected = hero.getEffectiveStats().damage * effect.power * duration;
            CombatSystem.applyEffects([effect], target, hero);
            target.updateDebuffs(10);
            closeTo(target.maxHp - target.hp, expected);
            assert.equal(target.debuffs.length, 0);
            assert.equal(game.resourceManager.lives, 20);
        }
    });
}

test('tick final acredita dano y una sola baja a la fuente mas fuerte', () => {
    const target = makeEnemy({ hp: 2 });
    const recorded = { damage: 0, victims: [] };
    const strong = { recordDamage: (amount) => { recorded.damage += amount; }, recordKill: (_resources, victim) => recorded.victims.push(victim) };
    const weak = { recordKill: () => assert.fail('No debe robar la baja') };
    target.applyStatus({ type: 'burn', duration: 0.2, power: 20, damageBasis: 'flat' }, strong);
    target.applyStatus({ type: 'burn', duration: 0.2, power: 1, damageBasis: 'flat' }, weak);
    target.updateDebuffs(1);
    target.updateDebuffs(1);
    assert.equal(recorded.damage, 2);
    assert.deepEqual(recorded.victims, [target]);
    assert.equal(target.isAlive, false);
});

test('tick final atraviesa armadura pero respeta barrera y no duplica dano', () => {
    const target = makeEnemy({ hp: 100, armor: 0.8, barrierRatio: 0.1 });
    let recorded = 0;
    target.applyStatus({ type: 'burn', duration: 0.3, power: 50, damageBasis: 'flat' }, { recordDamage: (amount) => { recorded += amount; } });
    target.updateDebuffs(1);
    closeTo(target.behavior.barrier, 0);
    closeTo(target.hp, 95);
    closeTo(recorded, 15);
});

test('refrescar estado no liquida el residuo antes de expirar ni suma fuentes', () => {
    const target = makeEnemy();
    target.applyStatus({ type: 'burn', duration: 0.3, power: 10, damageBasis: 'flat' });
    target.updateDebuffs(0.2);
    target.applyStatus({ type: 'burn', duration: 0.3, power: 2, damageBasis: 'flat' });
    assert.equal(target.hp, target.maxHp);
    target.updateDebuffs(0.1);
    assert.equal(target.hp, target.maxHp);
    target.updateDebuffs(0.3);
    closeTo(target.maxHp - target.hp, 5);
    assert.equal(target.debuffs.length, 0);
});

test('estados legacy conservan ticks completos sin fraccion ni cambio de minimo', () => {
    for (const [type, power, expected] of [['burn', 10, 5], ['bleed', 10, 4], ['curse', 0.001, 5]]) {
        const target = makeEnemy();
        target.applyStatus({ type, duration: 0.65, power });
        target.updateDebuffs(1);
        closeTo(target.maxHp - target.hp, expected);
    }
});

test('inmunidades de jefes y limite de acumulaciones no cambian', () => {
    const target = makeEnemy(enemies.bosses.thanos_final);
    assert.equal(target.applyStatus({ type: 'slow', duration: 4, power: 0.5 }), false);
    assert.equal(target.applyStatus({ type: 'stun', duration: 4, power: 1 }), false);
    for (let index = 0; index < 20; index++) target.applyStatus({ type: 'poison', duration: 2, power: 0.001 });
    assert.equal(target.debuffs[0].stacks, 12);
    closeTo(target.debuffs[0].duration, 0.4);
});

test('DoT explicito de poder cero no inflige minimo tampoco al expirar', () => {
    const target = makeEnemy();
    target.applyStatus({ type: 'burn', duration: 0.2, power: 0, damageBasis: 'flat' });
    target.updateDebuffs(1);
    assert.equal(target.hp, target.maxHp);
});
