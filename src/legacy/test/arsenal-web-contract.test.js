import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Hero } from '../src/entities/Hero.js';
import { Enemy } from '../src/entities/Enemy.js';
import { CombatSystem } from '../src/systems/CombatSystem.js';
import { TacticalActionSystem } from '../src/systems/TacticalActionSystem.js';
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
    const spawn = (extra = {}) => {
        const enemy = new Enemy({ id: 'target', category: hero.category, hp: 1e8, speed: 100, ...extra },
            [{ x: 40, y: 0 }, { x: 1000, y: 0 }], game);
        game.enemies.push(enemy); return enemy;
    };
    const shoot = target => { const shots = []; hero.shoot(target, hero.getEffectiveStats(), shots); return shots[0]; };
    const hit = shot => CombatSystem.applyImpact(shot, shot.target, hero, game.resourceManager);
    const kit = hero.abilitySystem.martialKit;
    const update = dt => kit?.update(dt);
    return { hero, game, spawn, shoot, hit, kit, update };
}
const web = { type: 'web', duration: 2.6, power: 0.2 };

for (const level of [1, 49, 50, 51, 99, 100]) {
    test(`Deadpool ${level}: 3 pistolas, 2 katanas y recarga real sin disparos`, () => {
        const f = setup('deadpool', level), target = f.spawn(), damage = f.hero.getEffectiveStats().damage;
        assert.equal(f.shoot(target), undefined); assert.equal(f.hero.combatStats.shots, 0); f.update(1.2);
        for (let i = 0; i < 3; i++) { const shot = f.shoot(target); close(shot.damage, damage); assert.equal(shot.visualStyle, 'ballistic'); }
        assert.equal(f.hero.getEffectiveStats().range, 90);
        for (let i = 0; i < 2; i++) { const shot = f.shoot(target); close(shot.damage, damage * 1.5); assert.equal(shot.visualStyle, 'blade'); }
        assert.equal(f.kit.cooldown, 1.2); assert.equal(f.hero.combatStats.shots, 5);
        for (let i = 0; i < 10; i++) assert.equal(f.shoot(target), undefined);
        assert.equal(f.hero.combatStats.shots, 5); f.update(1.19); assert.equal(f.shoot(target), undefined);
        f.update(0.02); assert.equal(f.shoot(target).visualStyle, 'ballistic');
    });
    test(`Devil Dinosaur ${level}: quorum3, mordida y cuatro vecinos, recarga6s`, () => {
        const f = setup('devil_dinosaur', level), targets = Array.from({ length: 7 }, (_, i) => { const e = f.spawn({ statusResistance: 0.5 }); e.x += i; return e; });
        const damage = f.hero.getEffectiveStats().damage; f.update(6);
        close(f.shoot(targets[0]).damage, damage); close(f.shoot(targets[0]).damage, damage);
        close(f.shoot(targets[0]).damage, damage * 1.65);
        assert.equal(targets.filter(e => e.hp < e.maxHp).length, 4);
        assert.equal(targets.filter(e => e.debuffs.some(s => s.type === 'stun')).length, 5);
        close(targets[1].maxHp - targets[1].hp, damage * 0.35);
        close(targets[0].debuffs[0].duration, targets[0].getStatusDuration('stun', 0.3));
        assert.equal(f.kit.cooldown, 6); assert.equal(f.kit.charge, 0);
        assert.equal(f.hero.getProjectileEffects(targets[0]).length, 0); assert.equal(f.hero.getProjectileProfile().splashRadius, 58);
    });
    test(`Peter ${level}: umbral de evolucion y pausa compartida despues del stun`, () => {
        const f = setup('spiderman', level), target = f.spawn();
        const effect = f.hero.getProjectileEffects(target).find(e => e.type === 'web');
        const threshold = f.game.progression.getHeroEvolution()?.id === 'iron_spider' ? 2 : 3;
        for (let i = 0; i < threshold; i++) target.applyStatus(effect, f.hero);
        close(target.webBindCooldown, 2.7); assert.ok(target.debuffs.some(e => e.type === 'stun'));
        for (let i = 0; i < 30; i++) target.applyStatus(effect, f.hero);
        assert.equal(f.hero.combatStats.abilityActivations, 1);
        assert.equal(target.debuffs.find(e => e.type === 'web').stacks, threshold - 1);
        target.updateDebuffs(0.71); assert.ok(target.speed > 0); assert.ok(target.speed < target.baseSpeed);
        f.hero.abilitySystem.webTarget = target; assert.match(f.hero.abilitySystem.getDisplayState().label, /Resistencia/);
        target.updateDebuffs(2); for (let i = 0; i < threshold; i++) target.applyStatus(effect, f.hero);
        assert.equal(f.hero.combatStats.abilityActivations, 2);
    });
    test(`Miles ${level}: tres ataques sobre red cargan descarga limitada a tres`, () => {
        const f = setup('miles_morales', level), targets = Array.from({ length: 5 }, (_, i) => { const e = f.spawn({ statusResistance: 0.5 }); e.x += i; return e; });
        targets[0].applyStatus(web, f.hero); f.update(5); const damage = f.hero.getEffectiveStats().damage;
        for (let i = 0; i < 3; i++) f.shoot(targets[0]); assert.equal(targets[0].hp, targets[0].maxHp);
        f.shoot(targets[0]); assert.equal(targets.filter(e => e.hp < e.maxHp).length, 3);
        close(targets[0].maxHp - targets[0].hp, damage * 0.45);
        close(targets[0].debuffs.find(e => e.type === 'stun').duration, targets[0].getStatusDuration('stun', 0.2));
        assert.equal(targets.filter(e => e.debuffs.some(s => s.type === 'reveal')).length, 3);
        assert.equal(f.kit.cooldown, 5); assert.equal(f.hero.getProjectileEffects(targets[0]).some(e => e.type === 'stun'), false);
        for (let i = 0; i < 6; i++) f.shoot(targets[0]); assert.equal(f.hero.combatStats.abilityActivations, 1);
    });
}

test('Deadpool: katanas sin blanco cercano vuelven a pistolas tras recarga, sin estancarse', () => {
    const f = setup('deadpool'), target = f.spawn(); target.x = 140; f.update(1.2);
    for (let i = 0; i < 3; i++) f.shoot(target);
    assert.equal(f.hero.getBestTarget([target], f.hero.getEffectiveStats()), null);
    f.update(2.5); assert.equal(f.kit.weapon, 0); assert.equal(f.kit.cooldown, 1.2);
    f.update(1.2); assert.equal(f.hero.getBestTarget([target], f.hero.getEffectiveStats()), target);
});

test('Deadpool: alcance de katanas limitado despues de bonus de equipo y firma', () => {
    const f = setup('deadpool', 100), target = f.spawn();
    f.game.teamSynergy = { applyHeroStats: (_hero, stats) => ({ ...stats, range: stats.range * 2 }) };
    f.update(1.2); for (let i = 0; i < 3; i++) f.shoot(target);
    assert.equal(f.hero.getEffectiveStats().range, 90);
    f.update(2.5); assert.ok(f.hero.getEffectiveStats().range > 155);
});

test('Hero.update respeta recarga y no genera ataques ni procs durante la pausa', () => {
    const f = setup('deadpool'), target = f.spawn(), shots = [];
    f.hero.update(0.5, [target], shots); assert.equal(shots.length, 0);
    f.hero.update(0.5, [target], shots); assert.equal(shots.length, 0);
    f.hero.update(0.3, [target], shots); assert.equal(shots.length, 1);
    assert.equal(f.hero.combatStats.shots, 1); assert.equal(f.game.resourceManager.credits, 0);
});

for (const id of ['deadpool', 'devil_dinosaur', 'miles_morales']) {
    for (const reason of ['mover', 'stun', 'retirar']) {
        test(`${id}: no evade recarga al ${reason}`, () => {
            const f = setup(id), target = f.spawn(); f.spawn(); f.spawn(); target.applyStatus(web, f.hero); f.update(6); f.shoot(target); f.shoot(target);
            if (reason === 'mover') f.hero.x = 1;
            if (reason === 'stun') f.hero.stunTimer = 1;
            if (reason === 'retirar') new TacticalActionSystem(f.game).sell(f.hero);
            f.update(0); assert.equal(f.kit.charge, 0); assert.ok(f.kit.cooldown > 0);
            assert.equal(f.kit.weapon, 0); assert.equal(f.kit.weaponShots, 0);
        });
    }
}

test('redes: 60s de impactos extremos no producen inmovilizacion permanente', () => {
    const f = setup('spiderman'), target = f.spawn({ isBoss: true }); let mobile = 0;
    for (let i = 0; i < 1200; i++) {
        for (let j = 0; j < 3; j++) target.applyStatus(web, f.hero);
        target.updateDebuffs(0.05); if (target.speed > 0) mobile += 0.05;
    }
    assert.ok(mobile > 40); assert.ok(f.hero.combatStats.abilityActivations <= 23);
});

test('redes: cambiar fuente, limpiar estados o reaplicar no reinicia pausa; inmunidad respeta stun', () => {
    const f = setup('spiderman'), target = f.spawn(); for (let i = 0; i < 3; i++) target.applyStatus(web, f.hero);
    const source = { id: 'other', recordAbility() { throw Error('No debe volver a inmovilizar'); } };
    target.debuffs = []; for (let i = 0; i < 20; i++) target.applyStatus(web, source);
    assert.equal(target.debuffs.some(e => e.type === 'stun'), false); close(target.webBindCooldown, 2.7);
    const immune = f.spawn({ immuneToStun: true }); for (let i = 0; i < 3; i++) immune.applyStatus(web, source);
    assert.equal(immune.debuffs.some(e => e.type === 'stun'), false); close(immune.webBindCooldown, 2);
});

test('redes: resistencia de jefe reduce stun pero mantiene dos segundos posteriores', () => {
    const f = setup('spiderman'), target = f.spawn({ isBoss: true, statusResistance: 0.5 });
    for (let i = 0; i < 3; i++) target.applyStatus(web, f.hero);
    close(target.webBindCooldown, 2.35); target.updateDebuffs(0.35); close(target.webBindCooldown, 2);
    assert.ok(target.speed > 0);
});

for (const reason of ['solo dos', 'volador', 'sigilo', 'fuera', 'radio']) {
    test(`Devil: no carga contra ${reason}`, () => {
        const f = setup('devil_dinosaur'), a = f.spawn(), b = f.spawn(), c = f.spawn(); f.update(6);
        if (reason === 'solo dos') c.isAlive = false;
        if (reason === 'volador') c.flying = true;
        if (reason === 'sigilo') c.stealth = true;
        if (reason === 'fuera') c.x = 10000;
        if (reason === 'radio') c.x = 99;
        for (let i = 0; i < 4; i++) f.shoot(a);
        assert.equal(f.kit.charge, 0); assert.equal(b.hp, b.maxHp); assert.equal(f.kit.cooldown, 0);
    });
}

test('Miles: sin red o con red expirada/vacia no carga; ataque sin red y pausa limpian carga', () => {
    const f = setup('miles_morales'), target = f.spawn(); f.update(5);
    for (const debuffs of [[], [{ ...web, stacks: 0 }], [{ ...web, stacks: 1, duration: 0 }]]) {
        target.debuffs = debuffs; for (let i = 0; i < 4; i++) f.shoot(target); assert.equal(f.kit.charge, 0);
    }
    target.debuffs = [{ ...web, stacks: 1 }]; f.shoot(target); f.shoot(target); assert.equal(f.kit.charge, 2);
    f.update(2.5); assert.equal(f.kit.charge, 0); f.shoot(target); f.shoot(f.spawn()); assert.equal(f.kit.charge, 0);
});

test('Miles y Devil: no ignoran armadura ni inmunidad, mantienen ruta', () => {
    for (const id of ['miles_morales', 'devil_dinosaur']) {
        const f = setup(id), a = f.spawn({ immuneToStun: true }), b = f.spawn({ armor: 80, immuneToStun: true }); f.spawn();
        a.applyStatus(web, f.hero); f.update(6); const before = [a.x, a.y, b.x, b.y];
        for (let i = 0; i < (id === 'miles_morales' ? 4 : 3); i++) f.shoot(a);
        close(b.maxHp - b.hp, f.hero.getEffectiveStats().damage * (id === 'miles_morales' ? 0.45 : 0.35) * 0.2);
        assert.equal(b.debuffs.some(e => e.type === 'stun'), false); assert.deepEqual([a.x, a.y, b.x, b.y], before);
        assert.equal(f.game.resourceManager.lives, 20); assert.equal(f.game.resourceManager.credits, 0);
    }
});
