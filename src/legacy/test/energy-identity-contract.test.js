import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Hero } from '../src/entities/Hero.js';
import { Enemy } from '../src/entities/Enemy.js';
import { Projectile } from '../src/entities/Projectile.js';
import { CombatSystem } from '../src/systems/CombatSystem.js';
import { TacticalActionSystem } from '../src/systems/TacticalActionSystem.js';
import { getEvolutionForHero } from '../src/systems/EvolutionSystem.js';

const roster = JSON.parse(fs.readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8'));
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
function setup(id, level = 1) {
    let hero;
    const game = { heroes: [], enemies: [], random: { next: () => 0.99 },
        resourceManager: { lives: 20, credits: 0, addCredits(n) { this.credits += n; } },
        progression: { getHeroBonuses: () => null,
            getHeroEvolution: () => hero ? getEvolutionForHero(hero.config, {}, { level, equippedItemIds: [] }) : null } };
    hero = new Hero({ ...roster[id], level }, 0, 0, game); game.heroes.push(hero);
    const kit = id === 'vision' ? hero.abilitySystem.avengerKit : id === 'jean_grey'
        ? hero.abilitySystem.mutantKit : hero.abilitySystem.cosmicKit;
    const spawn = (x = 110, y = 0, extra = {}) => {
        const enemy = new Enemy({ id: 'target', category: hero.category, hp: 1e8, speed: 100, ...extra },
            [{ x: 0, y: 0 }, { x: 1000, y: 0 }], game);
        Object.assign(enemy, { x, y, distanceTravelled: x }); game.enemies.push(enemy); return enemy;
    };
    const shoot = target => { const shots = []; hero.shoot(target, hero.getEffectiveStats(), shots); return shots; };
    const tick = dt => kit.update(dt, game.enemies, hero.getEffectiveStats());
    return { hero, game, kit, spawn, shoot, tick };
}

for (const level of [1, 49, 50, 51, 99, 100]) {
    test(`Captain ${level}: prepara0.45s, limita6, snapshot y vuelo sin cambiar casilla`, () => {
        const f = setup('captain_marvel', level), enemies = Array.from({ length: 7 }, (_, i) => f.spawn(80 + i * 15));
        f.kit.resource = 60; f.tick(9);
        const damage = f.kit.binaryRun.damage;
        assert.equal(f.kit.resource, 0); assert.equal(f.shoot(enemies[0]).length, 0);
        f.hero.damage *= 3; f.tick(0.44); assert.ok(enemies.every(e => e.hp === e.maxHp)); f.tick(0.02);
        for (const e of enemies.slice(0, 6)) close(e.maxHp - e.hp, damage);
        close(enemies[6].hp, enemies[6].maxHp); f.tick(0.45);
        assert.ok(f.kit.visualOffset().x > 0); assert.equal(f.hero.x, 0); assert.equal(f.hero.y, 0);
        f.tick(0.45); assert.equal(f.kit.binaryRun, null); assert.deepEqual(f.kit.visualOffset(), { x: 0, y: 0 });
        assert.equal(f.hero.combatStats.abilityActivations, 1);
    });
    test(`Vision ${level}: cuatro blancos en fase, uno penetrante en densa`, () => {
        const f = setup('vision', level), enemies = Array.from({ length: 5 }, (_, i) => f.spawn(80 + i * 12));
        f.tick(4); for (let i = 0; i < 3; i++) f.shoot(enemies[0]);
        assert.ok(enemies.slice(0, 4).every(e => e.hp < e.maxHp)); close(enemies[4].hp, enemies[4].maxHp);
        const before = enemies.map(e => e.hp);
        f.kit.setMode('dense'); assert.equal(f.shoot(enemies[0]).length, 0);
        f.tick(4); for (let i = 0; i < 3; i++) f.shoot(enemies[0]);
        assert.ok(enemies[0].hp < before[0]); for (let i = 1; i < 5; i++) close(enemies[i].hp, before[i]);
        assert.equal(f.kit.densityCooldown, 4); assert.equal(f.kit.densityCharge, 0);
    });
    test(`Star-Lord ${level}: segundo blanco complementario, no copia perfil del primario`, () => {
        const f = setup('star_lord', level), primary = f.spawn(), secondary = f.spawn(120);
        f.tick(1); const shots = f.shoot(primary);
        assert.equal(shots.length, 2); const second = shots[1]; assert.equal(second.target, secondary);
        close(second.damage, f.hero.getEffectiveStats().damage * 0.68 * f.kit.getPowerScale());
        assert.equal(second.effects[0].type, 'slow'); assert.equal(second.secondaryEntity, true);
        assert.equal(second.chainCount, 0); assert.equal(second.propagationCount, 0);
        assert.equal(f.shoot(primary).length, 1); assert.equal(f.hero.combatStats.abilityActivations, 1);
    });
    test(`Jean ${level}: preparacion, seis victimas y agotamiento sin carga`, () => {
        const f = setup('jean_grey', level), enemies = Array.from({ length: 7 }, (_, i) => f.spawn(80 + i * 12));
        f.kit.resource = 100; f.tick(12); const damage = f.kit.phoenixWave.damage;
        assert.equal(f.kit.resource, 0); assert.equal(f.shoot(enemies[0]).length, 0);
        f.tick(0.59); assert.ok(enemies.every(e => e.hp === e.maxHp)); f.tick(0.02);
        for (const e of enemies.slice(0, 6)) close(e.maxHp - e.hp, damage);
        close(enemies[6].hp, enemies[6].maxHp); close(enemies[6].x, 152);
        assert.equal(f.kit.phoenixExhaustion, 2); const tired = f.hero.getEffectiveStats().damage;
        f.shoot(enemies[0]); f.kit.onKill(); assert.equal(f.kit.resource, 0);
        f.tick(2); close(tired, f.hero.getEffectiveStats().damage * 0.75);
        f.shoot(enemies[0]); assert.ok(f.kit.resource > 0);
    });
}

for (const id of ['captain_marvel', 'vision', 'star_lord', 'jean_grey']) {
    for (const action of ['move', 'stun', 'sell']) {
        test(`${id}: ${action} cancela carga/estado sin perder nivel`, () => {
            const f = setup(id, 50), enemy = f.spawn();
            f.kit.resource = 100; f.tick(12); f.shoot(enemy);
            if (action === 'move') f.hero.x = 2;
            if (action === 'stun') f.hero.applyStun(1);
            if (action === 'sell') new TacticalActionSystem(f.game).sell(f.hero);
            f.hero.update(0, [], []);
            if (id === 'captain_marvel') { assert.equal(f.kit.binaryRun, null); assert.equal(f.kit.resource, 0); assert.equal(f.kit.cooldownRemaining, 9); }
            if (id === 'jean_grey') { assert.equal(f.kit.phoenixWave, null); assert.equal(f.kit.resource, 0); assert.equal(f.kit.cooldownRemaining, 12); }
            if (id === 'vision') { assert.equal(f.kit.densityCharge, 0); assert.equal(f.kit.densityCooldown, 4); }
            if (id === 'star_lord') assert.equal(f.kit.blasterCooldown, 1);
            assert.equal(f.hero.level, 50); assert.equal(f.game.resourceManager.lives, 20);
            assert.equal(f.game.resourceManager.credits, 0);
        });
    }
}

test('Captain: trayectoria fijada no gira con la presa y no dispara durante vuelo', () => {
    const f = setup('captain_marvel'), target = f.spawn(120), incidental = f.spawn(100);
    f.kit.resource = 60; f.tick(9); target.y = 100; f.tick(0.45);
    close(target.hp, target.maxHp); assert.ok(incidental.hp < incidental.maxHp);
    assert.equal(f.shoot(target).length, 0); f.tick(0.4); f.game.reduceMotion = true;
    assert.deepEqual(f.kit.visualOffset(), { x: 0, y: 0 }); assert.equal(f.hero.x, 0);
});

test('Captain y Jean no ganan alcance o cadencia por su carga', () => {
    for (const id of ['captain_marvel', 'jean_grey']) {
        const f = setup(id), base = f.hero.getEffectiveStats(); f.kit.resource = 100;
        const full = f.hero.getEffectiveStats(); close(full.range, base.range); close(full.fireRate, base.fireRate);
        assert.ok(full.damage > base.damage);
    }
});

test('Vision: cambiar modo cancela carga, bloquea1.25s y no admite alternancia instantanea', () => {
    const f = setup('vision'), e = f.spawn(); f.tick(4); f.shoot(e); f.shoot(e);
    f.kit.setMode('dense'); assert.equal(f.kit.densityCharge, 0); assert.equal(f.kit.setMode('phase'), false);
    f.tick(1.24); assert.equal(f.shoot(e).length, 0); f.tick(0.02); assert.equal(f.shoot(e).length, 1);
    const cd = f.kit.densityCooldown; f.kit.setMode('dense'); close(f.kit.densityCooldown, cd);
    f.kit.setMode('phase'); assert.equal(f.kit.densityCooldown, 4);
});

test('Vision: beam secundario no recarga firmas ni duplica bajas', () => {
    const f = setup('vision'), e = f.spawn(100, 0, { hp: 1 }); let kills = 0;
    f.hero.abilitySystem.onKill = () => kills++; f.tick(4);
    for (let i = 0; i < 3; i++) f.shoot(e);
    assert.equal(e.isAlive, false); assert.equal(kills, 0); assert.equal(f.hero.combatStats.kills, 1);
});

test('Star-Lord: ciclo complementario completo conserva municion emitida', () => {
    const f = setup('star_lord'), a = f.spawn(), b = f.spawn(120);
    for (const [mode, effect, penetration] of [['plasma', 'slow', 0], ['cryo', 'burn', 0], ['incendiary', null, 0.28]]) {
        f.kit.setMode(mode); f.tick(1); const second = f.shoot(a)[1];
        assert.equal(second.target, b); assert.equal(second.effects[0]?.type || null, effect);
        close(second.armorPenetration, penetration); f.kit.setMode('plasma');
        assert.equal(second.effects[0]?.type || null, effect);
    }
});

test('Star-Lord: aislado no tiene secundario ni consume su recarga', () => {
    const f = setup('star_lord'), a = f.spawn(); f.tick(1);
    assert.equal(f.shoot(a).length, 1); assert.equal(f.kit.blasterCooldown, 0);
    const escaped = f.spawn(130); escaped.hasReachedEnd = true;
    assert.equal(f.shoot(a).length, 1); assert.equal(f.kit.blasterCooldown, 0);
    f.kit.setMode('cryo'); assert.equal(f.kit.blasterCooldown, 0);
});

test('Star-Lord: secundario y su quemadura no duplican economia ni firmas por baja', () => {
    const f = setup('star_lord'), a = f.spawn(), b = f.spawn(120);
    f.hero.items = [{ effects: { onHitCredit: 5 } }]; let kills = 0;
    f.hero.abilitySystem.onKill = () => kills++;
    f.kit.setMode('cryo'); f.tick(1); const shots = f.shoot(a);
    CombatSystem.applyImpact(shots[0], a, f.hero, f.game.resourceManager);
    assert.equal(f.game.resourceManager.credits, 5);
    CombatSystem.applyImpact(shots[1], b, f.hero, f.game.resourceManager);
    assert.equal(f.game.resourceManager.credits, 5);
    const burn = b.debuffs.find(s => s.type === 'burn'); const dps = burn.damagePerSecond;
    f.hero.damage *= 10; close(burn.damagePerSecond, dps); b.hp = 0.1; b.updateDebuffs(1);
    assert.equal(kills, 0); assert.equal(f.hero.combatStats.kills, 1); assert.equal(f.game.resourceManager.credits, 5);
});

test('pool de proyectiles limpia marca secundaria al reutilizar y burn principal recupera autoria', () => {
    const f = setup('star_lord'), e = f.spawn();
    const shot = new Projectile(0, 0, e, { secondaryEntity: true }); shot.reset(0, 0, e, {});
    assert.equal(shot.secondaryEntity, false);
    let secondary;
    f.hero.recordKill = (resources, target, flag) => { secondary = flag; };
    e.applyStatus({ type: 'burn', power: 1, damageBasis: 'flat', duration: 4, secondaryEntity: true }, f.hero);
    e.applyStatus({ type: 'burn', power: 2, damageBasis: 'flat', duration: 4 }, f.hero);
    e.hp = 0.1; e.updateDebuffs(1); assert.equal(secondary, false);
});

test('Jean: onda respeta inmunes, voladores y retroceso reducido de miniboss/final', () => {
    const f = setup('jean_grey');
    const configs = [{}, { immuneToKnockback: true }, { flying: true }, { isBoss: true }, { isMiniBoss: true }, { isBoss: true, isFinalBoss: true }];
    const enemies = configs.map(c => f.spawn(130, 0, c)); f.kit.resource = 100; f.tick(12); f.tick(0.6);
    assert.deepEqual(enemies.map(e => e.x), [82, 130, 130, 110, 110, 110]);
});

test('Jean: muerte secundaria no rellena medidor; salir del radio esquiva onda', () => {
    const f = setup('jean_grey'), a = f.spawn(110, 0, { hp: 1 }), b = f.spawn(130);
    let kills = 0; f.hero.abilitySystem.onKill = () => kills++;
    f.kit.resource = 100; f.tick(12); b.x = 2000; f.tick(0.6);
    assert.equal(a.isAlive, false); close(b.hp, b.maxHp); assert.equal(kills, 0); assert.equal(f.kit.resource, 0);
});
