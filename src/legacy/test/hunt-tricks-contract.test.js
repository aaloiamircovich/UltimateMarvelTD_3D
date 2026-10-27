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
    const spawn = (x = 70, extra = {}) => {
        const enemy = new Enemy({ id: 'target', category: hero.category, hp: 1e6, speed: 1, ...extra },
            [{ x, y: 0 }, { x: 10000, y: 0 }], game);
        game.enemies.push(enemy); return enemy;
    };
    const shoot = target => { const shots = []; hero.shoot(target, hero.getEffectiveStats(), shots); return shots[0]; };
    const mark = target => target.applyStatus({ type: 'mark', duration: 2, power: 0.06 }, hero);
    return { hero, game, spawn, shoot, mark, kit: hero.abilitySystem.focusKit };
}

for (const level of [1, 49, 50, 51, 99, 100]) {
    test(`Yelena nivel ${level}: seguimiento y marca son ambos necesarios`, () => {
        const f = setup('yelena_belova', level), target = f.spawn();
        const damage = f.hero.getEffectiveStats().damage;
        close(f.shoot(target).damage, damage);
        close(f.shoot(target).damage, damage);
        f.mark(target); close(f.shoot(target).damage, damage * 1.2);
        const other = f.spawn(80); f.mark(other);
        close(f.shoot(other).damage, damage);
        close(f.shoot(other).damage, damage * 1.2);
    });
    test(`Howard nivel ${level}: alternancia cada tres disparos, sin doble garantia`, () => {
        const f = setup('howard_the_duck', level), target = f.spawn();
        for (let i = 1; i <= 12; i++) {
            const shot = f.shoot(target);
            const burn = shot.effects.find(e => e.type === 'burn'), slow = shot.effects.find(e => e.type === 'slow');
            close(burn.chance, i % 6 === 3 ? 1 : 0.22);
            close(slow.chance, i % 6 === 0 ? 1 : 0.24);
            close(burn.power, 0.12); close(slow.power, 0.18);
        }
        assert.equal(f.hero.combatStats.abilityActivations, 4);
        close(heroes.howard_the_duck.special.attackEffects[0].chance, 0.22);
    });
}

test('Yelena transfiere una sola marca al mas cercano, sin dano ni cambio de prioridad', () => {
    const f = setup('yelena_belova'), target = f.spawn(), next = f.spawn(80), far = f.spawn(90);
    f.mark(target); f.shoot(target);
    const priority = f.hero.targetingPriority;
    target.hp = 1;
    CombatSystem.applyImpact(f.shoot(target), target, f.hero, f.game.resourceManager);
    assert.ok(next.debuffs.some(e => e.type === 'mark'));
    assert.equal(far.debuffs.length, 0);
    assert.equal(next.hp, next.maxHp);
    assert.equal(f.hero.targetingPriority, priority);
    assert.equal(f.kit.target, next);
    close(f.kit.damageMultiplier(next), 1.2);
});

test('Yelena: muerte sin marca o ajena al seguimiento no transfiere', () => {
    for (const marked of [false, true]) {
        const f = setup('yelena_belova'), target = f.spawn(), other = f.spawn(80);
        f.shoot(marked ? other : target); if (marked) f.mark(target);
        target.isAlive = false; f.hero.abilitySystem.onKill(target);
        assert.equal(other.debuffs.length, 0);
    }
});

test('transferencia respeta muertos, alcance, radio y resistencias', () => {
    const f = setup('yelena_belova'), target = f.spawn();
    f.mark(target); f.shoot(target);
    const dead = f.spawn(71); dead.isAlive = false;
    const outside = f.spawn(10000);
    const boss = f.spawn(90, { isBoss: true, statusResistance: 0.5 });
    target.isAlive = false; f.hero.abilitySystem.onKill(target);
    assert.equal(dead.debuffs.length, 0); assert.equal(outside.debuffs.length, 0);
    close(boss.debuffs.find(e => e.type === 'mark').duration, 1);
});

for (const reason of ['movimiento', 'stun', 'tiempo', 'retiro', 'expiracion']) {
    test(`Yelena pierde contrato por ${reason}`, () => {
        const f = setup('yelena_belova'), target = f.spawn(); f.mark(target); f.shoot(target);
        if (reason === 'movimiento') f.hero.x += 1;
        if (reason === 'stun') f.hero.stunTimer = 1;
        if (reason === 'retiro') new TacticalActionSystem(f.game).sell(f.hero);
        if (reason === 'expiracion') target.update(2.01);
        if (reason !== 'retiro') f.kit.update(reason === 'tiempo' ? 2.51 : 0);
        assert.equal(f.kit.damageMultiplier(target), 1);
    });
}

test('Howard: truco en vuelo no cambia al preparar el siguiente', () => {
    const f = setup('howard_the_duck'), target = f.spawn();
    f.shoot(target); f.shoot(target); const fire = f.shoot(target);
    f.shoot(target); f.shoot(target); const slow = f.shoot(target);
    assert.equal(fire.effects.find(e => e.type === 'burn').chance, 1);
    assert.equal(slow.effects.find(e => e.type === 'slow').chance, 1);
    CombatSystem.applyImpact(fire, target, f.hero, f.game.resourceManager);
    assert.ok(target.debuffs.some(e => e.type === 'burn'));
    assert.equal(target.debuffs.some(e => e.type === 'slow'), false);
    CombatSystem.applyImpact(slow, target, f.hero, f.game.resourceManager);
    assert.ok(target.debuffs.some(e => e.type === 'slow'));
    assert.equal(f.hero.abilitySystem.avengerKit.attackCount, 6);
});

test('Howard no prepara trucos por esperar o estar aturdido', () => {
    const f = setup('howard_the_duck'); f.hero.update(3, [], []);
    f.hero.stunTimer = 2; f.hero.update(1, [f.spawn()], []);
    assert.equal(f.hero.abilitySystem.avengerKit.attackCount, 0);
});
