import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Hero } from '../src/entities/Hero.js';
import { Enemy } from '../src/entities/Enemy.js';
import { TacticalActionSystem } from '../src/systems/TacticalActionSystem.js';
import { getEvolutionForHero } from '../src/systems/EvolutionSystem.js';
import { canPlaceOnTerrain } from '../src/utils/TerrainRules.js';

const roster = JSON.parse(fs.readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8'));
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
function setup(id, level = 1) {
    let hero;
    const game = { heroes: [], enemies: [], gridSize: 32, terrainMap: [[0, 1, 3]],
        random: { next: () => 0.99 }, resourceManager: { lives: 20, credits: 0 },
        progression: { getHeroBonuses: () => null, getHeroEvolution: () => hero
            ? getEvolutionForHero(hero.config, {}, { level, equippedItemIds: [] }) : null } };
    hero = new Hero({ ...roster[id], level }, 0, 0, game); game.heroes.push(hero);
    const spawn = (x = 100, y = 0, extra = {}) => {
        const e = new Enemy({ id: 'target', hp: 1e8, speed: 100, category: hero.category, ...extra }, [{ x: 0, y: 0 }, { x: 1000, y: 0 }], game);
        Object.assign(e, { x, y, distanceTravelled: x }); game.enemies.push(e); return e;
    };
    const shoot = e => { const shots = []; hero.shoot(e, hero.getEffectiveStats(), shots); return shots[0]; };
    const update = dt => {
        hero.abilitySystem.elementalKit?.update(dt);
        hero.abilitySystem.update(dt, game.enemies, hero.getEffectiveStats(), []);
    };
    return { game, hero, spawn, shoot, update, kit: hero.abilitySystem.elementalKit, weather: hero.abilitySystem.mutantKit };
}

for (const level of [1, 49, 50, 51, 99, 100]) {
    test(`Iceman ${level}: tres exposiciones, cuatro victimas y pausa compartida`, () => {
        const f = setup('iceman', level), targets = Array.from({ length: 6 }, (_, i) => f.spawn(100 + i));
        for (let i = 0; i < 3; i++) { f.update(1); f.shoot(targets[0]); }
        assert.equal(targets.filter(e => e.debuffs.some(s => s.type === 'stun')).length, 4);
        close(targets[0].frost.cooldown, 4.6);
        for (let i = 0; i < 50; i++) f.shoot(targets[0]);
        assert.equal(f.hero.combatStats.abilityActivations, 3);
        assert.equal(f.hero.getProjectileEffects().length, 0);
        assert.equal(f.hero.getProjectileProfile().splashRadius, 44);
    });
    test(`Storm ${level}: zona captura modo y dano, cinco pulsos a cuatro victimas`, () => {
        const f = setup('storm', level), targets = Array.from({ length: 6 }, (_, i) => f.spawn(130 + i));
        f.weather.setMode('lightning'); f.update(9);
        const zone = f.weather.weatherZone, damage = zone.damage;
        f.weather.setMode('blizzard'); f.hero.damage *= 10;
        f.update(4.2);
        assert.equal(targets.filter(e => e.hp < e.maxHp).length, 4);
        close(targets.at(-1).maxHp - targets.at(-1).hp, damage * 5);
        assert.ok(targets.every(e => !e.debuffs.length));
        assert.equal(f.weather.weatherZone, null); close(f.weather.cooldownRemaining, 4.8);
        assert.equal(zone.mode, 'lightning');
    });
    test(`Crystal ${level}: fuego, hielo y rayos separados sin objeto`, () => {
        const f = setup('crystal', level), a = f.spawn(), b = f.spawn(110), c = f.spawn(120), d = f.spawn(130);
        const damage = f.hero.getEffectiveStats().damage;
        f.update(2); const fire = f.shoot(a); assert.equal(fire.color, '#f97316');
        assert.equal(a.debuffs.length, 1); assert.equal(a.debuffs[0].type, 'burn'); close(a.debuffs[0].damagePerSecond, damage * 0.15);
        a.updateDebuffs(2); f.update(2); const ice = f.shoot(a); assert.equal(ice.color, '#a7f3ff');
        assert.equal(a.debuffs.length, 1); assert.equal(a.debuffs[0].type, 'slow');
        a.updateDebuffs(2); f.update(2); const lightning = f.shoot(a); assert.equal(lightning.color, '#fff19c');
        close(b.maxHp - b.hp, damage * 0.5); close(c.maxHp - c.hp, damage * 0.5); assert.equal(d.hp, d.maxHp);
        assert.match(f.kit.getDisplayState().label, /Fuego/); assert.equal(f.hero.getProjectileProfile().splashRadius, 46);
    });
    test(`Namor ${level}: tierra viable, agua20% y marea tras tres ataques`, () => {
        const f = setup('namor', level), a = f.spawn(60), targets = Array.from({ length: 5 }, (_, i) => f.spawn(61 + i));
        const damage = f.hero.getEffectiveStats().damage;
        f.update(6);
        for (let i = 0; i < 3; i++) close(f.shoot(a).damage, damage * 1.2);
        assert.ok(targets.every(e => e.hp === e.maxHp)); f.shoot(a);
        assert.equal(targets.filter(e => e.hp < e.maxHp).length, 3); close(targets[0].maxHp - targets[0].hp, damage * 0.6);
        f.hero.x = 32; f.update(0); close(f.shoot(a).damage, damage);
        assert.equal(f.kit.charge, 0); assert.equal(f.hero.getProjectileProfile().armorPenetration, 0.24);
        assert.equal(canPlaceOnTerrain(f.hero, 0), true); assert.equal(canPlaceOnTerrain(f.hero, 1), true);
        assert.equal(canPlaceOnTerrain(f.hero, 2), false); assert.equal(canPlaceOnTerrain(f.hero, 3), false);
    });
}

for (const id of ['iceman', 'crystal', 'namor', 'storm']) {
    for (const action of ['move', 'stun', 'sell']) {
        test(`${id}: ${action} cancela preparacion o campo sin alterar niveles`, () => {
            const f = setup(id, 50), e = f.spawn(); f.update(9); f.shoot(e);
            if (id === 'storm') f.update(0.1);
            if (action === 'move') f.hero.x = 32;
            if (action === 'stun') f.hero.applyStun(2);
            if (action === 'sell') new TacticalActionSystem(f.game).sell(f.hero);
            f.hero.update(0, f.game.enemies, []);
            if (id === 'storm') { assert.equal(f.weather.weatherZone, null); e.updateDebuffs(0); close(e.speed, 100); }
            else { assert.ok(f.kit.cooldown > 0); assert.equal(f.kit.element, 0); assert.equal(f.kit.charge, 0); }
            assert.equal(f.hero.level, 50); assert.equal(f.game.resourceManager.lives, 20); assert.equal(f.game.resourceManager.credits, 0);
        });
    }
}

test('Iceman: escarcha caduca y la inmunidad no encadena congelaciones', () => {
    const f = setup('iceman'), e = f.spawn(100, 0, { immuneToStun: true, immuneToSlow: true });
    e.applyFrost(f.hero); e.updateDebuffs(3); assert.equal(e.frost.stacks, 0);
    for (let i = 0; i < 10; i++) e.applyFrost(f.hero);
    assert.equal(e.debuffs.length, 0); assert.equal(e.frost.cooldown, 4); assert.equal(e.frost.stacks, 0);
});

test('Iceman: resistencia reduce stun y no elimina recuperacion propia del enemigo', () => {
    const f = setup('iceman'), e = f.spawn(100, 0, { statusResistance: 0.5 });
    for (let i = 0; i < 3; i++) e.applyFrost(f.hero);
    close(e.debuffs.find(s => s.type === 'stun').duration, 0.3); close(e.frost.cooldown, 4.3);
    e.debuffs = [];
    for (let i = 0; i < 10; i++) e.applyFrost({ ...f.hero, recordStatusApplied() {} });
    assert.equal(e.frost.stacks, 0); assert.ok(!e.debuffs.some(s => s.type === 'stun'));
});

test('Iceman: 60s de exposicion extrema dejan al menos50s de movimiento', () => {
    const f = setup('iceman'), e = f.spawn(); let movable = 0;
    for (let tick = 0; tick < 6000; tick++) {
        e.applyFrost(f.hero); e.updateDebuffs(0.01); if (e.speed > 0) movable += 0.01;
    }
    assert.ok(movable >= 50, `${movable}s`); assert.equal(e.x, 100);
});

test('Rafagas elementales excluyen ocultos, muertos y fuera de cobertura', () => {
    for (const id of ['iceman', 'crystal', 'namor']) {
        const f = setup(id), range = f.hero.getEffectiveStats().range;
        const a = f.spawn(range - 1), hidden = f.spawn(range - 2, 0, { stealth: true }), outside = f.spawn(range + 1), dead = f.spawn(range - 3);
        dead.isAlive = false; f.update(9);
        if (id === 'crystal') f.kit.element = 2;
        if (id === 'namor') f.kit.charge = 3;
        f.shoot(a);
        for (const e of [hidden, outside, dead]) { assert.equal(e.hp, e.maxHp); assert.equal(e.frost.stacks, 0); assert.equal(e.debuffs.length, 0); }
    }
});

test('Storm: cambio repetido de modo no regenera zona ni cooldown', () => {
    const f = setup('storm'), e = f.spawn(130); f.update(9); const zone = f.weather.weatherZone;
    for (let i = 0; i < 30; i++) f.weather.setMode(i % 2 ? 'blizzard' : 'lightning');
    f.update(0.1); assert.equal(f.weather.weatherZone, zone); assert.equal(zone.mode, 'blizzard');
    assert.equal(e.hp, e.maxHp); close(e.debuffs[0].power, 0.55); close(f.weather.cooldownRemaining, 8.9);
});

test('Storm: salida de ventisca conserva slow aliado y respeta resistencia', () => {
    const f = setup('storm'), e = f.spawn(130, 0, { statusResistance: 0.5 });
    f.update(9); f.update(0.2); close(e.debuffs[0].duration, 2);
    e.applyStatus({ type: 'slow', power: 0.1, duration: 10 }, { id: 'ally' });
    e.x += 73; e.updateDebuffs(0); close(e.speed, 90);
    assert.equal(e.debuffs.length, 1); assert.equal(e.debuffs[0].source.id, 'ally');
});

test('Storm: ticks por dt grande o pequeno producen mismo dano', () => {
    const run = steps => {
        const f = setup('storm'), e = f.spawn(130); f.weather.setMode('lightning'); f.update(9);
        for (const dt of steps) f.update(dt);
        return e.maxHp - e.hp;
    };
    close(run([4.2]), run(Array(42).fill(0.1)));
});

test('Namor: pausa3s, suelo seco y mapa ausente no generan marea', () => {
    const f = setup('namor'), e = f.spawn(60); f.update(6); for (let i = 0; i < 3; i++) f.shoot(e);
    f.update(3); assert.equal(f.kit.charge, 0);
    f.game.terrainMap = null; close(f.shoot(e).damage, f.hero.getEffectiveStats().damage); assert.equal(f.kit.charge, 0);
});

test('Crystal: cooldown bloquea ciclo acelerado; quemadura captura poder al emitir', () => {
    const f = setup('crystal'), e = f.spawn(); f.update(2); f.shoot(e);
    const dps = e.debuffs[0].damagePerSecond; f.hero.damage *= 5;
    for (let i = 0; i < 50; i++) f.shoot(e);
    assert.equal(f.kit.element, 1); close(e.debuffs[0].damagePerSecond, dps);
    assert.equal(f.hero.combatStats.abilityActivations, 1);
});
