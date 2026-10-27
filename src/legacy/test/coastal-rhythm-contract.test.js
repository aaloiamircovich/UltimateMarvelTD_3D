import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Hero } from '../src/entities/Hero.js';
import { Enemy } from '../src/entities/Enemy.js';
import { CombatSystem } from '../src/systems/CombatSystem.js';
import { TacticalActionSystem } from '../src/systems/TacticalActionSystem.js';
import { getEvolutionForHero } from '../src/systems/EvolutionSystem.js';

const roster = JSON.parse(fs.readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8'));
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
function setup(id, level = 1) {
    let hero;
    const game = { heroes: [], enemies: [], gridSize: 32, terrainMap: [[0, 1, 3]], random: { next: () => 0.99 },
        resourceManager: { lives: 20, credits: 0 }, progression: { getHeroBonuses: () => null,
            getHeroEvolution: () => hero ? getEvolutionForHero(hero.config, {}, { level, equippedItemIds: [] }) : null } };
    hero = new Hero({ ...roster[id], level }, 0, 0, game); game.heroes.push(hero);
    const spawn = (x = 80, y = 0, extra = {}) => {
        const e = new Enemy({ id: 'target', category: hero.category, hp: 1e8, speed: 100, ...extra }, [{ x: 0, y: 0 }, { x: 1000, y: 0 }], game);
        Object.assign(e, { x, y, distanceTravelled: x }); game.enemies.push(e); return e;
    };
    const shoot = target => { const shots = []; hero.shoot(target, hero.getEffectiveStats(), shots); return shots[0]; };
    return { game, hero, spawn, shoot, kit: hero.abilitySystem.coastalKit };
}

for (const level of [1, 49, 50, 51, 99, 100]) {
    test(`Namora ${level}: primera presa preparada, ruptura solo al impacto y cooldown`, () => {
        const f = setup('namora', level), a = f.spawn(), b = f.spawn(81);
        const damage = f.hero.getEffectiveStats().damage;
        f.kit.update(3); const shot = f.shoot(a); close(shot.damage, damage * 1.65);
        assert.equal(a.debuffs.length, 0);
        CombatSystem.applyImpact(shot, a, f.hero, f.game.resourceManager);
        assert.equal(a.debuffs[0].type, 'armorBreak'); close(a.debuffs[0].power, 0.16);
        f.kit.update(3); close(f.shoot(a).damage, damage); assert.equal(f.kit.cooldown, 0);
        close(f.shoot(b).damage, damage * 1.65); assert.equal(f.kit.cooldown, 3);
        assert.equal(f.hero.getProjectileProfile().armorPenetration, 0.22);
    });
    test(`Triton ${level}: sonar de tres ocultos con alcance y duracion local`, () => {
        const f = setup('triton', level), a = f.spawn(), hidden = Array.from({ length: 5 }, (_, i) => f.spawn(81 + i, 0, { stealth: true }));
        f.kit.update(6); f.shoot(a);
        assert.equal(hidden.filter(e => !e.stealth).length, 3);
        close(hidden[0].debuffs[0].duration, 3); assert.equal(f.kit.cooldown, 6);
        hidden[0].updateDebuffs(3); assert.equal(hidden[0].stealth, true);
        const ally = new Hero(roster.hulk, 0, 0, f.game); f.game.heroes.push(ally);
        assert.equal(ally.getEffectiveStats().canSeeStealth, false);
    });
    test(`Jeff ${level}: corriente90x44 y solo terrestres dentro del tramo`, () => {
        const f = setup('jeff_the_land_shark', level), a = f.spawn(), edge = f.spawn(125, 22), outside = f.spawn(125.01, 0), fly = f.spawn(90, 0, { flying: true });
        f.kit.update(6); f.shoot(a);
        for (const e of [a, edge, outside, fly]) e.updateDebuffs(0);
        close(a.speed, 55); close(edge.speed, 55); close(outside.speed, 100); close(fly.speed, 100);
        assert.equal(a.x, 80); assert.equal(a.hp, a.maxHp); assert.equal(f.game.resourceManager.lives, 20);
        assert.equal(f.hero.getProjectileEffects(a).length, 0);
    });
    test(`Luna ${level}: cuatro victimas, alternancia25/50 y sin congelacion`, () => {
        const f = setup('luna_snow', level), targets = Array.from({ length: 6 }, (_, i) => f.spawn(80 + i));
        f.kit.update(1.5); f.shoot(targets[0]);
        assert.equal(targets.filter(e => e.debuffs.length).length, 4);
        close(targets[0].debuffs[0].power, 0.25);
        targets.forEach(e => e.updateDebuffs(0.9)); f.kit.update(1.5); f.shoot(targets[0]);
        close(targets[0].debuffs[0].power, 0.5); close(targets[0].debuffs[0].duration, 0.9);
        assert.ok(targets.every(e => e.frost.stacks === 0 && !e.debuffs.some(s => s.type === 'stun')));
        assert.equal(f.hero.getProjectileProfile().splashRadius, 38);
    });
}

for (const id of ['namora', 'triton', 'jeff_the_land_shark', 'luna_snow']) {
    for (const action of ['move', 'stun', 'sell']) {
        test(`${id}: ${action} reinicia preparacion sin perder nivel ni curar`, () => {
            const f = setup(id, 50), e = f.spawn(); f.kit.update(6); f.shoot(e);
            if (action === 'move') f.hero.x = 32;
            if (action === 'stun') f.hero.applyStun(2);
            if (action === 'sell') new TacticalActionSystem(f.game).sell(f.hero);
            f.hero.update(0, f.game.enemies, []); e.updateDebuffs(0);
            assert.ok(f.kit.cooldown > 0); assert.equal(f.kit.field, null); assert.equal(f.kit.beat, 0);
            if (id === 'jeff_the_land_shark') close(e.speed, 100);
            assert.equal(f.hero.level, 50); assert.equal(f.game.resourceManager.lives, 20); assert.equal(f.game.resourceManager.credits, 0);
        });
    }
}

test('Namora: disparar durante preparacion consume primera oportunidad; mover no borra historial', () => {
    const f = setup('namora'), e = f.spawn(), damage = f.hero.getEffectiveStats().damage;
    close(f.shoot(e).damage, damage); f.kit.update(3); close(f.shoot(e).damage, damage);
    f.hero.x = 1; f.kit.update(0); f.kit.update(3); close(f.shoot(e).damage, damage);
});

test('Namora y Triton: solo agua real habilita especial, no el permiso de objeto', () => {
    for (const id of ['namora', 'triton']) {
        const f = setup(id), e = f.spawn(80, 0, { stealth: id === 'triton' });
        f.hero.x = 32; f.kit.update(0); f.kit.update(6);
        const shot = f.shoot(e); close(shot.damage, f.hero.getEffectiveStats().damage);
        assert.equal(e.debuffs.length, 0); assert.equal(f.hero.combatStats.abilityActivations, 0);
        assert.equal(f.hero.getProjectileEffects(e).length, 0);
    }
});

test('Triton: sonar vacio no consume, radio65 inclusivo y cobertura limita revelado', () => {
    const f = setup('triton'), a = f.spawn(100); f.kit.update(6); f.shoot(a); assert.equal(f.kit.cooldown, 0);
    const edge = f.spawn(165, 0, { stealth: true }), outside = f.spawn(165.01, 0, { stealth: true }), outOfRange = f.spawn(170, 0, { stealth: true });
    f.shoot(a); assert.equal(edge.stealth, false); assert.equal(outside.stealth, true); assert.equal(outOfRange.stealth, true);
});

test('Triton: revela voladores, respeta resistencia y no renueva con cadencia extrema', () => {
    const f = setup('triton'), e = f.spawn(80, 0, { flying: true, stealth: true, statusResistance: 0.5 });
    f.kit.update(6); f.shoot(e); close(e.debuffs[0].duration, 1.5);
    e.updateDebuffs(1); for (let i = 0; i < 30; i++) f.shoot(e);
    close(e.debuffs[0].duration, 0.5); assert.equal(f.hero.combatStats.abilityActivations, 1);
});

test('Jeff: salir y finalizar campo conservan slow aliado', () => {
    const f = setup('jeff_the_land_shark'), e = f.spawn(); f.kit.update(6); f.shoot(e);
    e.applyStatus({ type: 'slow', duration: 10, power: 0.1 }, { id: 'ally' });
    e.y = 23; e.updateDebuffs(0); close(e.speed, 90);
    assert.equal(e.debuffs.length, 1); assert.equal(e.debuffs[0].source.id, 'ally');
    f.kit.update(2.5); assert.equal(f.kit.field, null); assert.equal(f.kit.cooldown, 3.5);
});

test('Jeff: campo incidental no revela ocultos y no consume al disparar a volador', () => {
    const f = setup('jeff_the_land_shark'), fly = f.spawn(80, 0, { flying: true });
    f.kit.update(6); f.shoot(fly); assert.equal(f.kit.cooldown, 0);
    const ground = f.spawn(), hidden = f.spawn(90, 0, { stealth: true }); f.shoot(ground);
    assert.equal(hidden.stealth, true); assert.equal(hidden.debuffs[0].type, 'slow');
});

test('Jeff: diagonal, inmunidad y duracion resistida sin renovacion', () => {
    const f = setup('jeff_the_land_shark'), a = f.spawn(60, 60), immune = f.spawn(61, 61, { immuneToSlow: true }), boss = f.spawn(62, 62, { isBoss: true, statusResistance: 0.5 });
    f.kit.update(6); f.shoot(a); close(boss.debuffs[0].duration, 1.25); assert.equal(immune.debuffs.length, 0);
    boss.updateDebuffs(1.25); f.kit.update(1.25); boss.updateDebuffs(0); close(boss.speed, 100);
    assert.equal(boss.x, 62); assert.equal(boss.hp, boss.maxHp);
});

test('Luna: inmunidad, resistencia y cooldown independiente de velocidad', () => {
    const f = setup('luna_snow'), a = f.spawn(80, 0, { immuneToSlow: true }), b = f.spawn(81, 0, { statusResistance: 0.5 });
    f.kit.update(1.5); f.shoot(a); assert.equal(a.debuffs.length, 0); close(b.debuffs[0].duration, 0.45);
    for (let i = 0; i < 50; i++) f.shoot(a);
    assert.equal(f.kit.beat, 1); assert.equal(f.hero.combatStats.abilityActivations, 1);
});

test('Luna: pulso50px inclusivo y no extiende cobertura propia', () => {
    const f = setup('luna_snow'), a = f.spawn(130), edge = f.spawn(180), outside = f.spawn(180.01);
    f.kit.update(1.5); f.shoot(a); assert.equal(edge.debuffs.length, 1); assert.equal(outside.debuffs.length, 0);
});

test('Cuatro kits: ninguna activacion con objetivo muerto o fugado', () => {
    for (const id of ['namora', 'triton', 'jeff_the_land_shark', 'luna_snow']) {
        const f = setup(id), e = f.spawn(); f.kit.update(6); e.hasReachedEnd = true;
        f.kit.onAttack(e, f.hero.getEffectiveStats()); e.hasReachedEnd = false; e.isAlive = false;
        f.kit.onAttack(e, f.hero.getEffectiveStats()); assert.equal(f.hero.combatStats.abilityActivations, 0);
    }
});
