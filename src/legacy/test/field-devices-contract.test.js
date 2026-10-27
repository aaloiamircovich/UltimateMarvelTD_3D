import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Hero } from '../src/entities/Hero.js';
import { Enemy } from '../src/entities/Enemy.js';
import { TacticalActionSystem } from '../src/systems/TacticalActionSystem.js';
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
    const spawn = (x = 80, extra = {}) => {
        const enemy = new Enemy({ id: 'target', category: hero.category, hp: 1e7, speed: 1, ...extra },
            [{ x, y: 0 }, { x: 10000, y: 0 }], game);
        game.enemies.push(enemy); return enemy;
    };
    const shoot = target => { const shots = []; hero.shoot(target, hero.getEffectiveStats(), shots); return shots[0]; };
    const device = hero.abilitySystem.fieldDevice;
    const update = dt => device.update(dt, game.enemies);
    return { hero, game, spawn, shoot, device, update };
}

for (const level of [1, 49, 50, 51, 99, 100]) {
    test(`Rocket nivel ${level}: conserva presupuesto y no agrega disparos`, () => {
        const f = setup('rocket_raccoon', level), target = f.spawn();
        const damage = f.hero.getEffectiveStats().damage;
        close(f.shoot(target).damage, damage);
        f.update(6); assert.ok(f.device.device);
        const shot = f.shoot(target); close(shot.damage, damage * 0.8);
        close(f.device.device.budget, damage * 0.2);
        f.update(0.5); close(target.maxHp - target.hp, damage * 0.2);
        close(f.device.device.budget, 0);
        f.update(0.5); close(target.maxHp - target.hp, damage * 0.2);
        assert.equal(f.hero.combatStats.shots, 2);
        assert.equal(f.game.heroes.length, 1);
    });
    test(`Peni nivel ${level}: arma en un segundo, red sin dano y recarga`, () => {
        const f = setup('peni_parker', level), target = f.spawn();
        f.update(8); f.update(0.9); assert.equal(target.debuffs.length, 0);
        f.update(0.11);
        const web = target.debuffs.find(e => e.type === 'web');
        assert.ok(web); close(web.power, 0.35); close(web.duration, 2);
        assert.equal(target.hp, target.maxHp); assert.equal(f.device.device, null);
        assert.equal(f.device.cooldown, 8);
    });
}

for (const id of ['rocket_raccoon', 'peni_parker']) {
    for (const reason of ['mover', 'stun', 'retirar', 'quitarEquipo']) {
        test(`${id}: elimina dispositivo al ${reason}`, () => {
            const f = setup(id), target = f.spawn(); f.update(8);
            if (id === 'rocket_raccoon') f.shoot(target);
            if (reason === 'mover') f.hero.x += 1;
            if (reason === 'stun') f.hero.stunTimer = 2;
            if (reason === 'retirar') new TacticalActionSystem(f.game).sell(f.hero);
            if (reason === 'quitarEquipo') f.game.heroes = [];
            f.update(0.1);
            assert.equal(f.device.device, null);
            assert.equal(f.device.cooldown, f.device.interval);
            assert.equal(target.hp, target.maxHp); assert.equal(target.debuffs.length, 0);
        });
    }
    test(`${id}: sin blanco no coloca; solo un dispositivo y caduca`, () => {
        const f = setup(id); f.update(20); assert.equal(f.device.device, null);
        const target = f.spawn(); f.update(0);
        const device = f.device.device; target.x = 5000;
        f.update(0.5); assert.equal(f.device.device, device);
        f.update(4.5); assert.equal(f.device.device, null);
    });
}

test('Rocket no dispara fuera de alcance ni inventa reserva al cambiar blanco', () => {
    const f = setup('rocket_raccoon'), target = f.spawn(); f.update(6); f.shoot(target);
    const reserve = f.device.device.budget; target.x = 10000;
    f.update(0.5); close(f.device.device.budget, reserve);
    const next = f.spawn(100); f.update(0.5);
    close(next.maxHp - next.hp, reserve); close(f.device.device.budget, 0);
});

test('Rocket limita reserva y al expirar recupera dano principal completo', () => {
    const f = setup('rocket_raccoon'), target = f.spawn(); f.update(6);
    const damage = f.hero.getEffectiveStats().damage;
    for (let i = 0; i < 100; i++) f.shoot(target);
    close(f.device.device.budget, damage * 2);
    f.update(5); close(f.shoot(target).damage, damage);
    assert.equal(f.device.device, null); assert.equal(f.device.cooldown, 6);
});

test('Rocket: impactos no aplican objetos, cuentan bajas sin disparar hooks', () => {
    const f = setup('rocket_raccoon'), target = f.spawn();
    f.hero.items = [{ id: 'probe', effects: { onHitCredit: 100, stunChance: 1 } }];
    f.update(6); f.shoot(target); target.hp = 1;
    let kills = 0; f.hero.abilitySystem.onKill = () => kills++;
    f.update(0.5);
    assert.equal(target.isAlive, false); assert.equal(f.hero.combatStats.kills, 1);
    assert.equal(kills, 0); assert.equal(f.game.resourceManager.credits, 0);
    assert.equal(target.debuffs.length, 0);
    assert.equal(f.hero.combatStats.shots, 1);
});

test('Peni: radio de activacion 26, area 65 y maximo cinco', () => {
    const f = setup('peni_parker'), target = f.spawn(); f.update(8);
    target.x = 107; f.update(1); assert.equal(target.debuffs.length, 0);
    target.x = 106;
    for (let i = 0; i < 8; i++) f.spawn(110 + i);
    const outside = f.spawn(146);
    f.update(0);
    assert.equal(f.game.enemies.filter(e => e.debuffs.some(s => s.type === 'web')).length, 5);
    assert.equal(outside.debuffs.length, 0);
});

test('Peni: mina no sigue al blanco y el jefe reduce duracion', () => {
    const f = setup('peni_parker'), target = f.spawn(); f.update(8); target.x = 400;
    const boss = f.spawn(80, { isBoss: true, statusResistance: 0.5 }); f.update(1);
    assert.equal(target.debuffs.length, 0);
    close(boss.debuffs.find(e => e.type === 'web').duration, 1);
});

test('ambos dispositivos respetan deteccion efectiva, no revelan sigilo', () => {
    for (const id of ['rocket_raccoon', 'peni_parker']) {
        const f = setup(id), target = f.spawn(); f.update(8);
        if (id === 'rocket_raccoon') f.shoot(target);
        f.hero.getEffectiveStats = () => ({ damage: 20, range: 200, canSeeStealth: false });
        target.stealth = true; f.update(1);
        assert.equal(target.hp, target.maxHp); assert.equal(target.debuffs.length, 0);
        assert.equal(target.stealth, true);
    }
});

test('60 segundos: duracion y recarga limitan dispositivos con cadencia extrema', () => {
    for (const id of ['rocket_raccoon', 'peni_parker']) {
        const f = setup(id), target = f.spawn(); f.hero.fireRate = 10;
        let maxBudget = 0;
        for (let frame = 0; frame < 3600; frame++) {
            f.hero.update(1 / 60, [target], []);
            target.update(1 / 60);
            maxBudget = Math.max(maxBudget, f.device.device?.budget || 0);
        }
        assert.ok(f.hero.combatStats.abilityActivations <= 7);
        assert.ok(maxBudget <= f.hero.getEffectiveStats().damage * 2);
        assert.equal(f.game.heroes.length, 1);
    }
});
