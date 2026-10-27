import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Hero } from '../src/entities/Hero.js';
import { Enemy } from '../src/entities/Enemy.js';
import { CombatSystem } from '../src/systems/CombatSystem.js';
import { getHeroDamageAtLevel } from '../src/utils/HeroLevel.js';

const heroes = JSON.parse(fs.readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8'));
const items = JSON.parse(fs.readFileSync(new URL('../data/items.json', import.meta.url), 'utf8'));
function hero(id, level = 1) {
    const config = heroes[id];
    const unit = new Hero({ ...config, level, damage: getHeroDamageAtLevel(config.damage, level, config.rarity) }, 0, 0,
        { heroes: [], enemies: [], resourceManager: { lives: 20 }, random: { next: () => 0 } });
    if (id === 'star_lord') unit.abilitySystem.setCombatMode('incendiary');
    return unit;
}
const enemy = (config = {}, x = 100) => new Enemy({ id: 'dummy', hp: 100000, speed: 10, ...config }, [{ x, y: 0 }, { x: x + 500, y: 0 }]);

for (const id of ['hela', 'blade', 'ghost_rider', 'star_lord']) {
    test(`${id}: DoT escala con el poder en 1/30/50/100 y no con HP del enemigo`, () => {
        let previous = 0;
        for (const level of [1, 30, 50, 100]) {
            const unit = hero(id, level);
            const target = enemy({ isBoss: true });
            const effects = unit.getProjectileEffects(target).filter((e) => ['burn', 'bleed'].includes(e.type));
            assert.equal(effects.length, 1);
            const effect = effects[0];
            assert.equal(effect.damageBasis, 'attackDamage');
            const dps = unit.getEffectiveStats().damage * effect.power;
            assert.ok(dps > previous);
            previous = dps;
            for (const hp of [100000, 1000000]) {
                const victim = enemy({ hp, isBoss: true });
                CombatSystem.applyEffects(effects, victim, unit);
                victim.updateDebuffs(2);
                assert.ok(Math.abs(hp - victim.hp - 2 * dps) < 1e-6);
            }
        }
    });
}

test('Blade refuerza sangrado solo con amenaza 4+ o jefe y conserva toxina', () => {
    const unit = hero('blade');
    for (const [config, power, duration] of [[{ threat: 3 }, 0.21, 3.6], [{ threat: 4 }, 0.3, 5], [{ threat: 1, isBoss: true }, 0.3, 5]]) {
        const effects = unit.getProjectileEffects(enemy(config));
        const bleed = effects.find((e) => e.type === 'bleed');
        assert.equal(bleed.power, power);
        assert.equal(bleed.duration, duration);
        assert.equal(bleed.chance, 1);
        assert.equal(effects.find((e) => e.type === 'poison').power, 0.0038);
    }
});

test('Hela conserva maldicion porcentual separada del sangrado por poder', () => {
    const unit = hero('hela');
    const target = enemy();
    CombatSystem.applyEffects(unit.getProjectileEffects(target), target, unit);
    assert.equal(target.debuffs.find((d) => d.type === 'curse').damagePerSecond, 420);
    assert.equal(target.debuffs.find((d) => d.type === 'bleed').damagePerSecond, 69 * 0.24);
});

test('Ghost Rider no duplica fuego ni suma quemaduras al equipar objeto', () => {
    const unit = hero('ghost_rider');
    assert.equal(unit.getProjectileEffects().filter((e) => e.type === 'burn').length, 1);
    unit.items = [items.emisor_termico];
    const target = enemy();
    CombatSystem.applyEffects(unit.getProjectileEffects(target), target, unit);
    assert.equal(target.debuffs.length, 1);
    assert.equal(target.debuffs[0].duration, 4);
    assert.equal(target.debuffs[0].damagePerSecond, 68 * 0.135);
    assert.equal(unit.game.resourceManager.lives, 20);
});

test('cambiar municion no transforma proyectiles emitidos ni estados ya aplicados', () => {
    const unit = hero('star_lord');
    const fire = unit.getProjectileEffects();
    const target = enemy();
    CombatSystem.applyEffects(fire, target, unit);
    unit.abilitySystem.setCombatMode('cryo');
    assert.equal(unit.getProjectileEffects()[0].type, 'slow');
    assert.equal(fire[0].type, 'burn');
    assert.equal(target.debuffs[0].damagePerSecond, 30 * 0.23);
    unit.abilitySystem.setCombatMode('plasma');
    assert.equal(unit.getProjectileEffects().length, 0);
    assert.equal(unit.abilitySystem.getProjectileProfile().armorPenetration, 0.28);
});

test('segundo blaster respeta sigilo, rango efectivo y no repite el blanco principal', () => {
    const unit = hero('star_lord');
    unit.game.heroes = [unit];
    unit.abilitySystem.setCombatMode('cryo');
    unit.abilitySystem.cosmicKit.update(1, [], unit.getEffectiveStats());
    const primary = enemy({}, 80);
    const hidden = enemy({ stealth: true }, 90);
    const distant = enemy({}, 230);
    unit.game.enemies = [primary, hidden, distant];
    const config = { damage: 30, attacker: unit, effects: unit.getProjectileEffects(primary) };
    const stats = { ...unit.getEffectiveStats(), range: 250, canSeeStealth: false };
    const projectiles = [];
    unit.abilitySystem.cosmicKit.fireSecondBlaster(primary, config, projectiles, stats);
    assert.equal(projectiles[0].target, distant);
    assert.equal(projectiles[0].effects[0].damageBasis, 'flat');
    assert.equal(projectiles[0].effects[0].type, 'burn');
    unit.abilitySystem.cosmicKit.update(1, [], unit.getEffectiveStats());
    projectiles.length = 0;
    unit.game.enemies = [primary, hidden];
    unit.abilitySystem.cosmicKit.fireSecondBlaster(primary, config, projectiles, stats);
    assert.equal(projectiles.length, 0);
    unit.abilitySystem.cosmicKit.fireSecondBlaster(primary, config, projectiles, { ...stats, canSeeStealth: true });
    assert.equal(projectiles[0].target, hidden);
});

test('segundo blaster conserva el patron geometrico y rechaza enemigos muertos', () => {
    const unit = hero('star_lord');
    unit.game.heroes = [unit];
    unit.abilitySystem.cosmicKit.update(1, [], unit.getEffectiveStats());
    unit.rangePattern = 'ring';
    const primary = enemy({}, 120);
    const inner = enemy({}, 10);
    const dead = enemy({}, 150);
    dead.isAlive = false;
    unit.game.enemies = [primary, inner, dead];
    const projectiles = [];
    unit.abilitySystem.cosmicKit.fireSecondBlaster(primary, { damage: 30 }, projectiles, { range: 200, canSeeStealth: true });
    assert.equal(projectiles.length, 0);
});
