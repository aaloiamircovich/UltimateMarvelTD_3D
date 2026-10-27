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
    const game = { heroes: [], enemies: [], random: { next: () => 0.99 }, resourceManager: { lives: 20, credits: 0 },
        progression: { getHeroBonuses: () => null,
            getHeroEvolution: () => hero ? getEvolutionForHero(hero.config, {}, { level, equippedItemIds: [] }) : null } };
    hero = new Hero({ ...roster[id], level }, 0, 0, game); game.heroes.push(hero);
    const spawn = (x = 80, y = 0, extra = {}) => {
        const e = new Enemy({ id: 'target', category: hero.category, hp: 1e8, speed: 100, ...extra }, [{ x: 0, y: 0 }, { x: 1000, y: 0 }], game);
        Object.assign(e, { x, y, distanceTravelled: x }); game.enemies.push(e); return e;
    };
    const shoot = (target, count = 1) => { const shots = []; for (let i = 0; i < count; i++) hero.shoot(target, hero.getEffectiveStats(), shots); return shots.at(-1); };
    const curse = e => e.applyStatus({ type: 'curse', power: 0.001, duration: 10 }, hero);
    const kill = e => CombatSystem.applyDamage({ damage: e.maxHp * 2, attackerType: hero.category }, e, hero, game.resourceManager, 1);
    return { game, hero, spawn, shoot, curse, kill, kit: hero.abilitySystem.fateKit };
}

for (const level of [1, 49, 50, 51, 99, 100]) {
    test(`Black Cat ${level}: cuarto disparo critico, carga consumida y sin dinero`, () => {
        const f = setup('black_cat', level), e = f.spawn(); f.kit.update(3);
        const power = f.hero.getEffectiveStats().damage; f.shoot(e, 3); assert.equal(f.kit.charge, 3);
        close(f.shoot(e).damage, power * f.hero.getEffectiveStats().critDamage);
        assert.equal(f.hero.combatStats.crits, 1); assert.equal(f.kit.charge, 0); assert.equal(f.kit.cooldown, 3);
        assert.deepEqual(f.game.resourceManager, { lives: 20, credits: 0 });
    });
    test(`Elsa ${level}: tres ataques de preparacion y doble veneno al cuarto impacto`, () => {
        const f = setup('elsa_bloodstone', level), e = f.spawn(80, 0, { threat: 4 }); f.kit.update(4);
        const power = f.hero.getEffectiveStats().damage; f.shoot(e, 3); const shot = f.shoot(e);
        close(shot.damage, power * 1.2); assert.equal(e.debuffs.length, 0);
        CombatSystem.applyImpact(shot, e, f.hero, f.game.resourceManager);
        const poison = e.debuffs.find(s => s.type === 'poison'); assert.equal(poison.stacks, 2);
        close(poison.applications[0].damagePerSecond, e.maxHp * 0.0054);
        assert.equal(f.kit.cooldown, 4); assert.equal(f.kit.charge, 0);
        assert.equal(f.shoot(e).effects.some(s => s.type === 'poison'), false);
    });
    test(`Gambit ${level}: detonacion de4, dos rebotes pero sin propagacion`, () => {
        const f = setup('gambit', level), targets = Array.from({ length: 6 }, (_, i) => f.spawn(80 + i));
        f.kit.update(4); f.shoot(targets[0], 3); assert.ok(targets.every(e => e.hp === e.maxHp));
        const power = f.hero.getEffectiveStats().damage; const shot = f.shoot(targets[0]);
        for (const e of targets.slice(0, 4)) close(e.maxHp - e.hp, power * 0.65);
        for (const e of targets.slice(4)) close(e.hp, e.maxHp);
        assert.equal(shot.chainCount, 2); assert.equal(shot.propagationCount, 0);
        assert.equal(f.hero.combatStats.abilityActivations, 1); assert.equal(f.kit.cooldown, 4);
    });
    test(`Hela ${level}: baja maldita crea espinas diferidas con tres victimas`, () => {
        const f = setup('hela', level), dead = f.spawn(), targets = Array.from({ length: 5 }, (_, i) => f.spawn(90 + i));
        f.kit.update(6); f.curse(dead); f.kill(dead); const damage = f.kit.spine.damage;
        f.kit.update(0.5); assert.ok(targets.every(e => e.hp === e.maxHp)); f.kit.update(0.11);
        for (const e of targets.slice(0, 3)) close(e.maxHp - e.hp, damage);
        for (const e of targets.slice(3)) close(e.hp, e.maxHp);
        assert.equal(f.kit.spine, null); assert.equal(f.hero.combatStats.abilityActivations, 1);
    });
}

for (const id of ['black_cat', 'elsa_bloodstone', 'gambit', 'hela']) {
    for (const action of ['move', 'stun', 'sell']) {
        test(`${id}: ${action} reinicia combo/espinas sin perder nivel ni curar`, () => {
            const f = setup(id, 50), e = f.spawn(80, 0, { threat: 4 }); f.kit.update(6); f.shoot(e, 3);
            if (id === 'hela') { f.curse(e); f.kill(e); }
            if (action === 'move') f.hero.x = 1;
            if (action === 'stun') f.hero.applyStun(1);
            if (action === 'sell') new TacticalActionSystem(f.game).sell(f.hero);
            f.hero.update(0, [], []); assert.ok(f.kit.cooldown > 0); assert.equal(f.kit.charge, 0);
            assert.equal(f.kit.spine, null); assert.equal(f.kit.target, null);
            assert.equal(f.hero.level, 50); assert.deepEqual(f.game.resourceManager, { lives: 20, credits: 0 });
        });
    }
}

test('Black Cat: critico natural reinicia carga, mientras cadencia extrema no saltea cooldown', () => {
    const f = setup('black_cat'), e = f.spawn(); f.kit.update(3); f.shoot(e, 2);
    f.game.random.next = () => 0; f.shoot(e); assert.equal(f.kit.charge, 0);
    f.game.random.next = () => 0.99; f.shoot(e, 4); assert.equal(f.kit.cooldown, 3);
    const crits = f.hero.combatStats.crits; f.shoot(e, 100); assert.equal(f.hero.combatStats.crits, crits);
    f.kit.update(3); f.shoot(e); assert.equal(f.hero.combatStats.crits, crits + 1);
});

for (const id of ['elsa_bloodstone', 'gambit']) {
    test(`${id}: cambiar presa, caducar2.5s y perder cobertura quita carga`, () => {
        const f = setup(id), a = f.spawn(80, 0, { isBoss: true }), b = f.spawn(90, 0, { threat: 4 });
        f.kit.update(4); f.shoot(a, 3); f.shoot(b); assert.equal(f.kit.charge, 1);
        f.kit.update(2.5); assert.equal(f.kit.charge, 0);
        f.shoot(a, 3); a.x = 1000; f.kit.update(0); assert.equal(f.kit.charge, 0);
    });
}

test('Elsa: soldados no cargan, bosses si, veneno resiste y no modifica capas aliadas', () => {
    const f = setup('elsa_bloodstone'), soldier = f.spawn(), boss = f.spawn(90, 0, { isBoss: true, statusResistance: 0.5 });
    f.kit.update(4); f.shoot(soldier, 10); assert.equal(f.kit.charge, 0);
    boss.applyStatus({ type: 'poison', power: 0.001, duration: 10 }, { id: 'ally' });
    f.shoot(boss, 3); CombatSystem.applyImpact(f.shoot(boss), boss, f.hero, f.game.resourceManager);
    const poison = boss.debuffs.find(s => s.type === 'poison'); assert.equal(poison.stacks, 3);
    assert.equal(poison.applications.filter(s => s.source?.id === 'ally').length, 1);
    const own = poison.applications.filter(s => s.source === f.hero); assert.equal(own.length, 2);
    close(own[0].duration, 2);
});

test('Gambit: explosion respeta deteccion, cobertura y borde60 inclusivo', () => {
    const f = setup('gambit'), a = f.spawn(100), edge = f.spawn(160), outside = f.spawn(160.01), hidden = f.spawn(110, 0, { stealth: true }), far = f.spawn(166);
    f.kit.update(4); f.shoot(a, 4); assert.ok(edge.hp < edge.maxHp);
    for (const e of [outside, hidden, far]) close(e.hp, e.maxHp);
    f.shoot(a, 100); assert.equal(f.hero.combatStats.abilityActivations, 1);
});

test('Hela: espinas no encadenan bajas ni estados, y usan poder capturado', () => {
    const f = setup('hela'), a = f.spawn(), b = f.spawn(90, 0, { hp: 1 }), c = f.spawn(100);
    f.kit.update(6); f.curse(a); f.curse(b); f.kill(a); const power = f.kit.spine.damage;
    f.hero.level = 100; f.kit.update(10);
    assert.equal(b.isAlive, false); close(c.maxHp - c.hp, power); assert.equal(c.debuffs.length, 0);
    assert.equal(f.kit.spine, null); assert.equal(f.hero.combatStats.abilityActivations, 1);
    assert.equal(f.hero.combatStats.kills, 2);
});

test('Hela: no arma por baja normal, maldicion vencida, oculto o fuera de alcance', () => {
    for (const mode of ['normal', 'expired', 'hidden', 'outside']) {
        const f = setup('hela'), a = f.spawn(); f.kit.update(6);
        if (mode !== 'normal') f.curse(a);
        if (mode === 'expired') a.debuffs[0].duration = 0;
        if (mode === 'hidden') a.nativeStealth = true;
        if (mode === 'outside') a.x = 2000;
        f.kill(a); assert.equal(f.kit.spine, null); assert.equal(f.kit.cooldown, 0);
    }
});

test('Hela: radio65 fijo y cobertura al detonar; solo una espina por ventana', () => {
    const f = setup('hela'), a = f.spawn(100), second = f.spawn(105), edge = f.spawn(165), out = f.spawn(165.01);
    f.kit.update(6); f.curse(a); f.kill(a); const first = f.kit.spine;
    f.curse(second); f.kill(second); assert.equal(f.kit.spine, first); f.kit.update(0.6);
    assert.ok(edge.hp < edge.maxHp); close(out.hp, out.maxHp); assert.equal(f.hero.combatStats.abilityActivations, 1);
});

test('Cuatro kits: no cargan al atacar muertos o fugados', () => {
    for (const id of ['black_cat', 'elsa_bloodstone', 'gambit', 'hela']) {
        const f = setup(id), e = f.spawn(80, 0, { threat: 4 }); f.kit.update(6);
        e.hasReachedEnd = true; f.kit.onAttack(e, f.hero.getEffectiveStats(), {});
        e.hasReachedEnd = false; e.isAlive = false; f.kit.onAttack(e, f.hero.getEffectiveStats(), {});
        assert.equal(f.kit.charge, 0); assert.equal(f.hero.combatStats.abilityActivations, 0);
    }
});
