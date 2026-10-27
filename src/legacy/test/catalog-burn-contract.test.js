import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Hero } from '../src/entities/Hero.js';
import { Enemy } from '../src/entities/Enemy.js';
import { CombatSystem } from '../src/systems/CombatSystem.js';

const heroes = JSON.parse(fs.readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8'));
const items = JSON.parse(fs.readFileSync(new URL('../data/items.json', import.meta.url), 'utf8'));
const makeHero = (id) => new Hero(heroes[id], 0, 0, {
    heroes: [], enemies: [], resourceManager: { lives: 20 }, random: { next: () => 0 }
});
const makeEnemy = (x = 100) => new Enemy({ id: 'dummy', hp: 100000, speed: 10 }, [{ x, y: 0 }, { x: 500, y: 0 }]);
const closeTo = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);

test('Captain Marvel captura energia una vez sin modificar quemaduras existentes', () => {
    const hero = makeHero('captain_marvel');
    const kit = hero.abilitySystem.cosmicKit;
    for (const charge of [0, 60, 100]) {
        kit.resource = charge;
        const target = makeEnemy();
        const dps = heroes.captain_marvel.damage * (1 + charge * 0.0035) * 0.095;
        CombatSystem.applyEffects(hero.getProjectileEffects(target), target, hero);
        closeTo(target.debuffs[0].damagePerSecond, dps);
        kit.resource = charge === 0 ? 100 : 0;
        target.updateDebuffs(1);
        closeTo(100000 - target.hp, dps);
    }
});

for (const id of ['war_machine', 'human_torch']) {
    test(`${id}: explosion dana vecinos pero quema solamente al principal`, () => {
        const hero = makeHero(id);
        const primary = makeEnemy();
        const secondary = makeEnemy(120);
        const outside = makeEnemy(200);
        hero.game.enemies = [primary, secondary, outside];
        const profile = hero.getProjectileProfile();
        const damage = hero.getEffectiveStats().damage;
        const result = CombatSystem.applyImpact({ ...profile, damage, attackerType: 'neutral', effects: hero.getProjectileEffects(primary) }, primary, hero);
        assert.equal(result.hits, 2);
        closeTo(100000 - primary.hp, damage);
        closeTo(100000 - secondary.hp, damage * profile.splashFactor);
        assert.equal(outside.hp, 100000);
        assert.equal(secondary.debuffs.length, 0);
        assert.equal(primary.debuffs.length, 1);
        assert.equal(primary.debuffs[0].type, 'burn');
        closeTo(primary.debuffs[0].damagePerSecond, damage * heroes[id].special.attackEffects[0].power);
    });
}

for (const [id, chance, duration, initialDps] of [
    ['captain_marvel', 0.34, 3.6, 8.075],
    ['war_machine', 0.18, 2.4, 4.9],
    ['human_torch', 0.34, 2.5, 12]
]) {
    test(`${id}: conserva duracion y probabilidad, con potencia inicial equivalente`, () => {
        const hero = makeHero(id);
        const effect = hero.getProjectileEffects(makeEnemy()).find((entry) => entry.type === 'burn');
        assert.equal(effect.chance, chance);
        assert.equal(effect.duration, duration);
        closeTo(hero.getEffectiveStats().damage * effect.power, initialDps);
        for (const [roll, expected] of [[chance - 0.001, 1], [chance, 0], [0.999, 0]]) {
            hero.game.random.next = () => roll;
            const target = makeEnemy();
            CombatSystem.applyEffects([effect], target, hero);
            assert.equal(target.debuffs.length, expected);
        }
    });

    test(`${id}: fuego de objeto y nativo conservan solo el DPS mas fuerte`, () => {
        const hero = makeHero(id);
        hero.items = [items.formula_phoenix];
        const target = makeEnemy();
        const expected = hero.getEffectiveStats().damage * Math.max(heroes[id].special.attackEffects[0].power, 0.3);
        CombatSystem.applyEffects(hero.getProjectileEffects(target), target, hero);
        assert.equal(target.debuffs.filter((entry) => entry.type === 'burn').length, 1);
        target.updateDebuffs(1);
        closeTo(100000 - target.hp, expected);
    });
}

test('quemaduras y sangrados del catalogo declaran su base de dano', () => {
    let count = 0;
    for (const [id, config] of Object.entries(heroes)) {
        for (const effect of config.special?.attackEffects || []) {
            if (!['burn', 'bleed'].includes(effect.type)) continue;
            count++;
            assert.equal(effect.damageBasis, 'attackDamage', `${id}: ${effect.type}`);
        }
    }
    assert.ok(count >= 12, 'La comprobacion debe recorrer efectos reales del catalogo');
});
