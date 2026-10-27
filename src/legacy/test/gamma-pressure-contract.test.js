import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Hero } from '../src/entities/Hero.js';
import { Enemy } from '../src/entities/Enemy.js';
import { getEvolutionForHero } from '../src/systems/EvolutionSystem.js';

const heroes = JSON.parse(fs.readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8'));
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
function setup(id, level = 1) {
    let hero;
    const game = { heroes: [], enemies: [], random: { next: () => 0.99 },
        resourceManager: { lives: 20, credits: 0, addCredits(n) { this.credits += n; } },
        progression: { getHeroBonuses: () => null, getHeroEvolution: () => hero
            ? getEvolutionForHero(hero.config, {}, { level, equippedItemIds: hero.items.map(i => i.id) }) : null } };
    hero = new Hero({ ...heroes[id], level }, 0, 0, game); game.heroes = [hero];
    const spawn = (x = 50, extra = {}) => {
        const enemy = new Enemy({ id: 'target', category: hero.category, hp: 1e7, speed: 1, ...extra },
            [{ x: 0, y: 0 }, { x: 10000, y: 0 }], game);
        enemy.x = x; enemy.distanceTravelled = x;
        game.enemies.push(enemy); return enemy;
    };
    const kit = id === 'hulk' ? hero.abilitySystem.avengerKit : hero.abilitySystem.streetKit;
    const update = dt => kit.update(dt, game.enemies, hero.getEffectiveStats());
    const attack = target => kit.onAttack(target, hero.getEffectiveStats());
    return { hero, game, spawn, kit, update, attack };
}

for (const level of [1, 49, 50, 51, 99, 100]) {
    test(`Hulk ${level}: presion acotada, salto y cadencia fija`, () => {
        const f = setup('hulk', level);
        const rate = f.hero.getEffectiveStats().fireRate;
        const targets = Array.from({ length: 6 }, () => f.spawn());
        f.update(2); close(f.kit.resource, 36);
        close(f.hero.getEffectiveStats().fireRate, rate);
        f.attack(targets[0]); close(f.kit.resource, 44);
        f.update(0.5); close(f.kit.resource, 3);
        assert.ok(targets.every(e => e.hp < e.maxHp));
        close(f.kit.cooldownRemaining, 8);
        f.update(7); assert.equal(f.hero.combatStats.abilityActivations, 1);
        close(f.kit.resource, 100);
        assert.equal(f.game.resourceManager.lives, 20);
        assert.equal(f.game.resourceManager.credits, 0);
    });
    test(`She-Hulk ${level}: tres ataques, recarga y maximo cuatro victimas`, () => {
        const f = setup('she_hulk', level);
        const targets = Array.from({ length: 6 }, () => f.spawn());
        for (let i = 0; i < 10; i++) f.attack(targets[0]);
        assert.equal(f.kit.attackCount, 3);
        assert.equal(f.hero.combatStats.abilityActivations, 0);
        f.update(4);
        // Being ready does not attack automatically: the next primary shot releases it.
        assert.equal(f.hero.combatStats.abilityActivations, 0);
        f.attack(targets[0]);
        assert.equal(targets.filter(e => e.hp < e.maxHp).length, 4);
        assert.equal(targets.filter(e => e.debuffs.some(d => d.type === 'stun')).length, 1);
        assert.equal(f.kit.attackCount, 0);
        assert.equal(f.kit.cooldownRemaining, 4);
        for (let i = 0; i < 10; i++) f.attack(targets[0]);
        assert.equal(f.hero.combatStats.abilityActivations, 1);
        assert.equal(f.game.resourceManager.lives, 20);
        assert.equal(f.game.resourceManager.credits, 0);
    });
}

test('Hulk: perder vidas, muertos, ocultos y fuera de alcance no cargan furia', () => {
    const f = setup('hulk');
    f.game.resourceManager.lives = 1;
    f.spawn(40, { stealth: true }); f.spawn(40).isAlive = false;
    f.spawn(f.hero.getEffectiveStats().range + 0.01);
    f.update(5); assert.equal(f.kit.resource, 0);
});

test('Hulk: borde inclusivo y presion independiente del framerate', () => {
    const a = setup('hulk'), b = setup('hulk');
    a.spawn(a.hero.getEffectiveStats().range); b.spawn(b.hero.getEffectiveStats().range);
    a.update(1); for (let i = 0; i < 60; i++) b.update(1 / 60);
    close(a.kit.resource, 6); close(a.kit.resource, b.kit.resource);
});

test('Hulk: aturdido no gana presion ni activa el salto', () => {
    const f = setup('hulk'); f.spawn(); f.hero.stunTimer = 2;
    f.hero.update(0.5, f.game.enemies, []);
    assert.equal(f.kit.resource, 0);
    assert.equal(f.hero.combatStats.abilityActivations, 0);
});

test('She-Hulk: jefe resiste stun y retrocede menos, sin cancelar habilidades', () => {
    const f = setup('she_hulk');
    const boss = f.spawn(60, { isBoss: true, statusResistance: 0.5 });
    f.update(4); for (let i = 0; i < 3; i++) f.attack(boss);
    close(boss.distanceTravelled, 42);
    close(boss.debuffs.find(d => d.type === 'stun').duration, boss.getStatusDuration('stun', 0.7));
    assert.equal(boss.debuffs.some(d => d.type === 'sabotage'), false);
});

test('She-Hulk: respeta inmunidades y no controla voladores con retroceso', () => {
    for (const extra of [{ immuneToStun: true, immuneToKnockback: true }, { flying: true, immuneToStun: true }]) {
        const f = setup('she_hulk'), target = f.spawn(60, extra);
        f.update(4); for (let i = 0; i < 3; i++) f.attack(target);
        close(target.distanceTravelled, 60);
        assert.equal(target.debuffs.some(d => d.type === 'stun'), false);
        assert.ok(target.hp < target.maxHp);
    }
});

test('She-Hulk: no consume golpe preparado con objetivo invalido ni golpea ocultos secundarios', () => {
    const f = setup('she_hulk');
    const target = f.spawn(50), hidden = f.spawn(51, { stealth: true });
    const outside = f.spawn(f.hero.getEffectiveStats().range + 1);
    f.update(4); for (let i = 0; i < 3; i++) f.attack(outside);
    assert.equal(f.kit.attackCount, 3); assert.equal(f.kit.cooldownRemaining, 0);
    f.attack(target);
    assert.ok(target.hp < target.maxHp); assert.equal(hidden.hp, hidden.maxHp);
});

test('She-Hulk: ataques normales sin control aleatorio y nuevo despliegue no evita recarga', () => {
    const f = setup('she_hulk'), target = f.spawn();
    assert.deepEqual(f.kit.getAttackEffects(target), []);
    assert.equal(setup('she_hulk').kit.cooldownRemaining, 4);
});
