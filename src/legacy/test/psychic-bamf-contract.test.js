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
    const game = { heroes: [], enemies: [], resourceManager: { lives: 20, credits: 0 }, random: { next: () => 0.99 },
        progression: { getHeroBonuses: () => null, getHeroEvolution: () => hero
            ? getEvolutionForHero(hero.config, {}, { level, equippedItemIds: [] }) : null } };
    hero = new Hero({ ...roster[id], level }, 0, 0, game); game.heroes.push(hero);
    const spawn = (x = 80, y = 0, extra = {}) => {
        const e = new Enemy({ id: 'target', category: hero.category, hp: 1e8, speed: 100, ...extra }, [{ x: 0, y: 0 }, { x: 1000, y: 0 }], game);
        Object.assign(e, { x, y, distanceTravelled: x }); game.enemies.push(e); return e;
    };
    const shoot = e => { const shots = []; hero.shoot(e, hero.getEffectiveStats(), shots); return shots[0]; };
    const hit = shot => CombatSystem.applyImpact(shot, shot.target, hero, game.resourceManager);
    return { game, hero, spawn, shoot, hit, kit: hero.abilitySystem.psychicKit };
}

for (const level of [1, 49, 50, 51, 99, 100]) {
    test(`Mantis ${level}: sueno al impacto, evita dormido y se rompe con dano directo`, () => {
        const f = setup('mantis', level), e = f.spawn(); f.kit.update(6);
        const shot = f.shoot(e); assert.equal(e.debuffs.length, 0); f.hit(shot); e.updateDebuffs(0);
        assert.equal(e.speed, 0); close(e.sleepRecovery, 6);
        assert.equal(f.hero.getBestTarget([e], f.hero.getEffectiveStats()), null); assert.equal(f.shoot(e), undefined);
        e.takeDamage(5, { direct: true }); e.updateDebuffs(0); close(e.speed, 100);
        assert.equal(e.sleepRecovery, 6); assert.equal(f.kit.cooldown, 6);
    });
    test(`Emma ${level}: dos formas, controles preparados y resistencia propia`, () => {
        const f = setup('emma_frost', level), e = f.spawn();
        const crit = f.hero.getEffectiveStats().critChance;
        f.kit.update(3); const shot = f.shoot(e); f.hit(shot);
        assert.deepEqual(e.debuffs.map(s => s.type).sort(), ['mark', 'slow']);
        assert.equal(f.hero.abilitySystem.setCombatMode('diamond'), true); assert.equal(f.hero.abilitySystem.getCombatMode(), 'diamond');
        assert.equal(f.hero.getProjectileEffects(e).length, 0); f.hero.applyStun(5); close(f.hero.stunTimer, 2);
        f.hero.abilitySystem.setCombatMode('psychic'); close(f.hero.stunTimer, 2);
        assert.equal(f.hero.getEffectiveStats().critChance, crit);
        assert.ok(crit >= f.hero.critChance + 4);
        assert.equal(f.hero.abilitySystem.getControlState().options.length, 2);
    });
    test(`Nightcrawler ${level}: tres golpes BAMF y regreso visual sin mover casilla`, () => {
        const f = setup('nightcrawler', level), targets = Array.from({ length: 5 }, (_, i) => f.spawn(80 + i));
        const damage = f.hero.getEffectiveStats().damage; f.kit.update(6); f.shoot(targets[0]);
        assert.equal(targets.filter(e => e.hp < e.maxHp).length, 3); close(targets[0].maxHp - targets[0].hp, damage * 0.45);
        assert.equal(f.hero.x, 0); assert.equal(f.hero.y, 0); assert.equal(f.kit.visualOffset().x, 80);
        assert.equal(f.shoot(targets[0]), undefined); f.kit.update(0.19); assert.equal(f.kit.visualOffset().x, 81);
        f.kit.update(0.36); assert.deepEqual(f.kit.visualOffset(), { x: 0, y: 0 });
        assert.equal(f.hero.getProjectileProfile().chainCount, 2);
    });
    test(`Cosmo ${level}: red de cuatro, marca14%, sin sumar marcas aliadas`, () => {
        const f = setup('cosmo', level), targets = Array.from({ length: 6 }, (_, i) => f.spawn(80 + i));
        f.kit.update(5); f.shoot(targets[0]); assert.equal(targets.filter(e => e.debuffs.length).length, 4);
        close(targets[0].getDamageTakenMultiplier(), 1.14);
        targets[0].applyStatus({ type: 'mark', power: 0.2, duration: 5 }, { id: 'ally' });
        close(targets[0].getDamageTakenMultiplier(), 1.2);
        assert.equal(f.hero.getProjectileEffects(targets[0]).length, 0);
        assert.equal(f.hero.getProjectileProfile().propagationCount, 2);
    });
}

for (const id of ['mantis', 'emma_frost', 'nightcrawler', 'cosmo']) {
    for (const action of ['move', 'stun', 'sell']) {
        test(`${id}: ${action} reinicia preparacion y cancela visual/red sin perder nivel`, () => {
            const f = setup(id, 50), e = f.spawn(); f.kit.update(6); f.shoot(e);
            if (action === 'move') f.hero.x = 32;
            if (action === 'stun') f.hero.applyStun(2);
            if (action === 'sell') new TacticalActionSystem(f.game).sell(f.hero);
            f.hero.update(0, f.game.enemies, []); e.updateDebuffs(0);
            assert.ok(f.kit.cooldown > 0); assert.equal(f.kit.links.length, 0); assert.equal(f.kit.blinks.length, 0);
            assert.deepEqual(f.kit.visualOffset(), { x: 0, y: 0 });
            assert.equal(f.hero.level, 50); assert.equal(f.game.resourceManager.lives, 20); assert.equal(f.game.resourceManager.credits, 0);
        });
    }
}

test('Mantis: inmunidad y resistencia de stun aplican tambien al sueno', () => {
    const f = setup('mantis'), immune = f.spawn(80, 0, { immuneToStun: true }), boss = f.spawn(81, 0, { isBoss: true, statusResistance: 0.5 });
    assert.equal(immune.applyStatus({ type: 'sleep', duration: 2 }, f.hero), false);
    boss.applyStatus({ type: 'sleep', duration: 2 }, f.hero); close(boss.debuffs[0].duration, 1); close(boss.sleepRecovery, 5);
    boss.debuffs = []; assert.equal(boss.applyStatus({ type: 'sleep', duration: 2 }, f.hero), false);
});

test('Mantis: DoT no despierta, dano directo absorbido por barrera si', () => {
    const f = setup('mantis'), e = f.spawn(); e.applyStatus({ type: 'sleep', duration: 2 }, f.hero);
    e.applyStatus({ type: 'burn', duration: 2, power: 10, damageBasis: 'flat' }, f.hero); e.updateDebuffs(0.5);
    assert.ok(e.debuffs.some(s => s.type === 'sleep')); assert.equal(e.speed, 0);
    e.behavior.barrier = 100; e.takeDamage(1, { direct: true });
    assert.ok(!e.debuffs.some(s => s.type === 'sleep'));
});

test('Sueno comparte recuperacion entre fuentes y expira sin nuevo impacto', () => {
    const f = setup('mantis'), e = f.spawn(); e.applyStatus({ type: 'sleep', duration: 2 }, f.hero);
    e.updateDebuffs(2); close(e.speed, 100);
    assert.equal(e.applyStatus({ type: 'sleep', duration: 2 }, { id: 'other' }), false);
    e.updateDebuffs(4); assert.equal(e.applyStatus({ type: 'sleep', duration: 2 }, f.hero), true);
});

test('Emma: alternar modos no recarga habilidad ni cura stun existente', () => {
    const f = setup('emma_frost'), e = f.spawn(); f.kit.update(3); f.shoot(e); f.hero.applyStun(3);
    for (let i = 0; i < 10; i++) f.hero.abilitySystem.setCombatMode(i % 2 ? 'psychic' : 'diamond');
    assert.equal(f.kit.cooldown, 3); assert.equal(f.hero.stunTimer, 3);
    assert.equal(f.hero.abilitySystem.setCombatMode('invalid'), false);
});

test('Nightcrawler: saltos90px y cobertura propia limitan vecinos', () => {
    const f = setup('nightcrawler'), a = f.spawn(40), b = f.spawn(130), outside = f.spawn(146);
    f.kit.update(6); f.shoot(a); assert.equal(f.kit.blinks.length, 2);
    assert.ok(b.hp < b.maxHp); assert.equal(outside.hp, outside.maxHp);
    f.game.reduceMotion = true; assert.deepEqual(f.kit.visualOffset(), { x: 0, y: 0 });
    assert.equal(f.hero.x, 0); assert.equal(f.hero.y, 0);
});

test('Cosmo: separacion elimina solo marca de red; muerte del ancla rompe todo', () => {
    const f = setup('cosmo'), a = f.spawn(40), b = f.spawn(125), c = f.spawn(80);
    f.kit.update(5); f.shoot(a); b.applyStatus({ type: 'mark', power: 0.1, duration: 8 }, { id: 'ally' });
    b.x = 131; close(b.getDamageTakenMultiplier(), 1.1); b.updateDebuffs(0);
    assert.equal(b.debuffs.length, 1); assert.equal(b.debuffs[0].source.id, 'ally');
    a.isAlive = false; close(c.getDamageTakenMultiplier(), 1);
});

test('Cosmo: resistencia reduce ventana sin renovarla y cooldown limita cadencia', () => {
    const f = setup('cosmo'), e = f.spawn(80, 0, { statusResistance: 0.5 });
    f.kit.update(5); f.shoot(e); close(e.debuffs[0].duration, 1.25); e.updateDebuffs(1.25);
    for (let i = 0; i < 50; i++) f.shoot(e);
    close(e.getDamageTakenMultiplier(), 1); assert.equal(f.hero.combatStats.abilityActivations, 1);
});

test('Kits psiquicos no fijan muertos, fugados ni blancos fuera de rango', () => {
    for (const id of ['mantis', 'emma_frost', 'nightcrawler', 'cosmo']) {
        const f = setup(id), e = f.spawn(1000); f.kit.update(6); f.kit.onAttack(e, f.hero.getEffectiveStats());
        e.x = 80; e.hasReachedEnd = true; f.kit.onAttack(e, f.hero.getEffectiveStats());
        e.hasReachedEnd = false; e.isAlive = false; f.kit.onAttack(e, f.hero.getEffectiveStats());
        assert.equal(f.hero.combatStats.abilityActivations, 0);
    }
});
