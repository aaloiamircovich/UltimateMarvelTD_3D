import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Hero } from '../src/entities/Hero.js';
import { Enemy } from '../src/entities/Enemy.js';

const roster = JSON.parse(fs.readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8'));
const closeTo = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

function setup(id) {
    const game = { heroes: [], enemies: [], resourceManager: { lives: 20, credits: 0 }, random: { next: () => 0.5 } };
    const addHero = (heroId, x = 0) => {
        const hero = new Hero(roster[heroId], x, 0, game);
        game.heroes.push(hero);
        return hero;
    };
    const hero = addHero(id);
    if (id === 'groot') hero.abilitySystem.cosmicKit.cooldownRemaining = 0;
    const spawn = (x, config = {}) => {
        const enemy = new Enemy({ id: 'target', hp: 10000, speed: 40, category: hero.category, ...config }, [{ x: 0, y: 0 }, { x: 2000, y: 0 }], game);
        enemy.x = x;
        enemy.distanceTravelled = x;
        game.enemies.push(enemy);
        return enemy;
    };
    return { game, hero, addHero, spawn };
}

test('Groot no crea raices sobre ocultos sin deteccion ni gasta cooldown', () => {
    const { hero, game, spawn } = setup('groot');
    spawn(100, { stealth: true });
    const kit = hero.abilitySystem.cosmicKit;
    kit.update(0, game.enemies, hero.getEffectiveStats());
    assert.equal(kit.rootWall, null);
    assert.equal(kit.cooldownRemaining, 0);
    assert.equal(hero.combatStats.abilityActivations, 0);
});

test('Groot usa deteccion efectiva, alcance 1.35x inclusivo y prioridad por avance', () => {
    const { hero, game, spawn } = setup('groot');
    const kit = hero.abilitySystem.cosmicKit;
    const stats = { ...hero.getEffectiveStats(), canSeeStealth: true };
    const range = stats.range * 1.35;
    spawn(range + 0.01);
    const dead = spawn(range);
    dead.isAlive = false;
    kit.update(0, game.enemies, stats);
    assert.equal(kit.rootWall, null);
    spawn(range * 0.8);
    const hidden = spawn(range, { stealth: true });
    kit.update(0, game.enemies, stats);
    assert.equal(kit.rootWall.x, hidden.x);
    assert.equal(kit.rootWall.duration, 3.2);
    assert.equal(kit.rootWall.radius, 48);
    assert.equal(kit.cooldownRemaining, 10);
});

test('raices existentes conservan centro y slow incidental, sin revelar ni desplazar', () => {
    const { hero, game, spawn } = setup('groot');
    const kit = hero.abilitySystem.cosmicKit;
    const stats = hero.getEffectiveStats();
    const anchor = spawn(stats.range * 1.35);
    kit.update(0, game.enemies, stats);
    const center = kit.rootWall.x;
    anchor.isAlive = false;
    const hidden = spawn(center + 48, { stealth: true });
    const outside = spawn(center + 48.01);
    kit.update(0.1, game.enemies, stats);
    assert.equal(kit.rootWall.x, center);
    assert.equal(hidden.x, center + 48);
    assert.equal(hidden.stealth, true);
    assert.equal(hidden.hp, hidden.maxHp);
    assert.equal(hidden.debuffs[0].type, 'slow');
    closeTo(hidden.debuffs[0].power, 0.68);
    closeTo(hidden.debuffs[0].duration, 3.1);
    assert.equal(outside.debuffs.length, 0);
    assert.equal(hero.combatStats.abilityActivations, 1);
});

test('Groot no reemplaza raices activas ni las recrea durante cooldown', () => {
    const { hero, game, spawn } = setup('groot');
    const kit = hero.abilitySystem.cosmicKit;
    const stats = hero.getEffectiveStats();
    const anchor = spawn(100);
    kit.update(0, game.enemies, stats);
    spawn(150);
    kit.update(0.1, game.enemies, stats);
    assert.equal(kit.rootWall.x, anchor.x);
    kit.update(3.2, game.enemies, stats);
    assert.equal(kit.rootWall, null);
    assert.ok(kit.cooldownRemaining > 0);
    assert.equal(hero.combatStats.abilityActivations, 1);
});

for (const [mode, radius, factor, cooldown] of [['recon', 1.85, 0.38, 2.4], ['assault', 1.45, 0.72, 1.65]]) {
    test(`Redwing ${mode}: alcance extendido, dano y cooldown propios sin gasto vacio`, () => {
        const { hero, game, spawn } = setup('falcon');
        const kit = hero.abilitySystem.avengerKit;
        kit.setMode(mode);
        const stats = hero.getEffectiveStats();
        const range = stats.range * radius;
        spawn(range + 0.01);
        kit.update(0, game.enemies, stats);
        assert.equal(kit.cooldownRemaining, 0);
        const target = spawn(range, { stealth: true, flying: true });
        kit.update(0, game.enemies, stats);
        closeTo(target.maxHp - target.hp, stats.damage * factor * kit.getPowerScale());
        closeTo(kit.cooldownRemaining, cooldown);
        assert.equal(target.debuffs.some((entry) => entry.type === 'mark'), mode === 'recon');
        assert.equal(target.stealth, mode !== 'recon');
        kit.update(0, game.enemies, stats);
        assert.equal(hero.combatStats.abilityActivations, 1);
    });
}

test('Redwing recon prioriza ocultos/soportes por avance; asalto solo avance', () => {
    for (const mode of ['recon', 'assault']) {
        const { hero, game, spawn } = setup('falcon');
        const kit = hero.abilitySystem.avengerKit;
        kit.setMode(mode);
        const hidden = spawn(120, { stealth: true });
        const support = spawn(140, { archetype: 'support' });
        const soldier = spawn(160);
        const dead = spawn(180, { stealth: true });
        dead.isAlive = false;
        kit.update(0, game.enemies, hero.getEffectiveStats());
        assert.equal(hidden.hp, hidden.maxHp);
        assert.equal(support.hp < support.maxHp, mode === 'recon');
        assert.equal(soldier.hp < soldier.maxHp, mode === 'assault');
    }
});

test('deteccion de Falcon termina al aturdirse y vuelve al recuperarse', () => {
    const { hero: falcon, addHero } = setup('falcon');
    const ally = addHero('hulk', 100);
    assert.equal(ally.getEffectiveStats().canSeeStealth, true);
    falcon.applyStun(2);
    assert.equal(ally.getEffectiveStats().canSeeStealth, false);
    falcon.update(2, [], []);
    assert.equal(ally.getEffectiveStats().canSeeStealth, true);
});

test('deteccion compartida depende de radio 165; Redwing revela solo al identificado', () => {
    const { hero: falcon, game, addHero, spawn } = setup('falcon');
    const near = addHero('hulk', 165);
    const far = addHero('hulk', 165.01);
    const hidden = spawn(180, { stealth: true });
    falcon.abilitySystem.update(0, game.enemies, falcon.getEffectiveStats(), []);
    assert.ok(hidden.debuffs.some((entry) => entry.type === 'mark'));
    assert.equal(hidden.stealth, false);
    assert.equal(near.getBestTarget([hidden], near.getEffectiveStats()), hidden);
    assert.equal(far.getBestTarget([hidden], far.getEffectiveStats()), hidden);
    falcon.abilitySystem.setCombatMode('assault');
    assert.equal(near.getEffectiveStats().canSeeStealth, false);
    falcon.abilitySystem.setCombatMode('recon');
    game.heroes = [near, far];
    assert.equal(near.getEffectiveStats().canSeeStealth, false);
});

test('otro Falcon activo mantiene deteccion y el stun no borra deteccion innata', () => {
    const { hero: falcon, addHero } = setup('falcon');
    const second = addHero('falcon');
    const ally = addHero('hulk');
    const detector = addHero('wolverine');
    falcon.applyStun(2);
    assert.equal(ally.getEffectiveStats().canSeeStealth, true);
    second.applyStun(2);
    assert.equal(ally.getEffectiveStats().canSeeStealth, false);
    assert.equal(detector.getEffectiveStats().canSeeStealth, true);
});

for (const [id, multiplier, cooldown] of [['jean_grey', 1.2, 12], ['scarlet_witch', 1.25, 9]]) {
    test(`${id}: pulso radial alcanza ocultos y punto ciego sin fijar blanco ni revelar`, () => {
        const { hero, game, spawn } = setup(id);
        hero.rangePattern = 'ring';
        const kit = hero.abilitySystem.mutantKit;
        kit.resource = 100;
        kit.cooldownRemaining = 0;
        const stats = { ...hero.getEffectiveStats(), canSeeStealth: false };
        const target = spawn(10, { stealth: true, flying: true });
        assert.equal(hero.getBestTarget([target], stats), null);
        kit.update(0, game.enemies, stats);
        assert.equal(kit.cooldownRemaining, cooldown);
        if (id === 'jean_grey') kit.update(0.6, game.enemies, stats);
        assert.equal(target.stealth, true);
        assert.equal(target.x, 10);
        if (id === 'jean_grey') assert.ok(target.hp < target.maxHp);
        else assert.equal(target.debuffs[0].type, 'slow');
        assert.equal(game.resourceManager.lives, 20);
    });

    test(`${id}: pulso respeta radio inclusivo, muertos, cooldown y recurso`, () => {
        const { hero, game, spawn } = setup(id);
        const kit = hero.abilitySystem.mutantKit;
        kit.resource = 100;
        kit.cooldownRemaining = 0;
        const stats = hero.getEffectiveStats();
        const range = stats.range * multiplier;
        const outside = spawn(range + 0.01);
        const dead = spawn(50);
        dead.isAlive = false;
        kit.update(0, game.enemies, stats);
        assert.equal(kit.cooldownRemaining, 0);
        assert.equal(kit.resource, 100);
        const target = spawn(range);
        kit.cooldownRemaining = 1;
        kit.update(0, game.enemies, stats);
        assert.equal(target.hp, target.maxHp);
        assert.equal(target.debuffs.length, 0);
        kit.cooldownRemaining = 0;
        if (id === 'jean_grey') {
            kit.resource = 99;
            kit.update(0, game.enemies, stats);
            assert.equal(kit.cooldownRemaining, 0);
            kit.resource = 100;
        }
        kit.update(0, game.enemies, stats);
        assert.equal(kit.cooldownRemaining, cooldown);
        assert.equal(kit.resource, id === 'jean_grey' ? 0 : 100);
        if (id === 'jean_grey') kit.update(0.6, game.enemies, stats);
        assert.equal(outside.hp, outside.maxHp);
        assert.equal(outside.debuffs.length, 0);
        assert.equal(dead.hp, dead.maxHp);
        assert.equal(dead.debuffs.length, 0);
    });
}

test('Phoenix conserva dano base/evolucion y retroceso reducido de jefes, no de voladores', () => {
    for (const evolved of [false, true]) {
        const { hero, game, spawn } = setup('jean_grey');
        if (evolved) game.progression = { getHeroBonuses: () => null, getHeroEvolution: () => ({ id: 'phoenix' }) };
        const kit = hero.abilitySystem.mutantKit;
        kit.resource = 100;
        kit.cooldownRemaining = 0;
        const stats = hero.getEffectiveStats();
        const soldier = spawn(120);
        const boss = spawn(150, { isBoss: true });
        const flyer = spawn(180, { flying: true });
        kit.update(0, game.enemies, stats);
        kit.update(0.6, game.enemies, stats);
        for (const enemy of [soldier, boss, flyer]) closeTo(enemy.maxHp - enemy.hp, stats.damage * (evolved ? 1.25 : 0.95) * kit.getPowerScale());
        closeTo(soldier.x, 72);
        closeTo(boss.x, 130);
        closeTo(flyer.x, 180);
    }
});

test('Hex respeta resistencia de jefe en duracion sin cambiar intensidad', () => {
    const { hero, game, spawn } = setup('scarlet_witch');
    const target = spawn(100, { isBoss: true, statusResistance: 0.4, statusResistances: { slow: 0.3 } });
    hero.abilitySystem.mutantKit.update(0, game.enemies, hero.getEffectiveStats());
    closeTo(target.debuffs[0].duration, 3.2 * 0.3);
    closeTo(target.debuffs[0].power, 0.58);
    assert.equal(target.hp, target.maxHp);
});
