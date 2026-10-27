import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Hero } from '../src/entities/Hero.js';
import { Enemy } from '../src/entities/Enemy.js';
import { CombatSystem } from '../src/systems/CombatSystem.js';
import { getEvolutionForHero } from '../src/systems/EvolutionSystem.js';

const heroes = JSON.parse(fs.readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8'));
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
function setup(id, level = 1) {
    let hero;
    const game = { heroes: [], enemies: [], random: { next: () => 0.99 },
        resourceManager: { lives: 20, credits: 0, addCredits(n) { this.credits += n; } },
        progression: { getHeroBonuses: () => null, getHeroEvolution: () => hero
            ? getEvolutionForHero(hero.config, {}, { level, equippedItemIds: [] }) : null } };
    hero = new Hero({ ...heroes[id], level }, 0, 0, game); game.heroes = [hero];
    const spawn = (x = 40, extra = {}) => {
        const enemy = new Enemy({ id: 'target', category: hero.category, hp: 1e8, speed: 1, ...extra },
            [{ x: 0, y: 0 }, { x: 10000, y: 0 }], game);
        enemy.x = x; enemy.distanceTravelled = x; game.enemies.push(enemy); return enemy;
    };
    const shoot = target => { const shots = []; hero.shoot(target, hero.getEffectiveStats(), shots); return shots[0]; };
    const kit = hero.abilitySystem.streetKit;
    const update = dt => kit.update(dt, game.enemies, hero.getEffectiveStats());
    return { hero, game, spawn, shoot, kit, update };
}

for (const level of [1, 49, 50, 51, 99, 100]) {
    test(`Moon Knight ${level}: fases con ventajas y debilidades, prioridad intacta`, () => {
        const f = setup('moon_knight', level), target = f.spawn(); f.hero.targetingPriority = 'Jefe';
        const crescent = f.hero.getEffectiveStats();
        assert.equal(f.shoot(target).chainCount, 1);
        f.update(10); const full = f.hero.getEffectiveStats();
        close(full.damage / crescent.damage, 1.3 / 0.9);
        close(full.fireRate / crescent.fireRate, 0.85);
        close(crescent.range / full.range, 1.22);
        close(f.shoot(target).armorPenetration, 0.35);
        f.update(10); const waning = f.hero.getEffectiveStats();
        close(waning.damage, crescent.damage); close(waning.fireRate / crescent.fireRate, 1.16);
        const shot = f.shoot(target); assert.equal(shot.splashRadius, 44);
        close(shot.effects.find(e => e.type === 'slow').power, 0.46);
        f.update(10); assert.equal(f.kit.moonPhase, 0); close(f.kit.moonTimer, 0);
        assert.equal(f.hero.targetingPriority, 'Jefe'); assert.equal(f.hero.abilitySystem.setCombatMode('full'), false);
    });
    test(`Iron Fist ${level}: chi cinco segundos, dano y stun solo preparados`, () => {
        const f = setup('iron_fist', level), target = f.spawn(40, { isBoss: true, statusResistance: 0.5 });
        const base = f.hero.getEffectiveStats().damage;
        const normal = f.shoot(target); close(normal.damage, base); assert.equal(normal.effects.length, 0);
        f.update(5); const charged = f.shoot(target);
        close(charged.damage, base * 1.9); assert.equal(charged.effects.length, 1);
        assert.equal(charged.splashRadius, 0); assert.equal(charged.chainCount, 0);
        CombatSystem.applyImpact(charged, target, f.hero, f.game.resourceManager);
        close(target.debuffs.find(e => e.type === 'stun').duration, target.getStatusDuration('stun', 0.45));
        assert.equal(f.kit.cooldownRemaining, 5); assert.equal(f.hero.combatStats.abilityActivations, 1);
        assert.equal(f.shoot(target).effects.length, 0);
        assert.equal(f.game.resourceManager.lives, 20); assert.equal(f.game.resourceManager.credits, 0);
    });
}

test('Moon Knight: delta largo recorre todas las fases y conserva residuo', () => {
    const f = setup('moon_knight'); f.update(35.25);
    assert.equal(f.kit.moonPhase, 0); close(f.kit.moonTimer, 5.25);
    f.update(15); assert.equal(f.kit.moonPhase, 2); close(f.kit.moonTimer, 0.25);
    assert.match(f.kit.getDisplayState().label, /9.8s > Creciente/);
});

test('Moon Knight: cambio de fase usa alcance nuevo para seleccionar en ese mismo frame', () => {
    const f = setup('moon_knight'); f.kit.moonTimer = 9.9;
    f.spawn(f.hero.range * 1.1);
    const shots = []; f.hero.update(0.2, f.game.enemies, shots);
    assert.equal(f.kit.moonPhase, 1); assert.equal(shots.length, 0);
    // Ready timer ensures range, rather than attack cooldown, prevents the shot.
    f.hero.timer = 100; f.kit.moonPhase = 0; f.kit.moonTimer = 9.9;
    f.hero.update(0.2, f.game.enemies, shots); assert.equal(shots.length, 0);
});

test('Moon Knight: disparo del cambio de fase usa dano y perfil de luna llena', () => {
    const f = setup('moon_knight'), target = f.spawn();
    f.hero.timer = 100; f.kit.moonTimer = 9.9;
    const shots = []; f.hero.update(0.2, [target], shots);
    assert.equal(shots.length, 1); close(shots[0].damage, f.hero.getEffectiveStats().damage);
    close(shots[0].armorPenetration, 0.35);
    f.update(10); close(shots[0].armorPenetration, 0.35);
});

test('Iron Fist: stun inmune no recibe estado, pero mantiene dano del golpe', () => {
    const f = setup('iron_fist'), target = f.spawn(40, { immuneToStun: true }); f.update(5);
    CombatSystem.applyImpact(f.shoot(target), target, f.hero, f.game.resourceManager);
    assert.ok(target.hp < target.maxHp); assert.equal(target.debuffs.length, 0);
});

test('Iron Fist: consultas, movimientos y criticos no evaden ni duplican recarga', () => {
    const f = setup('iron_fist'), target = f.spawn();
    f.update(5); f.game.random.next = () => 0;
    const stats = f.hero.getEffectiveStats(), shot = f.shoot(target);
    close(shot.damage, stats.damage * stats.critDamage * 1.9);
    assert.equal(f.hero.combatStats.crits, 1);
    f.hero.x += 1;
    for (let i = 0; i < 20; i++) { f.shoot(target); f.kit.getDisplayState(); }
    assert.equal(f.kit.cooldownRemaining, 5);
    f.update(4.99); assert.equal(f.kit.isChiPrepared(), false);
    f.update(0.02); assert.equal(f.kit.isChiPrepared(), true);
    assert.equal(setup('iron_fist').kit.cooldownRemaining, 5);
});

test('Iron Fist: el proyectil perdido consume chi y la base no recibe curacion', () => {
    const f = setup('iron_fist'), target = f.spawn(); f.update(5);
    const shot = f.shoot(target); target.isAlive = false; shot.update(1);
    assert.equal(f.kit.cooldownRemaining, 5); assert.equal(f.hero.combatStats.damageDealt, 0);
    assert.equal(f.game.resourceManager.lives, 20);
});

test('Iron Fist: aturdido no dispara ni libera chi preparado', () => {
    const f = setup('iron_fist'); f.spawn(); f.update(5); f.hero.stunTimer = 2;
    const shots = []; f.hero.update(0.5, f.game.enemies, shots);
    assert.equal(shots.length, 0); assert.equal(f.kit.isChiPrepared(), false);
    assert.equal(f.kit.cooldownRemaining, 0);
});
