import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Hero } from '../src/entities/Hero.js';
import { Enemy } from '../src/entities/Enemy.js';
import { TacticalActionSystem } from '../src/systems/TacticalActionSystem.js';
import { CombatSystem } from '../src/systems/CombatSystem.js';
import { getEvolutionForHero } from '../src/systems/EvolutionSystem.js';

const heroes = JSON.parse(fs.readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8'));
const items = JSON.parse(fs.readFileSync(new URL('../data/items.json', import.meta.url), 'utf8'));
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
function setup(id, level = 1) {
    let hero;
    const game = { heroes: [], enemies: [], random: { next: () => 0.99 },
        resourceManager: { lives: 20, credits: 0, addCredits(n) { this.credits += n; } },
        progression: { getHeroBonuses: () => null, getHeroEvolution: () => hero
            ? getEvolutionForHero(hero.config, {}, { level, equippedItemIds: hero.items.map(i => i.id) }) : null } };
    hero = new Hero({ ...heroes[id], level }, 0, 0, game); game.heroes = [hero];
    const spawn = (x = 40, extra = {}) => {
        const enemy = new Enemy({ id: 'target', category: hero.category, hp: 1e8, speed: 1, ...extra },
            [{ x: 0, y: 0 }, { x: 10000, y: 0 }], game);
        enemy.x = x; enemy.distanceTravelled = x;
        game.enemies.push(enemy); return enemy;
    };
    const shoot = target => { const shots = []; hero.shoot(target, hero.getEffectiveStats(), shots); return shots[0]; };
    const kit = hero.abilitySystem.mutantKit;
    const focus = hero.abilitySystem.focusKit;
    return { hero, game, spawn, shoot, kit, focus };
}

for (const level of [1, 49, 50, 51, 99, 100]) {
    test(`Wolverine ${level}: presa repetida, cambio y techo de frenesi`, () => {
        const f = setup('wolverine', level), target = f.spawn(), other = f.spawn(60);
        const base = f.hero.getEffectiveStats();
        f.shoot(target); close(f.kit.resource, 7);
        f.shoot(target); close(f.kit.resource, 21);
        f.shoot(other); close(f.kit.resource, 17.5);
        for (let i = 0; i < 12; i++) f.shoot(other);
        close(f.kit.resource, 100);
        close(f.hero.getEffectiveStats().damage, base.damage * 1.18);
        close(f.hero.getEffectiveStats().fireRate, base.fireRate * 1.2);
        assert.equal(f.game.resourceManager.lives, 20);
        assert.equal(f.game.resourceManager.credits, 0);
    });
    test(`X-23 ${level}: remate critico x3 preparado y consumido contra jefe`, () => {
        const f = setup('x_23', level), target = f.spawn(40, { isBoss: true });
        const base = f.hero.getEffectiveStats().damage;
        for (let i = 0; i < 3; i++) {
            const shot = f.shoot(target); close(shot.damage, base); assert.equal(shot.radius, 5);
        }
        assert.equal(f.focus.criticalMultiplier(target), 0);
        target.applyStatus({ type: 'bleed', duration: 4, power: 1 }, f.hero);
        const finisher = f.shoot(target);
        close(finisher.damage, base * 3); assert.equal(finisher.radius, 7);
        assert.equal(f.hero.combatStats.crits, 1); assert.equal(f.focus.stacks, 0);
        CombatSystem.applyImpact(finisher, target, f.hero, f.game.resourceManager);
        assert.ok(target.isAlive); assert.ok(target.hp < target.maxHp);
        close(f.shoot(target).damage, base);
        assert.equal(f.game.resourceManager.lives, 20); assert.equal(f.game.resourceManager.credits, 0);
    });
}

test('Wolverine: enemigos adicionales y ocultos no aumentan cadencia', () => {
    const f = setup('wolverine'); const base = f.hero.getEffectiveStats().fireRate;
    for (let i = 0; i < 20; i++) f.spawn(40, { stealth: i % 2 === 0 });
    close(f.hero.getEffectiveStats().fireRate, base);
});

test('Wolverine: decaimiento temporal exacto, sin perdida antes de tres segundos', () => {
    const a = setup('wolverine'), b = setup('wolverine');
    for (const f of [a, b]) {
        const target = f.spawn(); for (let i = 0; i < 4; i++) f.shoot(target);
        f.kit.updatePursuit(3); close(f.kit.resource, 49);
    }
    a.kit.updatePursuit(2); for (let i = 0; i < 120; i++) b.kit.updatePursuit(1 / 60);
    close(a.kit.resource, 25); close(a.kit.resource, b.kit.resource);
    a.kit.updatePursuit(20); close(a.kit.resource, 0);
});

for (const reason of ['mover', 'stun', 'retirar']) {
    test(`Wolverine: vacia frenesi al ${reason}`, () => {
        const f = setup('wolverine'), target = f.spawn(); f.shoot(target);
        if (reason === 'mover') f.hero.x += 1;
        if (reason === 'stun') f.hero.stunTimer = 2;
        if (reason === 'retirar') new TacticalActionSystem(f.game).sell(f.hero);
        f.kit.updatePursuit(0.1);
        assert.equal(f.kit.resource, 0); assert.equal(f.kit.pursuit, null);
    });
}

for (const reason of ['regreso', 'mover', 'stun']) {
    test(`Wolverine: salto mantiene puesto seguro ante ${reason}`, () => {
        const f = setup('wolverine'), target = f.spawn(100);
        f.shoot(target); f.kit.resource = 55;
        f.kit.update(0, f.game.enemies, f.hero.getEffectiveStats());
        assert.ok(f.kit.jumpOrigin);
        if (reason === 'mover') { f.hero.x = 300; f.hero.y = 200; }
        if (reason === 'stun') f.hero.stunTimer = 2;
        f.kit.updatePursuit(0.1);
        f.kit.update(0.9, f.game.enemies, f.hero.getEffectiveStats());
        assert.equal(f.kit.jumpOrigin, null);
        assert.equal(f.hero.x, reason === 'mover' ? 300 : 0);
        assert.equal(f.hero.y, reason === 'mover' ? 200 : 0);
        close(target.x, 100); close(target.y, 0);
    });
}

for (const reason of ['cambiar', 'mover', 'stun', 'retirar', 'esperar', 'muerto', 'sigilo', 'fuera']) {
    test(`X-23: no conserva remate al ${reason}`, () => {
        const f = setup('x_23'), target = f.spawn();
        target.applyStatus({ type: 'bleed', duration: 4, power: 1 }, f.hero);
        for (let i = 0; i < 3; i++) f.shoot(target);
        assert.equal(f.focus.criticalMultiplier(target), 3);
        if (reason === 'cambiar') f.shoot(f.spawn(60));
        if (reason === 'mover') f.hero.x += 1;
        if (reason === 'stun') f.hero.stunTimer = 1;
        if (reason === 'retirar') new TacticalActionSystem(f.game).sell(f.hero);
        if (reason === 'muerto') target.isAlive = false;
        if (reason === 'sigilo') target.stealth = true;
        if (reason === 'fuera') target.x = 10000;
        f.focus.update(reason === 'esperar' ? 2.5 : 0);
        assert.equal(f.focus.criticalMultiplier(target), 0);
    });
}

test('X-23: espera sangrado sin acumular mas de tres cortes y respeta criticos mayores', () => {
    const f = setup('x_23'), target = f.spawn();
    for (let i = 0; i < 10; i++) f.shoot(target);
    assert.equal(f.focus.stacks, 3); assert.equal(f.hero.combatStats.crits, 0);
    target.applyStatus({ type: 'bleed', duration: 4, power: 1 }, f.hero);
    const stats = { ...f.hero.getEffectiveStats(), critDamage: 4 };
    const shots = []; f.hero.shoot(target, stats, shots);
    close(shots[0].damage, stats.damage * 4);
    assert.equal(f.focus.stacks, 0);
});

test('X-23: remate convive con Corte Multiple sin duplicar preparacion', () => {
    const f = setup('x_23', 50), target = f.spawn();
    f.hero.items = [items.protocolo_danger_room];
    target.applyStatus({ type: 'bleed', duration: 4, power: 1 }, f.hero);
    for (let i = 0; i < 12; i++) f.shoot(target);
    assert.equal(f.hero.combatStats.shots, 12);
    assert.equal(f.hero.combatStats.crits, 3);
    assert.equal(f.focus.stacks, 0);
    assert.ok(f.hero.combatStats.abilityActivations >= 3);
});
