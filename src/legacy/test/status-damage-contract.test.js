import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Enemy } from '../src/entities/Enemy.js';
import { Hero } from '../src/entities/Hero.js';
import { CombatSystem } from '../src/systems/CombatSystem.js';
import { resolveStatusDamage } from '../src/utils/StatusDamage.js';
import { getHeroDamageAtLevel } from '../src/utils/HeroLevel.js';

const heroes = JSON.parse(fs.readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8'));
const enemy = (hp = 1000) => new Enemy({ id: 'dummy', hp, speed: 10 }, [{ x: 0, y: 0 }, { x: 500, y: 0 }]);
const game = () => ({ heroes: [], enemies: [], resourceManager: { lives: 20 }, random: { next: () => 0 } });

test('DoT explicito diferencia dano plano, del atacante y salud maxima', () => {
    for (const [damageBasis, expected] of [['flat', 0.5], ['attackDamage', 50], ['maxHealth', 500]]) {
        const target = enemy();
        target.applyStatus({ type: 'burn', duration: 2, power: 0.5, damageBasis }, { damage: 100 });
        target.updateDebuffs(1);
        assert.equal(1000 - target.hp, expected);
    }
});

test('DoT captura el dano efectivo al aplicar, sin cambiar retroactivamente', () => {
    const target = enemy();
    let damage = 100;
    const source = { getEffectiveStats: () => ({ damage }) };
    target.applyStatus({ type: 'burn', duration: 2, power: 0.3, damageBasis: 'attackDamage' }, source);
    damage = 500;
    target.updateDebuffs(1);
    assert.equal(target.hp, 970);
});

test('DoT rechaza bases desconocidas, negativos y resultados no finitos', () => {
    for (const effect of [
        { damageBasis: 'enemyDamage', power: 1 },
        { damageBasis: 'flat', power: -1 },
        { damageBasis: 'attackDamage', power: Infinity },
        { damageBasis: 'attackDamage', power: Number.MAX_VALUE }
    ]) {
        const target = enemy();
        assert.equal(target.applyStatus({ type: 'burn', ...effect }, { damage: 100 }), false);
        assert.equal(target.debuffs.length, 0);
    }
    assert.equal(resolveStatusDamage({ type: 'burn', power: 0, damageBasis: 'flat' }, enemy()).damagePerSecond, 0);
});

test('DoT heredado mantiene quemadura plana, minimo por tick y veneno porcentual', () => {
    for (const [type, power, expected] of [['burn', 12, 12], ['burn', 0.006, 2], ['bleed', 0.005, 2], ['poison', 0.01, 10], ['curse', 0.02, 20]]) {
        const target = enemy();
        target.applyStatus({ type, duration: 2, power });
        target.updateDebuffs(1);
        assert.equal(1000 - target.hp, expected, type);
    }
});

test('refrescar DoT conserva el DPS y credito mas fuertes entre distintas bases', () => {
    const target = enemy(20);
    const kills = [];
    const strong = { damage: 100, recordKill: (_resources, victim) => kills.push(victim) };
    const weak = { recordKill: () => assert.fail('La fuente debil no debe robar la baja') };
    target.applyStatus({ type: 'burn', power: 0.3, damageBasis: 'attackDamage', duration: 1 }, strong);
    target.applyStatus({ type: 'burn', power: 2, damageBasis: 'flat', duration: 2 }, weak);
    assert.equal(target.debuffs[0].damagePerSecond, 30);
    assert.equal(target.debuffs[0].duration, 2);
    target.updateDebuffs(2);
    target.updateDebuffs(2);
    assert.deepEqual(kills, [target]);
});

test('una aplicacion mas fuerte reemplaza DPS y propietario, no suma quemaduras', () => {
    const target = enemy();
    const source = { damage: 100 };
    target.applyStatus({ type: 'burn', power: 2, duration: 2 });
    target.applyStatus({ type: 'burn', power: 0.3, damageBasis: 'attackDamage', duration: 2 }, source);
    assert.equal(target.debuffs.length, 1);
    assert.equal(target.debuffs[0].source, source);
    target.updateDebuffs(1);
    assert.equal(target.hp, 970);
});

test('veneno conserva el limite compartido de doce acumulaciones', () => {
    const target = enemy();
    for (let i = 0; i < 20; i++) target.applyStatus({ type: 'poison', power: 0.001, duration: 2 });
    assert.equal(target.debuffs[0].stacks, 12);
    target.updateDebuffs(1);
    assert.equal(target.hp, 988);
});

for (const id of ['sentry', 'x_23', 'drax', 'tigra', 'howard_the_duck', 'valkyrie', 'elektra', 'deadpool', 'captain_marvel', 'war_machine', 'human_torch']) {
    test(`${id}: DoT real escala por nivel y no por salud del jefe`, () => {
        const results = [];
        for (const level of [1, 30, 50, 100]) {
            const config = heroes[id];
            const hero = new Hero({ ...config, level, damage: getHeroDamageAtLevel(config.damage, level, config.rarity) }, 0, 0, game());
            const effect = heroes[id].special.attackEffects[0];
            assert.equal(effect.damageBasis, 'attackDamage');
            const stats = hero.getEffectiveStats();
            for (const hp of [100000, 1000000]) {
                const target = enemy(hp);
                CombatSystem.applyEffects(hero.getProjectileEffects(target), target, hero);
                target.updateDebuffs(2);
                assert.ok(Math.abs(hp - target.hp - stats.damage * effect.power * 2) < 1e-6);
                assert.equal(hero.game.resourceManager.lives, 20);
            }
            results.push(stats.damage * effect.power);
        }
        assert.ok(results.every((dps, index) => index === 0 || dps > results[index - 1]));
    });
}

test('Hero transmite la victima a los kits al registrar una baja', () => {
    const hero = new Hero(heroes.x_23, 0, 0, game());
    const target = enemy();
    let victim;
    hero.abilitySystem.onKill = (killed) => { victim = killed; };
    hero.recordKill(hero.game.resourceManager, target);
    assert.equal(victim, target);
    assert.equal(hero.combatStats.kills, 1);
});
