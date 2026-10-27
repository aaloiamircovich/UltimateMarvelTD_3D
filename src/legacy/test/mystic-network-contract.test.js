import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Hero } from '../src/entities/Hero.js';
import { Enemy } from '../src/entities/Enemy.js';
import { CombatSystem } from '../src/systems/CombatSystem.js';
import { TacticalActionSystem } from '../src/systems/TacticalActionSystem.js';
import { getEvolutionForHero } from '../src/systems/EvolutionSystem.js';

const roster = JSON.parse(fs.readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8'));
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
function setup(id, level = 1) {
    let hero;
    const game = { heroes: [], enemies: [], random: { next: () => 0.99 }, resourceManager: { lives: 20, credits: 0 },
        progression: { getHeroBonuses: () => null,
            getHeroEvolution: () => hero ? getEvolutionForHero(hero.config, {}, { level, equippedItemIds: [] }) : null } };
    hero = new Hero({ ...roster[id], level }, 0, 0, game); game.heroes.push(hero);
    const spawn = (x = 80, y = 0, extra = {}) => {
        const e = new Enemy({ id: 'target', category: hero.category, hp: 1e8, speed: 100, ...extra }, [{ x: 0, y: 0 }, { x: 1000, y: 0 }], game);
        Object.assign(e, { x, y, distanceTravelled: x }); game.enemies.push(e); return e;
    };
    const curse = enemy => enemy.applyStatus({ type: 'curse', power: 0.001, duration: 10 }, hero);
    const shoot = target => { const shots = []; hero.shoot(target, hero.getEffectiveStats(), shots); return shots[0]; };
    return { hero, game, spawn, shoot, curse, kit: hero.abilitySystem.mysticKit };
}

for (const level of [1, 49, 50, 51, 99, 100]) {
    test(`Scarlet ${level}: red preparada de4, dos segundos y dano capturado`, () => {
        const f = setup('scarlet_witch', level), targets = Array.from({ length: 6 }, (_, i) => f.spawn(80 + i));
        targets.forEach(f.curse); const damage = f.hero.getEffectiveStats().damage;
        f.kit.update(7); f.shoot(targets[0]); assert.equal(f.kit.network.targets.length, 4);
        f.kit.update(1.9); assert.ok(targets.every(e => e.hp === e.maxHp));
        f.kit.update(0.11);
        for (const e of targets.slice(0, 4)) close(e.maxHp - e.hp, damage * 0.7);
        for (const e of targets.slice(4)) close(e.hp, e.maxHp);
        assert.equal(f.kit.network, null); assert.equal(f.hero.abilitySystem.attackCount, 1);
        assert.equal(f.hero.getProjectileProfile().chainCount, 2);
        assert.equal(f.hero.getProjectileEffects(targets[0]).find(e => e.type === 'curse').power, 0.0048);
    });
    test(`Cloak ${level}: ventana65px, seis victimas y slow42% sin desplazamiento`, () => {
        const f = setup('cloak', level), targets = Array.from({ length: 8 }, (_, i) => f.spawn(80 + i, 0, { stealth: true }));
        f.kit.update(6); f.shoot(targets[0]);
        assert.equal(targets.filter(e => !e.stealth).length, 6);
        for (const e of targets.slice(0, 6)) { e.updateDebuffs(0); close(e.speed, 58); close(e.hp, e.maxHp); }
        f.kit.update(3); assert.ok(targets.every(e => e.stealth));
        targets[0].updateDebuffs(0); close(targets[0].speed, 100); close(targets[0].x, 80);
        assert.equal(f.hero.getProjectileEffects(targets[0]).length, 0);
    });
    test(`Dagger ${level}: consume hasta3 marcas propias y conserva marca aliada`, () => {
        const f = setup('dagger', level), targets = Array.from({ length: 4 }, (_, i) => f.spawn(80 + i));
        f.kit.update(3); targets.forEach(f.shoot);
        targets.forEach(e => e.applyStatus({ type: 'mark', power: 0.2, duration: 10 }, { id: 'ally' }));
        const power = f.hero.getEffectiveStats().damage;
        f.kit.update(1); f.shoot(targets[0]);
        for (const e of targets.slice(0, 3)) { close(e.maxHp - e.hp, power * 0.65 * 1.2); assert.equal(f.kit.hasMark(e), false); }
        close(targets[3].hp, targets[3].maxHp); assert.equal(f.kit.hasMark(targets[3]), true);
        assert.ok(targets.every(e => e.debuffs.some(s => s.source.id === 'ally')));
        assert.equal(f.kit.cooldown, 4); assert.equal(f.hero.getProjectileProfile().chainCount, 1);
        assert.equal(f.game.resourceManager.lives, 20);
    });
    test(`Magik ${level}: corte1.5x, ruptura al impacto y retorno0.6x`, () => {
        const f = setup('magik', level), e = f.spawn(); f.curse(e); f.kit.update(6);
        const power = f.hero.getEffectiveStats().damage, shot = f.shoot(e);
        close(shot.damage, power * 1.5); assert.equal(e.debuffs.some(s => s.type === 'armorBreak'), false);
        f.kit.update(0.4); close(e.maxHp - e.hp, power * 0.6); assert.equal(f.kit.returnCut, null);
        CombatSystem.applyImpact(shot, e, f.hero, f.game.resourceManager);
        close(e.debuffs.find(s => s.type === 'armorBreak').power, 0.2);
        close(f.shoot(e).damage, power); assert.equal(f.hero.combatStats.abilityActivations, 1);
    });
}

for (const id of ['scarlet_witch', 'cloak', 'dagger', 'magik']) {
    for (const action of ['move', 'stun', 'sell']) {
        test(`${id}: ${action} cancela estado pendiente sin perder nivel ni curar`, () => {
            const f = setup(id, 50), a = f.spawn(), b = f.spawn(90); f.curse(a); f.curse(b);
            f.kit.update(7); f.shoot(a);
            if (action === 'move') f.hero.x = 1;
            if (action === 'stun') f.hero.applyStun(1);
            if (action === 'sell') new TacticalActionSystem(f.game).sell(f.hero);
            f.hero.update(0, f.game.enemies, []);
            assert.ok(f.kit.cooldown > 0); assert.equal(f.kit.network, null); assert.equal(f.kit.window, null);
            assert.equal(f.kit.returnCut, null); assert.equal(f.kit.marks.size, 0);
            assert.equal(f.hero.level, 50); assert.deepEqual(f.game.resourceManager, { lives: 20, credits: 0 });
        });
    }
}

test('Scarlet: aislamiento no consume, separar enlaces o perder maldicion cancela sin detonacion', () => {
    for (const mode of ['separate', 'uncurse', 'dead', 'escape']) {
        const f = setup('scarlet_witch'), a = f.spawn(); f.curse(a); f.kit.update(7); f.shoot(a);
        assert.equal(f.kit.cooldown, 0);
        const b = f.spawn(90); f.curse(b); f.shoot(a);
        if (mode === 'separate') b.x = 200;
        if (mode === 'uncurse') a.debuffs = [];
        if (mode === 'dead') a.isAlive = false;
        if (mode === 'escape') b.hasReachedEnd = true;
        f.kit.update(2); assert.equal(f.kit.network, null); close(b.hp, b.maxHp);
    }
});

test('Scarlet: no detonacion recursiva ni nueva red por cadencia y respeta cobertura', () => {
    const f = setup('scarlet_witch'), a = f.spawn(180), b = f.spawn(190), outside = f.spawn(250);
    [a, b, outside].forEach(f.curse); f.kit.update(7); f.shoot(a);
    assert.deepEqual(f.kit.network.targets, [a, b]); const damage = f.kit.network.damage;
    f.hero.level = 100; for (let i = 0; i < 100; i++) f.shoot(a); f.kit.update(2);
    close(a.maxHp - a.hp, damage); close(outside.hp, outside.maxHp);
    assert.equal(f.hero.combatStats.abilityActivations, 1);
});

test('Cloak: salida quita campo inmediatamente, conserva revelado y slow aliados', () => {
    const f = setup('cloak'), a = f.spawn(), hidden = f.spawn(145, 0, { stealth: true }), outside = f.spawn(145.01, 0, { stealth: true });
    f.kit.update(6); f.shoot(a); assert.equal(hidden.stealth, false); assert.equal(outside.stealth, true);
    hidden.x = 146; assert.equal(hidden.stealth, true);
    hidden.applyStatus({ type: 'reveal', power: 1, duration: 10 }, { id: 'ally' });
    hidden.applyStatus({ type: 'slow', power: 0.1, duration: 10 }, { id: 'ally' });
    hidden.updateDebuffs(0); assert.equal(hidden.stealth, false); close(hidden.speed, 90);
    f.kit.reset(); hidden.updateDebuffs(0); assert.equal(hidden.debuffs.length, 2);
});

test('Cloak: resistencias no se renuevan por frame y slow inmune conserva revelado', () => {
    const f = setup('cloak'), a = f.spawn(80, 0, { stealth: true, immuneToSlow: true }), b = f.spawn(90, 0, { stealth: true, statusResistance: 0.5 });
    f.kit.update(6); f.shoot(a); assert.equal(a.debuffs.length, 1); assert.equal(a.stealth, false);
    close(b.debuffs[0].duration, 1.5); b.updateDebuffs(1.5); f.kit.update(1.5);
    assert.equal(b.stealth, true); assert.equal(b.debuffs.length, 0);
    b.x = 200; f.kit.update(0); b.x = 90; f.kit.update(0); assert.equal(b.stealth, true);
});

test('Cloak: entrada tardia recibe solo tiempo restante y no revela fuera de ventana', () => {
    const f = setup('cloak'), a = f.spawn(), late = f.spawn(200, 0, { stealth: true, flying: true });
    f.kit.update(6); f.shoot(a); f.kit.update(1); late.x = 100; f.kit.update(0);
    close(late.debuffs[0].duration, 2); assert.equal(late.stealth, false); f.kit.update(2); assert.equal(late.stealth, true);
});

test('Dagger: sin marca propia no consume marca aliada ni activa descarga', () => {
    const f = setup('dagger'), e = f.spawn(); e.applyStatus({ type: 'mark', power: 0.4, duration: 10 }, { id: 'ally' });
    f.kit.update(4); f.shoot(e); close(e.hp, e.maxHp); assert.equal(f.kit.cooldown, 0);
    assert.equal(f.kit.hasMark(e), true); assert.equal(e.debuffs.length, 2);
    f.shoot(e); assert.equal(e.debuffs.length, 1); assert.equal(e.debuffs[0].source.id, 'ally');
});

test('Dagger: marca resiste, expira sin renovar y no salta fuera del radio95', () => {
    const f = setup('dagger'), a = f.spawn(50, 0, { statusResistance: 0.5 }), b = f.spawn(146);
    f.kit.update(3); f.shoot(a); f.shoot(b); close(f.kit.marks.get(a).effect.duration, 1.5);
    a.updateDebuffs(1.5); f.kit.update(1.5); assert.equal(f.kit.hasMark(a), false);
    f.shoot(a); f.shoot(a); close(b.hp, b.maxHp); assert.equal(f.kit.hasMark(b), true);
});

test('Magik: no retorno contra oculto, maldicion expirada, muerto o fuera de alcance', () => {
    for (const mode of ['hidden', 'uncurse', 'dead', 'outside']) {
        const f = setup('magik'), e = f.spawn(); f.curse(e); f.kit.update(6); f.shoot(e);
        if (mode === 'hidden') e.nativeStealth = true;
        if (mode === 'uncurse') e.debuffs = [];
        if (mode === 'dead') e.isAlive = false;
        if (mode === 'outside') e.x = 2000;
        f.kit.update(0.4); close(e.hp, e.maxHp); assert.equal(f.kit.returnCut, null);
    }
});

test('Magik: maldicion aliada habilita; sin curse no gasta y retorno no hereda efectos', () => {
    const f = setup('magik'), e = f.spawn(); f.kit.update(6); const power = f.hero.getEffectiveStats().damage;
    close(f.shoot(e).damage, power); assert.equal(f.kit.cooldown, 0);
    e.applyStatus({ type: 'curse', power: 0.001, duration: 10 }, { id: 'ally' });
    f.shoot(e); const damage = f.kit.returnCut.damage; f.hero.level = 100; f.kit.update(0.4);
    close(e.maxHp - e.hp, damage); assert.equal(e.debuffs.length, 1); assert.equal(e.debuffs[0].source.id, 'ally');
    assert.equal(f.hero.x, 0); assert.equal(f.hero.y, 0);
});

test('Cuatro misticos: no activan sobre muertos o fugados, sin curacion', () => {
    for (const id of ['scarlet_witch', 'cloak', 'dagger', 'magik']) {
        const f = setup(id), e = f.spawn(); f.kit.update(7); e.hasReachedEnd = true;
        f.kit.onAttack(e, f.hero.getEffectiveStats()); e.hasReachedEnd = false; e.isAlive = false;
        f.kit.onAttack(e, f.hero.getEffectiveStats()); assert.equal(f.hero.combatStats.abilityActivations, 0);
        assert.equal(f.game.resourceManager.lives, 20);
    }
});
