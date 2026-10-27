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
    const game = { heroes: [], enemies: [], gridSize: 40, terrainMap: [[3, 1, 2]], random: { next: () => 0.99 },
        resourceManager: { lives: 20, credits: 0, addCredits(n) { this.credits += n; } },
        progression: { getHeroBonuses: () => null, getHeroEvolution: () => hero
            ? getEvolutionForHero(hero.config, {}, { level, equippedItemIds: [] }) : null } };
    hero = new Hero({ ...heroes[id], level }, 0, 0, game); game.heroes = [hero];
    const spawn = (extra = {}) => {
        const enemy = new Enemy({ id: 'target', category: hero.category, hp: 1e8, speed: 1, ...extra },
            [{ x: 40, y: 0 }, { x: 1000, y: 0 }], game);
        game.enemies.push(enemy); return enemy;
    };
    const shoot = target => { const shots = []; hero.shoot(target, hero.getEffectiveStats(), shots); return shots[0]; };
    const kit = hero.abilitySystem.martialKit || hero.abilitySystem.focusKit;
    const update = dt => kit.update(dt);
    return { hero, game, spawn, shoot, kit, update };
}

for (const level of [1, 49, 50, 51, 99, 100]) {
    test(`Valkyrie ${level}: carga real de terreno, consume al disparar y conserva posicion`, () => {
        const f = setup('valkyrie', level), target = f.spawn(); const base = f.hero.getEffectiveStats().damage;
        close(f.shoot(target).damage, base); f.update(4.99); close(f.shoot(target).damage, base);
        f.update(0.02); close(f.shoot(target).damage, base * 1.75);
        assert.equal(f.kit.cooldown, 5); close(f.shoot(target).damage, base);
        assert.equal(f.hero.x, 0); assert.equal(f.hero.y, 0);
        f.game.terrainMap[0][0] = 1; f.update(20); close(f.shoot(target).damage, base);
        assert.equal(f.kit.cooldown, 5);
        f.game.terrainMap[0][0] = 3; f.update(5); close(f.shoot(target).damage, base * 1.75);
        assert.equal(f.hero.getProjectileEffects(target).find(e => e.type === 'bleed').power, 0.2);
    });
    test(`Rogue ${level}: armadura prestada acotada 3s, no acumula ni altera al enemigo`, () => {
        const f = setup('rogue', level), target = f.spawn({ armor: 75 });
        const base = f.hero.getEffectiveStats(), pen = f.hero.getProjectileProfile().armorPenetration;
        f.shoot(target); assert.equal(f.kit.trait, null); f.update(6);
        const shot = f.shoot(target); close(shot.armorPenetration, pen);
        close(f.hero.getProjectileProfile().armorPenetration, Math.min(0.85, pen + 0.2));
        for (let i = 0; i < 8; i++) f.shoot(target);
        assert.equal(f.kit.remaining, 3); assert.equal(f.kit.cooldown, 6); assert.equal(target.armor, 75);
        close(f.hero.getEffectiveStats().damage, base.damage); close(f.hero.getEffectiveStats().fireRate, base.fireRate);
        f.update(3); assert.equal(f.kit.trait, null); close(f.hero.getProjectileProfile().armorPenetration, pen);
    });
    test(`Beast ${level}: tercera entrada de pareja activa golpe limitado y slow resistible`, () => {
        const f = setup('beast', level), a = f.spawn(), b = f.spawn({ statusResistance: 0.5 }); b.x = 60;
        const damage = f.hero.getEffectiveStats().damage; f.update(3);
        f.shoot(a); f.shoot(a); assert.equal(b.hp, b.maxHp); assert.equal(f.kit.charge, 2);
        f.shoot(a); close(b.maxHp - b.hp, damage * 0.65);
        close(b.debuffs.find(e => e.type === 'slow').duration, b.getStatusDuration('slow', 1.5));
        assert.equal(f.kit.charge, 0); assert.equal(f.kit.cooldown, 3);
        for (let i = 0; i < 6; i++) f.shoot(a);
        close(b.maxHp - b.hp, damage * 0.65); assert.equal(f.hero.combatStats.abilityActivations, 1);
        assert.equal(f.hero.getProjectileProfile().chainCount, 1);
    });
    test(`Drax ${level}: 8% por ataque previo, techo40%, solo elite y sin cadencia extra`, () => {
        const f = setup('drax', level), target = f.spawn({ isBoss: true }), common = f.spawn();
        const base = f.hero.getEffectiveStats();
        for (let i = 0; i < 12; i++) close(f.shoot(target).damage, base.damage * (1 + Math.min(i, 5) * 0.08));
        close(f.shoot(common).damage, base.damage); assert.equal(f.kit.stacks, 0);
        close(f.shoot(target).damage, base.damage);
        close(f.hero.getEffectiveStats().fireRate, base.fireRate);
        assert.equal(f.hero.getProjectileEffects(target).find(e => e.type === 'bleed').power, 0.2);
    });
}

for (const id of ['valkyrie', 'rogue', 'beast', 'drax']) {
    for (const reason of ['mover', 'stun', 'retirar']) {
        test(`${id}: estado no sobrevive ${reason}`, () => {
            const f = setup(id), a = f.spawn({ armor: 50, threat: 4 }), b = f.spawn(); b.x = 60;
            f.update(6); for (let i = 0; i < 2; i++) f.shoot(a);
            if (id === 'valkyrie') f.update(5);
            if (reason === 'mover') f.hero.x = 1;
            if (reason === 'stun') f.hero.stunTimer = 1;
            if (reason === 'retirar') new TacticalActionSystem(f.game).sell(f.hero);
            f.update(0);
            if (id === 'drax') assert.equal(f.kit.stacks, 0);
            else { assert.equal(f.kit.trait, null); assert.equal(f.kit.charge, 0); assert.ok(f.kit.cooldown > 0); }
        });
    }
}

for (const trait of ['runner', 'flying']) {
    test(`Rogue: rasgo ${trait} no crece por ataques repetidos ni cambia dano`, () => {
        const f = setup('rogue'), target = f.spawn({ archetype: trait }); const base = f.hero.getEffectiveStats();
        f.update(6); f.shoot(target);
        const stats = f.hero.getEffectiveStats();
        close(stats.damage, base.damage); close(stats.fireRate, base.fireRate * (trait === 'runner' ? 1.15 : 1));
        close(stats.range, base.range * (trait === 'flying' ? 1.15 : 1));
        for (let i = 0; i < 6; i++) f.shoot(target);
        close(f.hero.getEffectiveStats().fireRate, stats.fireRate); close(f.hero.getEffectiveStats().range, stats.range);
        f.update(3); close(f.hero.getEffectiveStats().fireRate, base.fireRate); close(f.hero.getEffectiveStats().range, base.range);
    });
}

test('Rogue: lista cerrada y flags de boss, ninguna copia de curacion/inmunidades/pasivas', () => {
    for (const flag of ['isBoss', 'isMiniBoss', 'isFinalBoss']) {
        const f = setup('rogue'), target = f.spawn({ [flag]: true, armor: 50 }); f.update(6); f.shoot(target);
        assert.equal(f.kit.trait, null); assert.equal(f.kit.cooldown, 0);
        target[flag] = false; f.shoot(target); assert.equal(f.kit.trait, null);
    }
    const f = setup('rogue'); f.update(6); f.shoot(f.spawn({ archetype: 'support', immuneToStun: true }));
    assert.equal(f.kit.trait, null); assert.equal(f.kit.cooldown, 0);
    f.shoot(f.spawn({ armor: 1, archetype: 'runner', flying: true })); assert.equal(f.kit.trait, 'armor');
});

for (const reason of ['aislado', 'sigilo', 'fuera', 'muerto', 'separado', 'pausa', 'pareja']) {
    test(`Beast: rompe preparacion por ${reason}`, () => {
        const f = setup('beast'), a = f.spawn(), b = f.spawn(); b.x = 60;
        f.update(3); f.shoot(a); f.shoot(a);
        if (reason === 'aislado') { f.game.enemies = [a]; f.shoot(a); }
        if (reason === 'sigilo') b.stealth = true;
        if (reason === 'fuera') b.x = 1000;
        if (reason === 'muerto') b.isAlive = false;
        if (reason === 'separado') { a.x = -40; b.x = 60; }
        if (reason === 'pareja') { const c = f.spawn(); c.x = 41; f.shoot(a); }
        f.update(reason === 'pausa' ? 2.5 : 0);
        assert.ok(f.kit.charge < 2); assert.equal(b.hp, b.maxHp);
    });
}

test('Beast: no sortea armadura ni inmunidad a slow con golpe especial', () => {
    const f = setup('beast'), a = f.spawn(), b = f.spawn({ armor: 80, immuneToSlow: true }); b.x = 60;
    f.update(3); f.shoot(a); f.shoot(a); f.shoot(a);
    close(b.maxHp - b.hp, f.hero.getEffectiveStats().damage * 0.65 * 0.2);
    assert.equal(b.debuffs.length, 0);
});

for (const reason of ['cambiar', 'sigilo', 'fuera', 'muerto', 'pausa']) {
    test(`Drax: pierde duelo por ${reason}`, () => {
        const f = setup('drax'), a = f.spawn({ threat: 4 }); for (let i = 0; i < 5; i++) f.shoot(a);
        if (reason === 'cambiar') f.shoot(f.spawn({ threat: 4 }));
        if (reason === 'sigilo') a.stealth = true;
        if (reason === 'fuera') a.x = 10000;
        if (reason === 'muerto') a.isAlive = false;
        f.update(reason === 'pausa' ? 2.5 : 0);
        assert.equal(f.kit.damageMultiplier(a), 1);
    });
}

test('Valkyrie: sin mapa o sobre casilla bloqueada no inventa altura', () => {
    const f = setup('valkyrie'), a = f.spawn();
    for (const terrain of [0, 1, 2, 4, 5, 11, 12, undefined]) {
        f.game.terrainMap[0][0] = terrain; f.update(5); assert.equal(f.kit.damageMultiplier(a), 1);
    }
    f.game.terrainMap = null; f.update(10); assert.equal(f.kit.damageMultiplier(a), 1);
});

test('cuatro heroes: sin oro, curacion, cambios de rareza ni prioridad automatica', () => {
    for (const id of ['valkyrie', 'rogue', 'beast', 'drax']) {
        const f = setup(id); f.hero.targetingPriority = 'Debil'; const a = f.spawn({ armor: 50, threat: 4 }); f.spawn();
        for (let i = 0; i < 20; i++) { f.update(1); f.shoot(a); }
        assert.equal(f.game.resourceManager.lives, 20); assert.equal(f.game.resourceManager.credits, 0);
        assert.equal(f.hero.targetingPriority, 'Debil'); assert.ok(f.hero.abilitySystem.getDisplayState().label);
        assert.equal(heroes[id].rarity, ['rogue', 'beast'].includes(id) ? 'Epic' : 'Rare');
    }
});
