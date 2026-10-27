import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Hero } from '../src/entities/Hero.js';
import { Enemy } from '../src/entities/Enemy.js';
import { CombatSystem } from '../src/systems/CombatSystem.js';
import { getHeroDamageAtLevel } from '../src/utils/HeroLevel.js';

const items = JSON.parse(fs.readFileSync(new URL('../data/items.json', import.meta.url), 'utf8'));
const heroes = JSON.parse(fs.readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8'));
const game = () => ({ heroes: [], enemies: [], resourceManager: { lives: 20 }, random: { next: () => 0 } });
const enemy = (hp = 100000) => new Enemy({ id: 'boss', hp, speed: 10 }, [{ x: 100, y: 0 }, { x: 500, y: 0 }]);
function heroWith(item, level = 1) {
    const hero = new Hero({ id: 'training', damage: getHeroDamageAtLevel(40, level, 'Rare'), level, range: 200, fireRate: 1, rarity: 'Rare' }, 0, 0, game());
    hero.items = [item];
    return hero;
}

for (const id of ['emisor_termico', 'protocolo_extremis', 'formula_phoenix']) {
    test(`${id}: quemadura escala con nivel y no con salud maxima`, () => {
        let previous = 0;
        for (const level of [1, 50, 100]) {
            const hero = heroWith(items[id], level);
            const effect = hero.getProjectileEffects().find((e) => e.type === 'burn');
            assert.equal(effect.damageBasis, 'attackDamage');
            assert.equal(effect.chance, items[id].effects.burnChance);
            assert.equal(effect.duration, items[id].effects.burnDuration);
            const dps = hero.getEffectiveStats().damage * items[id].effects.burnAttackDamagePct;
            assert.ok(dps > previous);
            previous = dps;
            for (const hp of [100000, 1000000]) {
                const target = enemy(hp);
                CombatSystem.applyEffects([effect], target, hero);
                target.updateDebuffs(1);
                assert.ok(Math.abs(hp - target.hp - dps) < 1e-6);
            }
        }
    });
}

test('quemadura de objeto respeta probabilidad cero y poder cero explicito', () => {
    const hero = heroWith({ effects: { burnChance: 0, burnAttackDamagePct: 0.3 } });
    assert.equal(hero.getProjectileEffects().length, 0);
    hero.items = [{ effects: { burnChance: 1, burnAttackDamagePct: 0 } }];
    const target = enemy();
    CombatSystem.applyEffects(hero.getProjectileEffects(), target, hero);
    target.updateDebuffs(1);
    assert.equal(target.hp, 100000);
});

test('objetos legacy con burnPower mantienen dano plano y minimo por tick', () => {
    const hero = heroWith({ effects: { burnChance: 1, burnPower: 0.012 } });
    const effect = hero.getProjectileEffects()[0];
    assert.equal(effect.damageBasis, undefined);
    const target = enemy();
    CombatSystem.applyEffects([effect], target, hero);
    target.updateDebuffs(1);
    assert.equal(target.hp, 99998);
});

test('Extremis captura buffs efectivos sin cobrar dos veces el bono por baja vida', () => {
    const hero = heroWith(items.protocolo_extremis);
    hero.game.resourceManager.lives = 10;
    const target = enemy();
    const expected = 40 * 1.18 * 1.18 * 0.18;
    CombatSystem.applyEffects(hero.getProjectileEffects(), target, hero);
    hero.game.resourceManager.lives = 20;
    target.updateDebuffs(1);
    assert.ok(Math.abs(100000 - target.hp - expected) < 1e-6);
});

test('Sentry conserva la quemadura mas fuerte sin sumar la de su objeto', () => {
    const hero = new Hero(heroes.sentry, 0, 0, game());
    hero.items = [items.emisor_termico];
    const target = enemy();
    const expected = hero.getEffectiveStats().damage * 0.3;
    CombatSystem.applyEffects(hero.getProjectileEffects(target), target, hero);
    assert.equal(target.debuffs.filter((e) => e.type === 'burn').length, 1);
    target.updateDebuffs(1);
    assert.ok(Math.abs(100000 - target.hp - expected) < 1e-6);
});

test('Formula Phoenix quema solo al principal y el bonus condicionado no multiplica el DoT', () => {
    const hero = heroWith(items.formula_phoenix);
    const primary = enemy();
    const secondary = enemy();
    secondary.x = 120;
    hero.game.enemies = [primary, secondary];
    CombatSystem.applyImpact({ damage: 40, attackerType: 'neutral', effects: hero.getProjectileEffects(primary), splashRadius: 44, splashFactor: 0.28 }, primary, hero);
    assert.equal(secondary.debuffs.length, 0);
    assert.equal(primary.debuffs[0].damagePerSecond, 12);
    assert.equal(hero.getConditionalItemDamageMultiplier(primary, items.formula_phoenix.effects), 1.25);
});

test('solo el primer objeto puede generar quemadura y soportes no disparan', () => {
    const hero = heroWith(items.emisor_termico);
    hero.items.push(items.formula_phoenix);
    assert.equal(hero.getProjectileEffects()[0].power, 0.12);
    const support = new Hero(heroes.capitan_america, 0, 0, game());
    support.items = [items.formula_phoenix];
    const projectiles = [];
    support.update(5, [enemy()], projectiles);
    assert.equal(projectiles.length, 0);
    assert.equal(support.game.resourceManager.lives, 20);
});
