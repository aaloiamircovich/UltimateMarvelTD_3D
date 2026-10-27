import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Hero } from '../src/entities/Hero.js';
import { Enemy } from '../src/entities/Enemy.js';

const roster = JSON.parse(fs.readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8'));
const contracts = [
    { id: 'hulk', kit: 'avengerKit', range: 2.25, cost: 50, cooldown: 8 },
    { id: 'wolverine', kit: 'mutantKit', range: 3, cost: 55, cooldown: 7 },
    { id: 'storm', kit: 'mutantKit', range: 1, cost: 0, cooldown: 9 },
    { id: 'ghost_rider', kit: 'streetKit', range: 1.3, cost: 0, cooldown: 11 }
];

function setup(contract) {
    const rings = [];
    const beams = [];
    const game = {
        heroes: [], enemies: [], resourceManager: { lives: 20, credits: 0 },
        random: { next: () => 0.5 },
        vfx: { addRing: (x, y, options) => rings.push({ x, y, ...options }), addBurst() {}, addBeam: (from, to) => beams.push({ x: to.x, y: to.y }) }
    };
    const hero = new Hero(roster[contract.id], 0, 0, game);
    game.heroes = [hero];
    const kit = hero.abilitySystem[contract.kit];
    if (['storm', 'ghost_rider'].includes(contract.id)) kit.cooldownRemaining = 0;
    kit.resource = 80;
    const stats = { ...hero.getEffectiveStats(), canSeeStealth: false };
    const reach = stats.range * contract.range;
    const spawn = (x = reach * 0.7, overrides = {}) => {
        const target = new Enemy({ id: 'target', hp: 100000, speed: 40, category: hero.category, isBoss: contract.id === 'ghost_rider', ...overrides }, [{ x: 0, y: 0 }, { x: 2000, y: 0 }], game);
        target.x = x;
        target.y = 0;
        target.distanceTravelled = x;
        game.enemies.push(target);
        return target;
    };
    const update = (dt = 0) => kit.update(dt, game.enemies, stats);
    const center = () => contract.id === 'hulk' ? rings.at(-1)
        : contract.id === 'wolverine' ? kit.jumpOrigin && { x: hero.x, y: hero.y + 30 }
            : contract.id === 'storm' ? kit.weatherZone : beams.at(-1);
    return { game, hero, kit, stats, reach, spawn, update, center };
}

for (const contract of contracts) {
    test(`${contract.id}: sin deteccion no fija ocultos ni consume habilidad`, () => {
        const f = setup(contract);
        const hidden = f.spawn(undefined, { stealth: true });
        f.update();
        assert.equal(f.kit.resource, 80);
        assert.equal(f.kit.cooldownRemaining, 0);
        assert.equal(hidden.hp, hidden.maxHp);
        assert.equal(f.hero.combatStats.abilityActivations, 0);
        assert.equal(Boolean(f.center()), false);
    });

    test(`${contract.id}: elige el mas avanzado valido, no ocultos ni muertos`, () => {
        const f = setup(contract);
        f.spawn(f.reach * 0.95, { stealth: true });
        const dead = f.spawn(f.reach * 0.9);
        dead.isAlive = false;
        f.spawn(f.reach * 0.5);
        const selected = f.spawn(f.reach * 0.7);
        f.update();
        assert.equal(f.center().x, selected.x);
        assert.equal(f.center().y, selected.y);
        assert.equal(f.kit.resource, 80 - contract.cost);
        assert.equal(f.kit.cooldownRemaining, contract.cooldown);
    });

    test(`${contract.id}: alcance especial inclusivo y deteccion efectiva de voladores`, () => {
        const f = setup(contract);
        const outside = f.spawn(f.reach + 0.01, { stealth: true, flying: true });
        f.stats.canSeeStealth = true;
        f.update();
        assert.equal(f.kit.cooldownRemaining, 0);
        const boundary = f.spawn(f.reach, { stealth: true, flying: true });
        f.update();
        assert.equal(f.center().x, boundary.x);
        assert.equal(f.kit.cooldownRemaining, contract.cooldown);
        // The outside enemy may receive incidental AoE, but cannot anchor the ability.
        assert.notEqual(f.center().x, outside.x);
    });

    test(`${contract.id}: cooldown bloquea una nueva activacion`, () => {
        const f = setup(contract);
        const target = f.spawn();
        f.kit.cooldownRemaining = 1;
        f.update();
        assert.equal(f.kit.resource, 80);
        assert.equal(f.kit.cooldownRemaining, 1);
        assert.equal(target.hp, target.maxHp);
    });
}

test('Storm no centra una zona en el punto ciego, incluso con deteccion', () => {
    const f = setup(contracts[2]);
    f.stats.canSeeStealth = true;
    f.spawn(f.stats.range * 0.38 - 0.01);
    f.update();
    assert.equal(f.kit.weatherZone, null);
    assert.equal(f.kit.cooldownRemaining, 0);
    const boundary = f.spawn(f.stats.range * 0.38);
    f.update();
    assert.equal(f.kit.weatherZone.x, boundary.x);
});

test('Hulk conserva dano y stun incidentales a ocultos fuera de su alcance especial', () => {
    const f = setup(contracts[0]);
    const anchor = f.spawn(f.reach);
    const hidden = f.spawn(f.reach + 50, { stealth: true });
    const outside = f.spawn(f.reach + 73);
    f.update();
    assert.equal(f.center().x, anchor.x);
    assert.ok(hidden.hp < hidden.maxHp);
    assert.ok(hidden.debuffs.some((entry) => entry.type === 'stun'));
    assert.equal(hidden.stealth, true);
    assert.equal(outside.hp, outside.maxHp);
});

for (const mode of ['blizzard', 'lightning']) {
    test(`Storm ${mode}: zona ya creada alcanza ocultos en el punto ciego sin revelarlos`, () => {
        const f = setup(contracts[2]);
        f.kit.setMode(mode);
        const anchor = f.spawn(f.stats.range * 0.4);
        const hidden = f.spawn(f.stats.range * 0.3, { stealth: true });
        const outside = f.spawn(anchor.x + 73, { stealth: true });
        f.update();
        assert.equal(f.kit.weatherZone.x, anchor.x);
        anchor.isAlive = false;
        f.update(0.8);
        if (mode === 'blizzard') assert.ok(hidden.debuffs.some((entry) => entry.type === 'slow'));
        else assert.ok(hidden.hp < hidden.maxHp);
        assert.equal(hidden.stealth, true);
        assert.equal(outside.hp, outside.maxHp);
        assert.equal(outside.debuffs.length, 0);
        assert.equal(f.kit.weatherZone.x, anchor.x);
    });
}

test('Wolverine conserva dano, coste y regreso despues del salto detectado', () => {
    const f = setup(contracts[1]);
    f.stats.canSeeStealth = true;
    const target = f.spawn(undefined, { stealth: true });
    f.update();
    assert.ok(Math.abs(target.maxHp - target.hp - f.stats.damage * 1.25 * f.kit.getPowerScale()) < 1e-6);
    assert.equal(f.kit.resource, 25);
    f.update(0.81);
    assert.equal(f.hero.x, 0);
    assert.equal(f.hero.y, 0);
    assert.equal(f.kit.jumpOrigin, null);
});

test('Penitencia excluye soldados y conserva formula y limite de dano contra jefes', () => {
    for (const hp of [100, 100000]) {
        const f = setup(contracts[3]);
        const soldier = f.spawn(f.reach, { isBoss: false });
        f.update();
        assert.equal(f.kit.cooldownRemaining, 0);
        const boss = f.spawn(undefined, { hp });
        boss.hp = hp * 0.5;
        const before = boss.hp;
        const expected = Math.min(hp * 0.12, f.stats.damage * 2.5 * f.kit.getPowerScale());
        f.update();
        assert.equal(f.center().x, boss.x);
        assert.ok(Math.abs(before - boss.hp - expected) < 1e-6);
        assert.equal(soldier.hp, soldier.maxHp);
    }
});

test('Hulk y Storm reciben deteccion real de Falcon para sus habilidades autonomas', () => {
    for (const contract of [contracts[0], contracts[2]]) {
        const f = setup(contract);
        const falcon = new Hero(roster.falcon, 0, 0, f.game);
        f.game.heroes.push(falcon);
        const hidden = f.spawn(undefined, { stealth: true });
        const stats = f.hero.getEffectiveStats();
        assert.equal(stats.canSeeStealth, true);
        f.hero.abilitySystem.update(0, f.game.enemies, stats, []);
        assert.equal(f.center().x, hidden.x);
        assert.ok(f.kit.cooldownRemaining > 0);
    }
});
