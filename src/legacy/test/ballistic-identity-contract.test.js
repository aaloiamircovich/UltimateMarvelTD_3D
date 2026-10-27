import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Hero } from '../src/entities/Hero.js';
import { Enemy } from '../src/entities/Enemy.js';
import { CombatSystem } from '../src/systems/CombatSystem.js';
import { getEvolutionForHero } from '../src/systems/EvolutionSystem.js';
import { TacticalActionSystem } from '../src/systems/TacticalActionSystem.js';

const heroes = JSON.parse(fs.readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8'));
const items = JSON.parse(fs.readFileSync(new URL('../data/items.json', import.meta.url), 'utf8'));
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
function setup(id, level = 1) {
    let hero;
    const game = {
        heroes: [], enemies: [], projectiles: [], random: { next: () => 0.99 },
        resourceManager: { lives: 20, credits: 0, addCredits(n) { this.credits += n; } },
        progression: { getHeroBonuses: () => null, getHeroEvolution: () => hero
            ? getEvolutionForHero(hero.config, {}, { level: hero.level, equippedItemIds: hero.items.map(item => item.id) }) : null }
    };
    hero = new Hero({ ...heroes[id], level }, 0, 0, game);
    game.heroes = [hero];
    const spawn = (x = 80, y = 0, extra = {}) => {
        const enemy = new Enemy({ id: 'target', category: hero.category, hp: 1e9, speed: 0, ...extra },
            [{ x, y }, { x: 10000, y }], game);
        game.enemies.push(enemy);
        return enemy;
    };
    const shoot = (target) => {
        const shots = [];
        hero.shoot(target, hero.getEffectiveStats(), shots);
        assert.equal(shots.length, 1);
        return shots[0];
    };
    return { hero, game, spawn, shoot };
}

for (const level of [1, 49, 50, 51, 99, 100]) {
    test(`Winter Soldier: ciclo y remate escalan con dano, nivel ${level}`, () => {
        const f = setup('winter_soldier', level), target = f.spawn();
        const damage = f.hero.getEffectiveStats().damage;
        const shots = Array.from({ length: 6 }, () => f.shoot(target));
        shots.forEach((shot, i) => {
            close(shot.damage, damage * (i % 3 === 2 ? 1.6 : 0.85));
            close(shot.armorPenetration, i % 3 === 2 ? 0.85 : 0.65);
        });
        assert.equal(f.hero.combatStats.abilityActivations, 2);
        assert.equal(f.hero.combatStats.shots, 6);
    });
    test(`Punisher: rampa limitada sin cambiar estadisticas base, nivel ${level}`, () => {
        const f = setup('punisher', level), target = f.spawn();
        const stats = f.hero.getEffectiveStats();
        for (let i = 0; i < 12; i++) close(f.shoot(target).damage, stats.damage * (1 + Math.min(i, 4) * 0.08));
        assert.deepEqual(f.hero.getEffectiveStats(), stats);
        assert.equal(f.hero.abilitySystem.getDisplayState().label, 'Fuego sostenido +32%');
        assert.equal(f.game.resourceManager.lives, 20);
        assert.equal(f.game.resourceManager.credits, 0);
    });
}

test('Winter: electrica determinista solo en remate; cambiar modo no recarga', () => {
    const f = setup('winter_soldier'), target = f.spawn();
    f.hero.abilitySystem.setCombatMode('shock');
    const first = f.shoot(target), second = f.shoot(target), third = f.shoot(target);
    assert.equal(first.effects.some(e => e.type === 'stun'), false);
    assert.equal(second.effects.some(e => e.type === 'stun'), false);
    assert.deepEqual(third.effects.find(e => e.type === 'stun'), { type: 'stun', duration: 0.6, power: 1, chance: 1 });
    f.hero.abilitySystem.setCombatMode('explosive');
    assert.equal(f.shoot(target).splashRadius, 64);
    f.shoot(target);
    const finisher = f.shoot(target);
    assert.equal(finisher.splashRadius, 90);
    f.hero.abilitySystem.setCombatMode('piercing');
    assert.equal(finisher.splashRadius, 90);
    assert.equal(third.effects[0].type, 'stun');
    assert.equal(f.hero.abilitySystem.mutantKit.attackCount, 6);
});

test('Winter: cambio antes del remate usa la nueva municion y conserva timer', () => {
    const f = setup('winter_soldier'), target = f.spawn();
    f.shoot(target); f.shoot(target);
    f.hero.timer = 0.2;
    f.hero.abilitySystem.setCombatMode('shock');
    assert.equal(f.hero.timer, 0.2);
    assert.equal(f.hero.abilitySystem.getDisplayState().ready, true);
    assert.ok(f.shoot(target).effects.some(e => e.type === 'stun'));
    assert.equal(f.hero.abilitySystem.getDisplayState().ready, false);
});

test('Winter: sin blanco y aturdido no genera disparos ni carga', () => {
    const f = setup('winter_soldier');
    f.hero.update(3, [], []);
    f.hero.stunTimer = 2;
    f.hero.update(1, [f.spawn()], []);
    assert.equal(f.hero.abilitySystem.mutantKit.attackCount, 0);
});

for (const reason of ['blanco', 'tiempo', 'movimiento', 'stun', 'fuera', 'sigilo', 'muerto', 'diagonal']) {
    test(`Punisher: pierde rampa por ${reason}`, () => {
        const f = setup('punisher'), target = f.spawn();
        for (let i = 0; i < 4; i++) f.shoot(target);
        assert.equal(f.hero.abilitySystem.getAttackDamageMultiplier(target), 1.32);
        let next = target;
        if (reason === 'blanco') next = f.spawn(100);
        if (reason === 'tiempo') f.hero.visualTime += 2;
        if (reason === 'movimiento') f.hero.x += 10;
        if (reason === 'stun') { f.hero.stunTimer = 1; f.hero.update(1, [], []); }
        if (reason === 'fuera') target.x = 10000;
        if (reason === 'sigilo') target.stealth = true;
        if (reason === 'muerto') target.isAlive = false;
        if (reason === 'diagonal') { target.x = 120; target.y = 120; }
        assert.equal(f.hero.abilitySystem.getAttackDamageMultiplier(next), 1);
        if (reason === 'blanco') {
            close(f.shoot(next).damage, f.hero.getEffectiveStats().damage);
            assert.equal(f.hero.abilitySystem.getAttackDamageMultiplier(target), 1);
        }
    });
}

test('Punisher: perder y recuperar alcance no restaura la rampa', () => {
    const f = setup('punisher'), target = f.spawn();
    f.shoot(target);
    target.x = 10000;
    f.hero.update(0.1, [target], []);
    target.x = 80;
    assert.equal(f.hero.abilitySystem.getAttackDamageMultiplier(target), 1);
});

test('retiro elimina supresion y redespliegue empieza sin carga', () => {
    for (const id of ['punisher', 'winter_soldier']) {
        const f = setup(id), target = f.spawn();
        f.shoot(target); f.shoot(target);
        assert.equal(new TacticalActionSystem(f.game).sell(f.hero).ok, true);
        const replacement = new Hero({ ...heroes[id], level: 50 }, 0, 0, f.game);
        assert.equal(replacement.abilitySystem.mutantKit.attackCount, 0);
        assert.equal(replacement.abilitySystem.streetKit.suppression, null);
        assert.equal(f.hero.abilitySystem.streetKit.suppression, null);
    }
});

test('secundarios no cargan supresion ni rafaga', () => {
    for (const id of ['punisher', 'winter_soldier']) {
        const f = setup(id), target = f.spawn(); f.spawn(90);
        if (id === 'winter_soldier') f.hero.abilitySystem.setCombatMode('explosive');
        const shot = f.shoot(target);
        CombatSystem.applyImpact(shot, target, f.hero, f.game.resourceManager);
        assert.equal(f.hero.abilitySystem.mutantKit.attackCount, 1);
        if (id === 'punisher') assert.equal(f.hero.abilitySystem.streetKit.suppression.stacks, 1);
        assert.equal(f.hero.combatStats.shots, 1);
    }
});

test('60 disparos: Winter gana 10% sin armadura; Punisher premia mantener blanco', () => {
    const winter = setup('winter_soldier'), wt = winter.spawn();
    const base = winter.hero.getEffectiveStats().damage;
    let total = 0;
    for (let i = 0; i < 60; i++) total += winter.shoot(wt).damage;
    close(total, base * 60 * 1.1);
    const f = setup('punisher'), a = f.spawn(), b = f.spawn(100);
    const power = f.hero.getEffectiveStats().damage;
    let sustained = 0;
    for (let i = 0; i < 60; i++) sustained += f.shoot(a).damage;
    close(sustained / (60 * power), 1.3066666666666666);
    let switching = 0;
    for (let i = 0; i < 60; i++) switching += f.shoot(i % 2 ? a : b).damage;
    close(switching, power * 60);
});

for (const [id, itemId] of [['winter_soldier', 'nucleo_adaptativo'], ['punisher', 'armadura_war_machine']]) {
    test(`${id}: diez disparos reales activan objeto sin duplicar ciclo ni cargas`, () => {
        const f = setup(id, 50), target = f.spawn();
        f.hero.items = [items[itemId]];
        const shots = [];
        for (let i = 0; i < 10; i++) f.hero.shoot(target, f.hero.getEffectiveStats(), shots);
        assert.equal(f.hero.combatStats.shots, 10);
        if (id === 'winter_soldier') {
            assert.equal(f.hero.abilitySystem.mutantKit.attackCount, 10);
            assert.equal(f.hero.signatureState[itemId].timedBuff.remaining, 3.2);
            assert.equal(f.hero.combatStats.abilityActivations, 4);
        } else {
            assert.equal(f.hero.abilitySystem.streetKit.suppression.stacks, 4);
            assert.equal(f.hero.combatStats.abilityActivations, 1);
            assert.ok(shots.length > 10 && shots.length <= 13);
        }
    });
}

test('60 segundos reales: no duplica proyectiles; stun electrico deja ventanas de movimiento', () => {
    for (const id of ['winter_soldier', 'punisher']) {
        const f = setup(id), target = f.spawn(80, 0, { speed: 1 });
        if (id === 'winter_soldier') f.hero.abilitySystem.setCombatMode('shock');
        let count = 0, stunnedSeconds = 0;
        const rate = f.hero.getEffectiveStats().fireRate;
        for (let frame = 0; frame < 3600; frame++) {
            const shots = [];
            f.hero.update(1 / 60, [target], shots);
            count += shots.length;
            for (const shot of shots) CombatSystem.applyImpact(shot, target, f.hero, f.game.resourceManager);
            if (target.debuffs.some(effect => effect.type === 'stun')) stunnedSeconds += 1 / 60;
            target.update(1 / 60);
        }
        assert.equal(count, f.hero.combatStats.shots);
        assert.ok(count <= Math.ceil(rate * 60) && count >= rate * 58, `${id}: ${count} disparos, cadencia ${rate}`);
        assert.ok(target.x > 100);
        if (id === 'winter_soldier') assert.ok(stunnedSeconds > 5 && stunnedSeconds < 20);
        else assert.equal(stunnedSeconds, 0);
    }
});
