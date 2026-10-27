import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Hero } from '../src/entities/Hero.js';
import { Enemy } from '../src/entities/Enemy.js';
import { CombatSystem } from '../src/systems/CombatSystem.js';
import { TacticalActionSystem } from '../src/systems/TacticalActionSystem.js';
import { getEvolutionForHero } from '../src/systems/EvolutionSystem.js';
import { getRouteProgress } from '../src/utils/PathUtils.js';

const heroes = JSON.parse(fs.readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8'));
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
function setup(id, level = 1) {
    let hero;
    const game = { heroes: [], enemies: [], random: { next: () => 0.99 },
        resourceManager: { lives: 20, credits: 0, addCredits(n) { this.credits += n; } },
        progression: { getHeroBonuses: () => null, getHeroEvolution: () => hero
            ? getEvolutionForHero(hero.config, {}, { level, equippedItemIds: [] }) : null } };
    hero = new Hero({ ...heroes[id], level }, 0, 0, game); game.heroes = [hero];
    const spawn = (progress = 0.75, extra = {}) => {
        const enemy = new Enemy({ id: 'target', category: hero.category, hp: 1e8, speed: 1, ...extra },
            [{ x: 0, y: 0 }, { x: 1000, y: 0 }], game);
        enemy.x = 40; enemy.distanceTravelled = progress * 1000; game.enemies.push(enemy); return enemy;
    };
    const shoot = target => { const shots = []; hero.shoot(target, hero.getEffectiveStats(), shots); return shots[0]; };
    const kit = hero.abilitySystem.streetKit, focus = hero.abilitySystem.focusKit;
    const update = dt => kit.update(dt, game.enemies, hero.getEffectiveStats());
    return { hero, game, spawn, shoot, kit, focus, update };
}

for (const level of [1, 49, 50, 51, 99, 100]) {
    test(`Jessica ${level}: bonus solo en ultima linea, recarga y resistencias`, () => {
        const f = setup('jessica_jones', level), target = f.spawn(0.75, { isBoss: true, statusResistance: 0.5 });
        const base = f.hero.getEffectiveStats().damage;
        close(f.shoot(target).damage, base); f.update(3);
        const shot = f.shoot(target); close(shot.damage, base * 1.45);
        assert.equal(shot.effects.length, 1); assert.equal(f.kit.cooldownRemaining, 3);
        CombatSystem.applyImpact(shot, target, f.hero, f.game.resourceManager);
        close(target.debuffs.find(e => e.type === 'stun').duration, target.getStatusDuration('stun', 0.5));
        close(f.shoot(target).damage, base);
        assert.equal(f.game.resourceManager.lives, 20); assert.equal(f.game.resourceManager.credits, 0);
    });
    test(`Okoye ${level}: tercera estocada rompe armadura, no antes ni doble`, () => {
        const f = setup('okoye', level), target = f.spawn(0.5, { isBoss: true, armor: 85, statusResistance: 0.5 });
        assert.equal(f.shoot(target).effects.length, 0); assert.equal(f.shoot(target).effects.length, 0);
        const shot = f.shoot(target); assert.equal(shot.effects.length, 1);
        close(shot.effects[0].power, 0.22); close(shot.effects[0].chance, 1);
        CombatSystem.applyImpact(shot, target, f.hero, f.game.resourceManager);
        close(target.debuffs.find(e => e.type === 'armorBreak').duration, target.getStatusDuration('armorBreak', 3));
        assert.equal(f.focus.stacks, 0); assert.equal(f.hero.combatStats.abilityActivations, 1);
        assert.equal(f.shoot(target).effects.length, 0);
        assert.equal(f.game.resourceManager.credits, 0);
    });
}

test('Jessica: compara porcentaje de cada ruta, no distancia absoluta ni cercania a base', () => {
    const f = setup('jessica_jones'), a = f.spawn(0.75), b = f.spawn(0.9);
    b.path = [{ x: 0, y: 0 }, { x: 500, y: 0 }]; b.distanceTravelled = 400;
    f.update(3); assert.equal(f.kit.isLastLineTarget(a), false); assert.equal(f.kit.isLastLineTarget(b), true);
    b.x = 10000; assert.equal(f.kit.isLastLineTarget(a), true);
    b.x = 40; b.stealth = true; assert.equal(f.kit.isLastLineTarget(a), true);
    a.distanceTravelled = 749.99; assert.equal(f.kit.isLastLineTarget(a), false);
    a.distanceTravelled = 750; assert.equal(f.kit.isLastLineTarget(a), true);
    a.hasReachedEnd = true; assert.equal(f.kit.isLastLineTarget(a), false);
});

test('progreso: curva, puntos repetidos y datos invalidos no crean bonus de ultima linea', () => {
    const path = [{ x: 0, y: 0 }, { x: 0, y: 100 }, { x: 0, y: 100 }, { x: 100, y: 100 }];
    close(getRouteProgress({ path, distanceTravelled: 150 }), 0.75);
    for (const enemy of [null, { path: [] }, { path, distanceTravelled: NaN }, { path: [path[0], path[0]], distanceTravelled: 100 }]) {
        assert.equal(getRouteProgress(enemy), 0);
    }
});

test('Jessica: no consume sobre rezagado, mantiene prioridad y no sortea recarga', () => {
    const f = setup('jessica_jones'), back = f.spawn(0.8), front = f.spawn(0.9);
    f.hero.targetingPriority = 'Debil'; f.update(3);
    f.shoot(back); assert.equal(f.kit.cooldownRemaining, 0);
    f.shoot(front); assert.equal(f.kit.cooldownRemaining, 3);
    for (let i = 0; i < 10; i++) { f.shoot(front); f.kit.getDisplayState(); }
    assert.equal(f.kit.cooldownRemaining, 3); assert.equal(f.hero.targetingPriority, 'Debil');
    assert.equal(setup('jessica_jones').kit.cooldownRemaining, 3);
});

test('Jessica: inmunidad a stun conserva dano reforzado sin paralizar', () => {
    const f = setup('jessica_jones'), target = f.spawn(0.9, { immuneToStun: true }); f.update(3);
    CombatSystem.applyImpact(f.shoot(target), target, f.hero, f.game.resourceManager);
    assert.ok(target.hp < target.maxHp); assert.equal(target.debuffs.length, 0);
});

for (const reason of ['cambiar', 'mover', 'stun', 'retirar', 'esperar', 'muerto', 'sigilo', 'fuera']) {
    test(`Okoye: pierde preparacion al ${reason}`, () => {
        const f = setup('okoye'), target = f.spawn(); f.shoot(target); f.shoot(target);
        assert.equal(f.focus.attackEffects(target).length, 1);
        if (reason === 'cambiar') f.shoot(f.spawn());
        if (reason === 'mover') f.hero.x += 1;
        if (reason === 'stun') f.hero.stunTimer = 2;
        if (reason === 'retirar') new TacticalActionSystem(f.game).sell(f.hero);
        if (reason === 'muerto') target.isAlive = false;
        if (reason === 'sigilo') target.stealth = true;
        if (reason === 'fuera') target.x = 10000;
        f.focus.update(reason === 'esperar' ? 2.5 : 0);
        assert.equal(f.focus.attackEffects(target).length, 0);
    });
}
