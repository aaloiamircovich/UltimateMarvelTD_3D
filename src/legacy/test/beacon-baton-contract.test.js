import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Hero } from '../src/entities/Hero.js';
import { Enemy } from '../src/entities/Enemy.js';
import { CombatSystem } from '../src/systems/CombatSystem.js';
import { TacticalActionSystem } from '../src/systems/TacticalActionSystem.js';
import { getEvolutionForHero } from '../src/systems/EvolutionSystem.js';

const heroes = JSON.parse(fs.readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8'));
const items = JSON.parse(fs.readFileSync(new URL('../data/items.json', import.meta.url), 'utf8'));
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
function setup(id, level = 1) {
    let hero;
    const game = { heroes: [], enemies: [], random: { next: () => 0.99 }, resourceManager: { lives: 20, credits: 0 },
        progression: { getHeroBonuses: () => null, getHeroEvolution: () => hero
            ? getEvolutionForHero(hero.config, {}, { level, equippedItemIds: hero.items.map(i => i.id) }) : null } };
    hero = new Hero({ ...heroes[id], level }, 0, 0, game); game.heroes = [hero];
    const spawn = (x = 80, extra = {}) => {
        const enemy = new Enemy({ id: 'target', category: hero.category, hp: 1e7, speed: 1, ...extra },
            [{ x, y: 0 }, { x: 10000, y: 0 }], game);
        game.enemies.push(enemy); return enemy;
    };
    const shoot = target => { const shots = []; hero.shoot(target, hero.getEffectiveStats(), shots); return shots; };
    const hit = shot => CombatSystem.applyImpact(shot, shot.target, hero, game.resourceManager);
    return { game, hero, spawn, shoot, hit, kit: hero.abilitySystem.focusKit };
}

for (const level of [1, 49, 50, 51, 99, 100]) {
    test(`Kate nivel ${level}: solo cuarta flecha revela al impactar`, () => {
        const f = setup('kate_bishop', level), target = f.spawn(80, { stealth: true });
        for (let i = 0; i < 3; i++) { const shot = f.shoot(target)[0]; assert.equal(shot.beaconRadius, 0); f.hit(shot); }
        assert.equal(target.stealth, true);
        const shot = f.shoot(target)[0]; assert.equal(shot.beaconRadius, 80);
        assert.equal(target.stealth, true); f.hit(shot); assert.equal(target.stealth, false);
        assert.equal(target.debuffs.find(e => e.type === 'reveal').duration, 3);
        assert.equal(f.hero.combatStats.shots, 4);
    });
    test(`Mockingbird nivel ${level}: dos golpes y recarga electrica`, () => {
        const f = setup('mockingbird', level), target = f.spawn();
        const damage = f.hero.getEffectiveStats().damage;
        f.kit.update(2);
        close(f.shoot(target)[0].damage, damage);
        const second = f.shoot(target)[0]; close(second.damage, damage * 1.4);
        assert.deepEqual(second.effects.find(e => e.type === 'stun'), { type: 'stun', duration: 0.35, power: 1, chance: 1 });
        f.shoot(target);
        assert.equal(f.shoot(target)[0].effects.some(e => e.type === 'stun'), false);
        f.kit.update(2); f.shoot(target);
        assert.ok(f.shoot(target)[0].effects.some(e => e.type === 'stun'));
    });
}

test('baliza limitada a seis, sin dano incidental y excluyendo fuera de radio', () => {
    const f = setup('kate_bishop'), target = f.spawn();
    for (let i = 0; i < 8; i++) f.spawn(85 + i, { stealth: true });
    const outside = f.spawn(161, { stealth: true });
    let shot; for (let i = 0; i < 4; i++) shot = f.shoot(target)[0];
    f.hit(shot);
    assert.equal(f.game.enemies.filter(e => e.debuffs.some(s => s.type === 'reveal')).length, 6);
    assert.ok(f.game.enemies.slice(1).every(e => e.hp === e.maxHp));
    assert.equal(outside.stealth, true);
    f.game.enemies.forEach(e => e.update(3.01));
    assert.ok(f.game.enemies.slice(1).every(e => e.stealth));
});

test('baliza usa centro de impacto, no posicion al disparar; se consume una vez', () => {
    const f = setup('kate_bishop'), target = f.spawn(), hidden = f.spawn(300, { stealth: true });
    let shot; for (let i = 0; i < 4; i++) shot = f.shoot(target)[0];
    target.x = 290; f.hit(shot); assert.equal(hidden.stealth, false);
    hidden.update(3.1); f.hit(shot); assert.equal(hidden.stealth, true);
    shot.reset(0, 0, target, { damage: 1 }); assert.equal(shot.beaconRadius, 0);
});

test('baliza se pierde si el objetivo muere antes de llegar', () => {
    const f = setup('kate_bishop'), target = f.spawn(80, { stealth: true });
    let shot; for (let i = 0; i < 4; i++) shot = f.shoot(target)[0];
    target.isAlive = false; shot.update(1);
    assert.equal(shot.isActive, false); assert.equal(target.stealth, true);
});

test('baliza respeta resistencias de jefe y permite apuntar a aliados sin deteccion', () => {
    const f = setup('kate_bishop'), target = f.spawn(80, { stealth: true, isBoss: true, statusResistance: 0.5 });
    let shot; for (let i = 0; i < 4; i++) shot = f.shoot(target)[0]; f.hit(shot);
    close(target.debuffs.find(e => e.type === 'reveal').duration, 1.5);
    const ally = new Hero(heroes.punisher, 0, 0, f.game);
    assert.equal(ally.getBestTarget([target], ally.getEffectiveStats()), target);
});

for (const reason of ['blanco', 'mover', 'stun', 'tiempo', 'retiro']) {
    test(`Mockingbird pierde preparacion por ${reason}`, () => {
        const f = setup('mockingbird'), target = f.spawn(); f.shoot(target);
        if (reason === 'blanco') {
            close(f.shoot(f.spawn(90))[0].damage, f.hero.getEffectiveStats().damage); return;
        }
        if (reason === 'mover') f.hero.x += 1;
        if (reason === 'stun') f.hero.stunTimer = 1;
        if (reason === 'retiro') new TacticalActionSystem(f.game).sell(f.hero);
        else f.kit.update(reason === 'tiempo' ? 2.51 : 0);
        assert.equal(f.kit.damageMultiplier(target), 1);
    });
}

test('Mockingbird: no stun instantaneo al desplegar ni recarga por consultar', () => {
    const f = setup('mockingbird'), target = f.spawn(); f.shoot(target);
    for (let i = 0; i < 5; i++) assert.equal(f.hero.getProjectileEffects(target).some(e => e.type === 'stun'), false);
    assert.equal(f.kit.shockCooldown, 2);
});

test('Kate con carcaj: flechas de objeto no duplican baliza ni cargas', () => {
    const f = setup('kate_bishop', 50), target = f.spawn();
    const item = Object.values(items).find(i => i.id === 'carcaj_flechas_truco');
    assert.ok(item); f.hero.items = [item];
    let shots; for (let i = 0; i < 4; i++) shots = f.shoot(target);
    assert.equal(shots.filter(s => s.beaconRadius > 0).length, 1);
    assert.equal(f.hero.abilitySystem.avengerKit.attackCount, 4);
    assert.ok(f.hero.combatStats.abilityActivations >= 2);
});

test('60 s Mockingbird: descarga limitada por tiempo, sin proyectiles extra', () => {
    const f = setup('mockingbird'), target = f.spawn(); f.hero.fireRate = 10;
    let stuns = 0, shots = 0;
    for (let frame = 0; frame < 3600; frame++) {
        const projectiles = []; f.hero.update(1 / 60, [target], projectiles);
        shots += projectiles.length;
        stuns += projectiles.filter(p => p.effects.some(e => e.type === 'stun')).length;
    }
    assert.ok(stuns > 0 && stuns <= 30);
    assert.equal(shots, f.hero.combatStats.shots);
});
