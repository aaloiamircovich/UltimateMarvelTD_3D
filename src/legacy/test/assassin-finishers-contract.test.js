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
        const enemy = new Enemy({ id: 'target', category: hero.category, hp: 1e7, speed: 1, ...extra },
            [{ x: 0, y: 0 }, { x: 10000, y: 0 }], game);
        enemy.x = x; enemy.distanceTravelled = x; game.enemies.push(enemy); return enemy;
    };
    const shoot = target => { const shots = []; hero.shoot(target, hero.getEffectiveStats(), shots); return shots[0]; };
    const kit = id === 'gamora' ? hero.abilitySystem.cosmicKit : hero.abilitySystem.streetKit;
    const update = dt => kit.update(dt, game.enemies, hero.getEffectiveStats());
    const bleed = target => target.applyStatus({ type: 'bleed', duration: 10, power: 1 }, hero);
    return { hero, game, spawn, shoot, kit, update, bleed };
}

for (const level of [1, 49, 50, 51, 99, 100]) {
    test(`Gamora ${level}: combo elige dos heridos y no ejecuta secundarios`, () => {
        const f = setup('gamora', level), primary = f.spawn();
        const healthy = f.spawn(70), wounded = f.spawn(50), weak = f.spawn(60);
        wounded.hp *= 0.5; weak.hp *= 0.2;
        const before = [healthy.hp, wounded.hp, weak.hp];
        f.shoot(primary);
        close(healthy.hp, before[0]); assert.ok(wounded.hp < before[1]); assert.ok(weak.hp < before[2]);
        assert.ok(weak.isAlive); assert.equal(f.kit.executionCount, 0);
        primary.hp = primary.maxHp * 0.25; f.shoot(primary);
        assert.equal(primary.isAlive, false); assert.equal(f.kit.executionCount, 1);
        assert.equal(f.hero.combatStats.kills, 1);
        assert.match(f.kit.getDisplayState().label, /Remates 1/);
    });
    test(`Elektra ${level}: remate x1.75, recarga y consumo sin critico garantizado`, () => {
        const f = setup('elektra', level), target = f.spawn(40, { isBoss: true });
        target.hp *= 0.5; f.bleed(target);
        const base = f.hero.getEffectiveStats().damage;
        close(f.shoot(target).damage, base);
        f.update(4); const finisher = f.shoot(target);
        close(finisher.damage, base * 1.75); assert.equal(f.kit.cooldownRemaining, 4);
        assert.equal(f.hero.combatStats.crits, 0); assert.equal(f.hero.combatStats.abilityActivations, 1);
        CombatSystem.applyImpact(finisher, target, f.hero, f.game.resourceManager);
        assert.ok(target.isAlive); close(f.shoot(target).damage, base);
        assert.equal(f.game.resourceManager.lives, 20); assert.equal(f.game.resourceManager.credits, 0);
    });
}

test('Gamora: combo no alcanza fuera de cobertura ni ocultos sin deteccion', () => {
    const f = setup('gamora'), primary = f.spawn(70), outside = f.spawn(100), hidden = f.spawn(60, { stealth: true });
    const stats = { ...f.hero.getEffectiveStats(), range: 90, canSeeStealth: false };
    f.kit.activateGamoraCombo(primary, stats);
    close(outside.hp, outside.maxHp); close(hidden.hp, hidden.maxHp);
    hidden.hp *= 0.2; f.kit.activateGamoraCombo(hidden, stats);
    assert.ok(hidden.isAlive); assert.equal(f.kit.executionCount, 0);
    f.kit.activateGamoraCombo(hidden, { ...stats, canSeeStealth: true });
    assert.equal(hidden.isAlive, false);
});

test('Gamora: empate de salud prioriza avance, no insercion en la lista', () => {
    const f = setup('gamora'), primary = f.spawn(40), back = f.spawn(45), middle = f.spawn(50), front = f.spawn(60);
    f.shoot(primary);
    close(back.hp, back.maxHp); assert.ok(middle.hp < middle.maxHp); assert.ok(front.hp < front.maxHp);
});

for (const reason of ['sano', 'sinSangrado', 'expirado', 'oculto', 'fuera', 'muerto', 'stun']) {
    test(`Elektra: conserva preparacion ante ${reason}`, () => {
        const f = setup('elektra'), target = f.spawn(); target.hp *= 0.5; f.bleed(target); f.update(4);
        if (reason === 'sano') target.hp = target.maxHp * 0.50001;
        if (reason === 'sinSangrado') target.debuffs = [];
        if (reason === 'expirado') target.debuffs[0].duration = 0;
        if (reason === 'oculto') target.stealth = true;
        if (reason === 'fuera') target.x = 10000;
        if (reason === 'muerto') target.isAlive = false;
        if (reason === 'stun') f.hero.stunTimer = 2;
        assert.equal(f.kit.getAttackDamageMultiplier(target), 1);
        f.kit.onAttack(target, f.hero.getEffectiveStats());
        assert.equal(f.kit.cooldownRemaining, 0); assert.equal(f.hero.combatStats.abilityActivations, 0);
    });
}

test('Elektra: recarga no depende de consultas, cambio de blanco o ataques', () => {
    const f = setup('elektra'), a = f.spawn(), b = f.spawn(60);
    for (const target of [a, b]) { target.hp *= 0.4; f.bleed(target); }
    f.update(4); f.shoot(a);
    for (let i = 0; i < 20; i++) { f.shoot(b); f.kit.getDisplayState(); }
    assert.equal(f.kit.cooldownRemaining, 4);
    f.update(3.99); assert.equal(f.kit.isSaiPrepared(b), false);
    f.update(0.02); assert.equal(f.kit.isSaiPrepared(b), true);
    assert.equal(setup('elektra').kit.cooldownRemaining, 4);
});

test('Elektra: remate mantiene armadura y barrera de jefes', () => {
    const f = setup('elektra'), target = f.spawn(40, { isBoss: true, armor: 85, barrierRatio: 0.5 });
    target.hp *= 0.5; f.bleed(target); f.update(4);
    const hp = target.hp, barrier = target.behavior.barrier;
    CombatSystem.applyImpact(f.shoot(target), target, f.hero, f.game.resourceManager);
    close(target.hp, hp); assert.ok(target.behavior.barrier < barrier); assert.ok(target.isAlive);
});
