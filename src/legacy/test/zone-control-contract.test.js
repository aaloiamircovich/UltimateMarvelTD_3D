import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Hero } from '../src/entities/Hero.js';
import { Enemy } from '../src/entities/Enemy.js';
import { TacticalActionSystem } from '../src/systems/TacticalActionSystem.js';
import { getEvolutionForHero } from '../src/systems/EvolutionSystem.js';

const roster = JSON.parse(fs.readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8'));
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
function setup(id, level = 1) {
    let hero;
    const game = { heroes: [], enemies: [], random: { next: () => 0.99 }, resourceManager: { lives: 20, credits: 0 },
        progression: { getHeroBonuses: () => null, getHeroEvolution: () => hero
            ? getEvolutionForHero(hero.config, {}, { level, equippedItemIds: [] }) : null } };
    hero = new Hero({ ...roster[id], level }, 0, 0, game);
    game.heroes.push(hero);
    const spawn = (x = 60, y = 0, extra = {}) => {
        const e = new Enemy({ id: 'target', category: hero.category, hp: 1e8, speed: 100, ...extra }, [{ x: 0, y: 0 }, { x: 1000, y: 0 }], game);
        Object.assign(e, { x, y, distanceTravelled: x }); game.enemies.push(e); return e;
    };
    const attack = e => hero.abilitySystem.onAttack(e, hero.getEffectiveStats(), {}, []);
    const update = dt => {
        hero.abilitySystem.controlKit?.update(dt);
        hero.abilitySystem.update(dt, game.enemies, hero.getEffectiveStats(), []);
    };
    return { hero, game, spawn, attack, update };
}

for (const level of [1, 49, 50, 51, 99, 100]) {
    test(`Groot ${level}: campo terrestre local, sin slow de ataque ni desplazamiento`, () => {
        const f = setup('groot', level), target = f.spawn(), flying = f.spawn(61, 0, { flying: true });
        f.update(0); assert.equal(f.hero.abilitySystem.cosmicKit.rootWall, null);
        f.update(10); target.updateDebuffs(0); flying.updateDebuffs(0);
        close(target.speed, 32); close(flying.speed, 100);
        assert.equal(target.x, 60); assert.equal(target.hp, target.maxHp);
        assert.equal(f.hero.getProjectileEffects(target).length, 0);
        target.x = 200; target.updateDebuffs(0); close(target.speed, 100);
    });
    test(`Daredevil ${level}: radio inclusivo y ventana2s sin vision global`, () => {
        const f = setup('daredevil', level), near = f.spawn(190, 0, { stealth: true }), far = f.spawn(190.01, 0, { stealth: true });
        const ally = new Hero(roster.hulk, 0, 0, f.game); f.game.heroes.push(ally);
        f.update(0); assert.equal(near.stealth, true); f.update(8);
        assert.equal(near.stealth, false); assert.equal(far.stealth, true);
        assert.equal(ally.getEffectiveStats().canSeeStealth, false);
        near.updateDebuffs(2); assert.equal(near.stealth, true);
        assert.equal(f.hero.abilitySystem.streetKit.radarPulseTimer, 8);
    });
    test(`Quake ${level}: cinco terrestres maximo, linea y dano efectivo`, () => {
        const f = setup('quake', level), targets = Array.from({ length: 7 }, (_, i) => f.spawn(40 + i * 10));
        const flyer = f.spawn(60, 0, { flying: true }), outside = f.spawn(60, 24.01);
        const damage = f.hero.getEffectiveStats().damage; f.update(4); f.attack(targets[0]);
        assert.equal(targets.filter(e => e.hp < e.maxHp).length, 5);
        close(targets[0].maxHp - targets[0].hp, damage * 0.45);
        assert.equal(flyer.hp, flyer.maxHp); assert.equal(outside.hp, outside.maxHp);
        assert.equal(targets[0].debuffs.length, 2); assert.equal(targets[0].x, 40);
        for (let i = 0; i < 50; i++) f.attack(targets[0]);
        assert.equal(f.hero.combatStats.abilityActivations, 1);
    });
    test(`Medusa ${level}: tres enlaces y presupuesto60% repartido`, () => {
        const f = setup('medusa', level), targets = Array.from({ length: 5 }, (_, i) => f.spawn(60 + i));
        f.update(5); f.attack(targets[0]);
        targets.forEach(e => e.updateDebuffs(0));
        assert.equal(targets.filter(e => e.speed < 100).length, 3);
        close(targets[0].speed, 80); assert.equal(f.hero.abilitySystem.controlKit.cooldown, 5);
        assert.equal(f.hero.getProjectileProfile().chainCount, 1);
        assert.equal(f.hero.getProjectileEffects(targets[0]).length, 0);
    });
}

for (const id of ['groot', 'medusa']) {
    for (const action of ['move', 'stun', 'sell']) {
        test(`${id}: ${action} cancela campo sin borrar slow aliado`, () => {
            const f = setup(id), e = f.spawn(); f.update(10); if (id === 'medusa') f.attack(e);
            e.applyStatus({ type: 'slow', power: 0.1, duration: 9 }, { id: 'ally' });
            if (action === 'move') f.hero.x++;
            if (action === 'stun') f.hero.applyStun(1);
            if (action === 'sell') new TacticalActionSystem(f.game).sell(f.hero);
            e.updateDebuffs(0); close(e.speed, 90);
            assert.equal(e.debuffs.length, 1); assert.equal(e.debuffs[0].source.id, 'ally');
        });
    }
    test(`${id}: inmunidad y resistencia no se renuevan por frame`, () => {
        const f = setup(id), immune = f.spawn(60, 0, { immuneToSlow: true }), resistant = f.spawn(61, 0, { statusResistance: 0.5 });
        f.update(10); if (id === 'medusa') f.attack(immune);
        assert.equal(immune.debuffs.length, 0);
        const duration = resistant.debuffs[0].duration;
        close(duration, id === 'groot' ? 1.6 : 1);
        resistant.updateDebuffs(duration); f.update(0.01); resistant.updateDebuffs(0);
        close(resistant.speed, 100);
    });
}

test('Medusa separacion del ancla y fin de ventana liberan sin dano', () => {
    const f = setup('medusa'), anchor = f.spawn(10), other = f.spawn(90);
    f.update(5); f.attack(anchor); close(other.debuffs[0].power, 0.3);
    other.x = 96; other.updateDebuffs(0); close(other.speed, 100);
    f.update(2); anchor.updateDebuffs(0); close(anchor.speed, 100);
    assert.equal(anchor.hp, anchor.maxHp);
});

test('Medusa un objetivo recibe60% y no enlaza ocultos ni fuera de alcance', () => {
    const f = setup('medusa'), anchor = f.spawn(100), hidden = f.spawn(101, 0, { stealth: true }), far = f.spawn(f.hero.getEffectiveStats().range + 1);
    f.update(5); f.attack(anchor); close(anchor.debuffs[0].power, 0.6);
    assert.equal(hidden.debuffs.length, 0); assert.equal(far.debuffs.length, 0);
});

test('Quake no gasta onda contra volador; resistencia e inmunidad respetadas', () => {
    const f = setup('quake'), flyer = f.spawn(60, 0, { flying: true }), ground = f.spawn(80, 0, { immuneToSlow: true, statusResistance: 0.5 });
    f.update(4); f.attack(flyer); assert.equal(f.hero.abilitySystem.controlKit.cooldown, 0);
    f.attack(ground); assert.equal(ground.debuffs.length, 1); close(ground.debuffs[0].duration, 1);
    assert.equal(ground.debuffs[0].type, 'armorBreak');
});

test('Quake preparacion se reinicia al moverse y Medusa pierde el ancla muerta', () => {
    const f = setup('quake'), e = f.spawn(); f.update(4); f.hero.x++; f.update(0); f.attack(e);
    assert.equal(e.hp, e.maxHp); assert.equal(f.hero.abilitySystem.controlKit.cooldown, 4);
    const m = setup('medusa'), a = m.spawn(), b = m.spawn(61); m.update(5); m.attack(a); a.isAlive = false;
    b.updateDebuffs(0); close(b.speed, 100);
});

test('Groot vence sin reaplicar ni afectar voladores como ancla', () => {
    const f = setup('groot'); f.spawn(60, 0, { flying: true }); f.update(10);
    assert.equal(f.hero.abilitySystem.cosmicKit.rootWall, null);
    const e = f.spawn(); f.update(0); f.update(3.2); e.updateDebuffs(0);
    close(e.speed, 100); assert.equal(f.hero.abilitySystem.cosmicKit.rootWall, null);
});

test('Daredevil no consume pulso vacio; respeta resistencia y conserva contraataque', () => {
    const f = setup('daredevil'); f.update(8); assert.equal(f.hero.combatStats.abilityActivations, 0);
    const e = f.spawn(60, 0, { stealth: true, statusResistance: 0.5 }); f.update(0);
    close(e.debuffs[0].duration, 1);
    for (let i = 0; i < 4; i++) f.attack(e);
    assert.ok(e.hp < e.maxHp); assert.equal(f.game.resourceManager.lives, 20);
});
