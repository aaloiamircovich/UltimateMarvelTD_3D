import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Enemy, buildEnemyStatusPips } from '../src/entities/Enemy.js';
import { Hero } from '../src/entities/Hero.js';
import { CombatSystem } from '../src/systems/CombatSystem.js';

const heroes = JSON.parse(fs.readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8'));
const enemies = JSON.parse(fs.readFileSync(new URL('../data/enemies.json', import.meta.url), 'utf8'));
const closeTo = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);
const enemy = (config = {}) => new Enemy({ id: 'dummy', hp: 10000, speed: 10, ...config }, [{ x: 0, y: 0 }, { x: 1000, y: 0 }]);
const poison = (power, duration = 2, stacks = 1) => ({ type: 'poison', damageBasis: 'flat', power, duration, stacks });
function source(id) {
    return { id, damage: 0, kills: 0, recordDamage(value) { this.damage += value; }, recordKill() { this.kills++; } };
}

test('venenos de 10 y 1 DPS suman 11, con dano propio para cada fuente', () => {
    const target = enemy();
    const strong = source('strong');
    const weak = source('weak');
    target.applyStatus(poison(10), strong);
    target.applyStatus(poison(1), weak);
    target.updateDebuffs(1);
    closeTo(target.maxHp - target.hp, 11);
    closeTo(strong.damage, 10);
    closeTo(weak.damage, 1);
    assert.equal(target.debuffs.length, 1);
    assert.equal(target.debuffs[0].stacks, 2);
    assert.equal(target.debuffs[0].damagePerSecond, 11);
});

test('una aplicacion debil no prolonga la potente ni hereda su autoria', () => {
    const target = enemy();
    const strong = source('strong');
    const weak = source('weak');
    target.applyStatus(poison(10, 0.7), strong);
    target.updateDebuffs(0.2);
    target.applyStatus(poison(1, 2), weak);
    target.updateDebuffs(0.6);
    closeTo(strong.damage, 7);
    assert.equal(target.debuffs[0].stacks, 1);
    target.updateDebuffs(3);
    closeTo(strong.damage, 7);
    closeTo(weak.damage, 2);
    assert.equal(target.debuffs.length, 0);
});

test('acumulaciones de la misma fuente conservan duraciones independientes', () => {
    const target = enemy();
    const hero = source('hero');
    target.applyStatus(poison(10, 1), hero);
    target.updateDebuffs(0.5);
    target.applyStatus(poison(10, 1), hero);
    target.updateDebuffs(0.5);
    assert.equal(target.debuffs[0].stacks, 1);
    target.updateDebuffs(0.5);
    closeTo(hero.damage, 20);
    assert.equal(target.debuffs.length, 0);
});

test('bolsa llena rechaza fuente mas debil o igual sin refrescar a otros', () => {
    for (const power of [1, 10]) {
        const target = enemy();
        const owner = source('owner');
        target.applyStatus(poison(10, 1, 12), owner);
        target.updateDebuffs(0.2);
        assert.equal(target.applyStatus(poison(power, 20), source('other')), false);
        assert.equal(target.debuffs[0].stacks, 12);
        closeTo(target.debuffs[0].duration, 0.8);
        target.updateDebuffs(1);
        closeTo(owner.damage, 120);
    }
});

test('en el cap refrescar la misma contribucion no reinicia su tick pendiente', () => {
    const target = enemy();
    const owner = source('owner');
    target.applyStatus(poison(10, 1, 12), owner);
    target.updateDebuffs(0.4);
    target.applyStatus(poison(10, 2), owner);
    target.updateDebuffs(0.1);
    closeTo(owner.damage, 60);
    assert.equal(target.debuffs[0].stacks, 12);
    target.updateDebuffs(0.5);
    assert.equal(target.debuffs[0].stacks, 1);
});

test('fuente fuerte sustituye las doce debiles sin superar el limite', () => {
    const target = enemy();
    const weak = source('weak');
    const strong = source('strong');
    target.applyStatus(poison(1, 10, 12), weak);
    target.updateDebuffs(0.2);
    for (let index = 0; index < 12; index++) target.applyStatus(poison(10, 1), strong);
    closeTo(weak.damage, 2.4);
    assert.equal(target.debuffs[0].stacks, 12);
    assert.ok(target.debuffs[0].applications.every((entry) => entry.source === strong));
    target.updateDebuffs(1);
    closeTo(strong.damage, 120);
});

test('reemplazo que liquida una baja no instala mas venenos ni duplica credito', () => {
    const target = enemy();
    const weak = source('weak');
    const strong = source('strong');
    target.applyStatus(poison(10, 2, 12), weak);
    target.updateDebuffs(0.2);
    target.hp = 1;
    target.applyStatus(poison(20, 2), strong);
    target.updateDebuffs(1);
    assert.equal(weak.kills, 1);
    assert.equal(strong.kills, 0);
    assert.equal(strong.damage, 0);
    assert.equal(target.applyStatus(poison(20), strong), false);
});

test('credito de baja respeta orden temporal, incluso con un frame largo', () => {
    for (const dt of [0.05, 2]) {
        const target = enemy();
        const slow = source('slow');
        const lethal = source('lethal');
        target.applyStatus(poison(1, 3), slow);
        target.updateDebuffs(0.1);
        target.applyStatus(poison(10, 0.2), lethal);
        target.hp = 1;
        for (let time = 0; time < 2; time += dt) target.updateDebuffs(dt);
        assert.equal(lethal.kills, 1);
        assert.equal(slow.kills, 0);
        closeTo(lethal.damage, 1);
    }
});

test('bases distintas se resuelven por aplicacion y los buffs no son retroactivos', () => {
    const target = enemy({ hp: 1000 });
    const hero = source('hero');
    hero.damage = 100;
    target.applyStatus({ type: 'poison', power: 0.01, duration: 1 }, source('maxHp'));
    target.applyStatus({ type: 'poison', power: 0.2, duration: 1, damageBasis: 'attackDamage' }, hero);
    hero.damage = 500;
    target.applyStatus(poison(3, 1), source('flat'));
    target.updateDebuffs(1);
    closeTo(target.maxHp - target.hp, 33);
});

test('veneno sin unidad conserva base maxHealth pero admite fracciones y tiempo final', () => {
    const target = enemy({ hp: 100 });
    target.applyStatus({ type: 'poison', power: 0.001, duration: 0.65, stacks: 12 });
    target.updateDebuffs(1);
    closeTo(target.maxHp - target.hp, 0.78);
});

test('dano e icono siguen agrupados sin multiplicar bonus por cantidad de estados', () => {
    const target = enemy();
    target.applyStatus(poison(10, 2, 8));
    const state = buildEnemyStatusPips(target.debuffs);
    assert.equal(target.debuffs.length, 1);
    assert.equal(state.total, 1);
    assert.equal(state.visible[0].stackLabel, 'x8');
    const hero = new Hero(heroes.crystal, 0, 0, { heroes: [], resourceManager: { lives: 20 } });
    closeTo(hero.getConditionalItemDamageMultiplier(target, { statusDamagePct: 0.06 }), 1.06);
});

test('cantidades invalidas no crean estados y peticiones enormes se limitan a doce', () => {
    for (const stacks of [0, -1, NaN, Infinity, 'bad']) {
        const target = enemy();
        assert.equal(target.applyStatus(poison(1, 2, stacks)), false);
        assert.equal(target.debuffs.length, 0);
    }
    const target = enemy();
    target.applyStatus(poison(1, 2, 1000000000));
    assert.equal(target.debuffs[0].applications.length, 12);
});

for (const bossId of ['ultron_prime', 'thanos_final']) {
    test(`${bossId}: cinco heroes aportan su propio veneno con resistencias reales`, () => {
        for (const dt of [1 / 60, 0.1, 10]) {
            const target = enemy({ ...enemies.bosses[bossId], hp: 1000000, barrierRatio: 0 });
            let expected = 0;
            for (const id of ['black_widow', 'blade', 'elsa_bloodstone', 'venom', 'yelena_belova']) {
                const hero = new Hero(heroes[id], 0, 0, { heroes: [], enemies: [target], resourceManager: { lives: 20 }, random: { next: () => 0 } });
                hero.game.heroes.push(hero);
                if (id === 'elsa_bloodstone') {
                    hero.abilitySystem.fateKit.update(4);
                    for (let n = 0; n < 3; n++) hero.abilitySystem.fateKit.onAttack(target, hero.getEffectiveStats(), {});
                }
                const effect = hero.getProjectileEffects(target).find((entry) => entry.type === 'poison');
                CombatSystem.applyEffects([effect], target, hero);
                expected += target.maxHp * effect.power * (effect.stacks || 1) * effect.duration * Math.max(0.2, 1 - target.statusResistance - (target.config.statusResistances?.poison || 0));
            }
            assert.equal(target.debuffs[0].stacks, 6);
            for (let time = 0; time < 10; time += dt) target.updateDebuffs(dt);
            closeTo(target.maxHp - target.hp, expected);
        }
    });
}
