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
    const shoot = target => { const shots = []; hero.shoot(target, hero.getEffectiveStats(), shots); return shots[0]; };
    const mark = e => e.applyStatus({ type: 'mark', power: 0.1, duration: 20 }, { id: 'ally' });
    const poison = (e, source = hero, stacks = 3, extra = {}) => e.applyStatus({ type: 'poison', power: 0.0045, duration: 4.2, stacks, ...extra }, source);
    return { game, hero, spawn, shoot, mark, poison, kit: hero.abilitySystem.darkfireKit };
}

for (const level of [1, 49, 50, 51, 99, 100]) {
    test(`Torch ${level}: ignicion3s sobre4 calientes, dano capturado y burn conservado`, () => {
        const f = setup('human_torch', level), targets = Array.from({ length: 6 }, (_, i) => f.spawn(80 + i));
        f.kit.update(7); f.shoot(targets[0]); const damage = f.kit.zone.damage;
        f.kit.update(2.9); assert.ok(targets.every(e => e.hp === e.maxHp)); f.kit.update(0.11);
        for (const e of targets.slice(0, 4)) close(e.maxHp - e.hp, damage);
        for (const e of targets.slice(4)) close(e.hp, e.maxHp);
        assert.equal(f.kit.zone, null); close(f.hero.getProjectileEffects(targets[0])[0].power, 0.375);
        assert.equal(f.hero.combatStats.abilityActivations, 1);
    });
    test(`Hood ${level}: pacto al impacto, penalizacion y cobro preparado`, () => {
        const f = setup('the_hood', level), e = f.spawn(), other = f.spawn(90); f.kit.update(3);
        const power = f.hero.getEffectiveStats().damage, first = f.shoot(e);
        assert.equal(e.debuffs.length, 0); CombatSystem.applyImpact(first, e, f.hero, f.game.resourceManager);
        assert.ok(e.debuffs.some(s => s.type === 'curse')); assert.ok(e.debuffs.some(s => s.type === 'mark'));
        close(f.shoot(e).damage, power * 0.75); f.kit.update(1.5); close(f.shoot(other).damage, power * 0.75);
        close(f.shoot(e).damage, power * 1.8); assert.equal(f.kit.pact, null); assert.equal(f.kit.cooldown, 4);
        assert.equal(f.shoot(e).effects.length, 0); assert.equal(f.game.resourceManager.lives, 20);
    });
    test(`Psylocke ${level}: concentracion1.5s y critico2.75x sobre marcado`, () => {
        const f = setup('psylocke', level), e = f.spawn(); f.mark(e); f.kit.update(5); f.shoot(e);
        f.kit.update(1.5); const power = f.hero.getEffectiveStats().damage, shot = f.shoot(e);
        close(shot.damage, power * Math.max(2.75, f.hero.getEffectiveStats().critDamage));
        assert.equal(e.debuffs.some(s => s.type === 'armorBreak'), false);
        CombatSystem.applyImpact(shot, e, f.hero, f.game.resourceManager);
        close(e.debuffs.find(s => s.type === 'armorBreak').power, 0.28);
        assert.equal(f.kit.cooldown, 5); assert.equal(f.kit.concentration, 0); assert.equal(f.hero.combatStats.crits, 1);
    });
    test(`Venom ${level}: consume3 capas propias, conserva aliadas y limita mordida a4x`, () => {
        const f = setup('venom', level), e = f.spawn(); f.poison(e); f.poison(e, { id: 'ally' }, 2);
        f.kit.update(6); const power = f.hero.getEffectiveStats().damage; f.shoot(e);
        close(e.maxHp - e.hp, power * 4);
        const poison = e.debuffs.find(s => s.type === 'poison'); assert.equal(poison.stacks, 2);
        assert.ok(poison.applications.every(s => s.source.id === 'ally')); assert.equal(f.kit.cooldown, 6);
        assert.equal(f.hero.combatStats.abilityActivations, 1); assert.equal(f.game.resourceManager.lives, 20);
    });
}

for (const id of ['human_torch', 'the_hood', 'psylocke', 'venom']) {
    for (const action of ['move', 'stun', 'sell']) {
        test(`${id}: ${action} reinicia preparacion y estados sin perder nivel`, () => {
            const f = setup(id, 50), e = f.spawn(); f.mark(e); f.kit.update(7); f.shoot(e);
            if (action === 'move') f.hero.x = 1;
            if (action === 'stun') f.hero.applyStun(1);
            if (action === 'sell') new TacticalActionSystem(f.game).sell(f.hero);
            f.hero.update(0, [], []); assert.ok(f.kit.cooldown > 0);
            assert.equal(f.kit.zone, null); assert.equal(f.kit.pact, null); assert.equal(f.kit.focus, null);
            assert.equal(f.hero.level, 50); assert.deepEqual(f.game.resourceManager, { lives: 20, credits: 0 });
        });
    }
}

test('Torch: corredores, reentrada y entrada tardia no heredan calor', () => {
    const f = setup('human_torch'), a = f.spawn(), late = f.spawn(200);
    f.kit.update(7); f.shoot(a); f.kit.update(1.6); a.x = 200; f.kit.update(0);
    a.x = 80; late.x = 90; f.kit.update(0); f.kit.update(1.4);
    close(a.hp, a.maxHp); close(late.hp, late.maxHp);
});

test('Torch: radio55 inclusivo, deteccion/cobertura y poder no retroactivo', () => {
    const f = setup('human_torch'), a = f.spawn(100), edge = f.spawn(155), outside = f.spawn(155.01), hidden = f.spawn(110, 0, { stealth: true });
    f.kit.update(7); f.shoot(a); const damage = f.kit.zone.damage; f.hero.level = 100; f.kit.update(3);
    close(edge.maxHp - edge.hp, damage); close(outside.hp, outside.maxHp); close(hidden.hp, hidden.maxHp);
});

test('Hood: pacto perdido o vencido recarga sin cobrar; curse ausente no habilita', () => {
    for (const mode of ['expired', 'outside', 'dead', 'uncurse']) {
        const f = setup('the_hood'), e = f.spawn(); f.kit.update(3); f.shoot(e);
        if (mode === 'outside') e.x = 1000;
        if (mode === 'dead') e.isAlive = false;
        f.kit.update(mode === 'expired' ? 4 : 1.5);
        if (mode === 'uncurse') { assert.equal(f.kit.cashPact(e), false); close(f.shoot(e).damage, f.hero.getEffectiveStats().damage * 0.75); }
        else { assert.equal(f.kit.pact, null); assert.equal(f.kit.cooldown, 4); }
    }
});

test('Psylocke: cambia presa, pierde marca o espera3s y pierde concentracion', () => {
    for (const mode of ['switch', 'unmark', 'idle', 'invalidField']) {
        const f = setup('psylocke'), a = f.spawn(), b = f.spawn(90); f.mark(a); f.mark(b);
        f.kit.update(5); f.shoot(a); f.kit.update(1.5);
        if (mode === 'switch') f.shoot(b);
        if (mode === 'unmark') a.debuffs = [];
        if (mode === 'invalidField') a.debuffs[0].fieldActive = () => false;
        f.kit.update(mode === 'idle' ? 1.5 : 0); assert.equal(f.kit.concentration, 0);
        assert.equal(f.kit.criticalMultiplier(a), 0);
    }
});

test('Venom: dos propias y muchas aliadas no bastan ni consumen parcialmente', () => {
    const f = setup('venom'), e = f.spawn(); f.poison(e, f.hero, 2); f.poison(e, { id: 'ally' }, 5);
    f.kit.update(6); f.shoot(e); close(e.hp, e.maxHp); assert.equal(e.debuffs[0].stacks, 7); assert.equal(f.kit.cooldown, 0);
});

test('Venom: consume las mas proximas a vencer y liquida fraccion pendiente', () => {
    const f = setup('venom'), e = f.spawn(80, 0, { hp: 1000 });
    f.poison(e, f.hero, 3, { duration: 1, power: 0.001 }); f.poison(e, f.hero, 1, { duration: 5, power: 0.002 });
    e.updateDebuffs(0.25); const before = e.hp; assert.equal(e.consumePoison(f.hero, 3), 3);
    close(before - e.hp, 0.75); assert.equal(e.debuffs[0].stacks, 1); close(e.debuffs[0].applications[0].power, 0.002);
    close(e.debuffs[0].applications[0].tickTimer, 0.25);
});

test('Venom: cap de jefe2% tras marca incluso con salud pequena y veneno consume una vez', () => {
    for (const hp of [10, 100, 1000000]) {
        const f = setup('venom', 100), e = f.spawn(80, 0, { isBoss: true, hp }); f.poison(e); f.mark(e);
        f.kit.update(6); f.shoot(e); const dealt = hp - e.hp;
        assert.ok(dealt <= hp * 0.02 + 1e-8); assert.ok(dealt > 0); assert.equal(e.debuffs.some(s => s.type === 'poison'), false);
        for (let i = 0; i < 100; i++) f.shoot(e); close(hp - e.hp, dealt);
        assert.equal(f.hero.combatStats.abilityActivations, 1);
    }
});

test('Venom: si liquidar veneno mata, no mordida ni credito de baja duplicado', () => {
    const f = setup('venom'), e = f.spawn(80, 0, { hp: 10 }); f.poison(e, f.hero, 3, { power: 1 });
    e.updateDebuffs(0.25); e.hp = 1; f.kit.update(6); f.shoot(e);
    assert.equal(e.isAlive, false); assert.equal(f.hero.combatStats.kills, 1); assert.equal(f.hero.combatStats.abilityActivations, 1);
    assert.equal(e.debuffs.some(s => s.type === 'poison'), false);
});

test('Venom: consumo invalido y capas vencidas no modifican la bolsa', () => {
    const f = setup('venom'), e = f.spawn(); f.poison(e);
    for (const count of [0, -1, 1.5, NaN, Infinity, 13]) assert.equal(e.consumePoison(f.hero, count), 0);
    assert.equal(e.debuffs[0].stacks, 3); e.debuffs[0].applications[0].duration = 0;
    assert.equal(e.consumePoison(f.hero, 3), 0); assert.equal(e.debuffs[0].stacks, 3);
});

test('Cuatro kits: no activan sobre muertos o fugados ni curan', () => {
    for (const id of ['human_torch', 'the_hood', 'psylocke', 'venom']) {
        const f = setup(id), e = f.spawn(); f.kit.update(7); e.hasReachedEnd = true;
        f.kit.onAttack(e, f.hero.getEffectiveStats()); e.hasReachedEnd = false; e.isAlive = false;
        f.kit.onAttack(e, f.hero.getEffectiveStats()); assert.equal(f.hero.combatStats.abilityActivations, 0);
        assert.equal(f.game.resourceManager.lives, 20);
    }
});
