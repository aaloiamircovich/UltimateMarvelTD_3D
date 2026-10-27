import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Hero } from '../src/entities/Hero.js';
import { Enemy } from '../src/entities/Enemy.js';
import { CombatSystem } from '../src/systems/CombatSystem.js';
import { TacticalActionSystem } from '../src/systems/TacticalActionSystem.js';
import { getEvolutionForHero } from '../src/systems/EvolutionSystem.js';

const heroes = JSON.parse(fs.readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8'));
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
function setup(id, level = 1) {
    let hero;
    const game = { heroes: [], enemies: [], random: { next: () => 0.99 },
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
    const hit = shot => CombatSystem.applyImpact(shot, shot.target, hero, game.resourceManager);
    const kit = hero.abilitySystem.martialKit || hero.abilitySystem.focusKit;
    const update = dt => kit.update(dt);
    return { hero, game, spawn, shoot, hit, kit, update };
}

for (const level of [1, 49, 50, 51, 99, 100]) {
    test(`Sif ${level}: critico preparado contra blindaje roto, una vez cada4s`, () => {
        const f = setup('lady_sif', level), target = f.spawn({ isBoss: true, armor: 80 });
        target.applyStatus({ type: 'armorBreak', duration: 3, power: 0.13 });
        const damage = f.hero.getEffectiveStats().damage;
        close(f.shoot(target).damage, damage); f.update(4);
        const shot = f.shoot(target); close(shot.damage, damage * 2.5); assert.equal(shot.radius, 7);
        assert.equal(f.kit.cooldown, 4); f.hit(shot);
        close(target.maxHp - target.hp, damage * 2.5 * (1 - 0.8 + 0.13));
        close(f.shoot(target).damage, damage); assert.equal(f.hero.combatStats.crits, 1);
    });
    test(`White Tiger ${level}: consume marca propia y no la reaplica en el remate`, () => {
        const f = setup('white_tiger', level), target = f.spawn(); f.update(4);
        target.applyStatus({ type: 'mark', duration: 2, power: 0.08 }, f.hero);
        const damage = f.hero.getEffectiveStats().damage, shot = f.shoot(target);
        close(shot.damage, damage * 1.8); assert.equal(target.debuffs.length, 0);
        assert.equal(shot.effects.some(e => e.type === 'mark'), false); assert.equal(f.kit.cooldown, 4);
        f.game.random.next = () => 0; f.hit(shot); assert.equal(target.debuffs.length, 0);
        f.game.random.next = () => 0.99; close(f.shoot(target).damage, damage);
        assert.ok(f.hero.getProjectileEffects(target).some(e => e.type === 'mark'));
    });
    test(`Tigra ${level}: slow/red habilitan +35%, varios estados no acumulan`, () => {
        const f = setup('tigra', level), target = f.spawn(), damage = f.hero.getEffectiveStats().damage;
        close(f.shoot(target).damage, damage);
        target.applyStatus({ type: 'slow', duration: 2, power: 0.2 }); close(f.shoot(target).damage, damage * 1.35);
        target.applyStatus({ type: 'web', duration: 2, power: 0.2 }); close(f.shoot(target).damage, damage * 1.35);
        target.debuffs = [{ type: 'web', duration: 1, power: 0.2 }]; close(f.shoot(target).damage, damage * 1.35);
        target.debuffs = [{ type: 'stun', duration: 1, power: 1 }]; close(f.shoot(target).damage, damage);
        assert.ok(f.hero.getProjectileEffects(target).every(e => !['web', 'slow'].includes(e.type)));
    });
    test(`Angela ${level}: tres golpes preparan cuarto contra elite aislado sin acumular`, () => {
        const f = setup('angela', level), target = f.spawn({ isBoss: true });
        const damage = f.hero.getEffectiveStats().damage;
        for (let i = 0; i < 3; i++) close(f.shoot(target).damage, damage);
        close(f.shoot(target).damage, damage * 1.9); assert.equal(f.kit.stacks, 0);
        close(f.shoot(target).damage, damage); assert.equal(f.hero.combatStats.abilityActivations, 1);
        assert.equal(f.hero.getProjectileProfile().chainCount, 1);
        assert.ok(f.hero.getProjectileProfile().armorPenetration >= 0.26);
    });
}

for (const condition of ['comun', 'sin armadura', 'sin ruptura', 'expirada', 'poder cero', 'sigilo', 'fuera']) {
    test(`Sif: no consume carga con ${condition}`, () => {
        const f = setup('lady_sif'), target = f.spawn({ threat: 4, armor: 70 }); f.update(4);
        target.debuffs = [{ type: 'armorBreak', duration: 1, power: 0.2 }];
        if (condition === 'comun') target.threat = 1;
        if (condition === 'sin armadura') target.armor = 0;
        if (condition === 'sin ruptura') target.debuffs = [];
        if (condition === 'expirada') target.debuffs[0].duration = 0;
        if (condition === 'poder cero') target.debuffs[0].power = 0;
        if (condition === 'sigilo') target.stealth = true;
        if (condition === 'fuera') target.x = 10000;
        assert.equal(f.kit.criticalMultiplier(target), 0);
        f.kit.onAttack(target, f.hero.getEffectiveStats()); assert.equal(f.kit.cooldown, 0);
    });
}

test('Sif: critico de objeto mayor se conserva, no multiplica dos criticos', () => {
    const f = setup('lady_sif'), target = f.spawn({ isMiniBoss: true, armor: 50 }); f.update(4);
    target.applyStatus({ type: 'armorBreak', duration: 1, power: 0.2 });
    const stats = f.hero.getEffectiveStats(), shots = [];
    f.hero.shoot(target, { ...stats, critDamage: 4 }, shots); close(shots[0].damage, stats.damage * 4);
    assert.equal(f.hero.combatStats.crits, 1);
});

test('White Tiger: protege marca ajena/mas fuerte/prolongada y requiere vigencia', () => {
    for (const [source, power, duration] of [['ally', 0.08, 2], ['own', 0.2, 2], ['own', 0.08, 3], ['own', 0.08, 0]]) {
        const f = setup('white_tiger'), target = f.spawn(); f.update(4);
        const mark = { type: 'mark', source: source === 'own' ? f.hero : {}, power, duration };
        target.debuffs = [mark]; close(f.shoot(target).damage, f.hero.getEffectiveStats().damage);
        assert.equal(target.debuffs[0], mark); assert.equal(f.kit.cooldown, 0);
    }
});

test('White Tiger: solo gasta mark, preserva ruptura y sangrado; el lanzamiento queda fijado', () => {
    const f = setup('white_tiger'), target = f.spawn(); f.update(4);
    target.applyStatus({ type: 'mark', duration: 2, power: 0.08 }, f.hero);
    const status = { type: 'armorBreak', power: 0.2, duration: 1 }; target.debuffs.push(status);
    const shot = f.shoot(target), damage = shot.damage;
    assert.deepEqual(target.debuffs, [status]); f.hero.x = 1000; f.update(0);
    close(shot.damage, damage); assert.equal(shot.effects.some(e => e.type === 'mark'), false);
});

test('Tigra: efectos expirados o sin potencia no habilitan caza', () => {
    const f = setup('tigra'), target = f.spawn();
    for (const effect of [{ type: 'slow', duration: 0, power: 0.5 }, { type: 'web', duration: 1, power: 0 }]) {
        target.debuffs = [effect]; assert.equal(f.kit.damageMultiplier(target), 1);
    }
});

for (const reason of ['escolta', 'sigilo escolta', 'fuera cobertura escolta', 'cambiar', 'mover', 'stun', 'retirar', 'fuera', 'muerto', 'pausa']) {
    test(`Angela: pierde preparacion por ${reason}`, () => {
        const f = setup('angela'), target = f.spawn({ threat: 4 }); for (let i = 0; i < 3; i++) f.shoot(target);
        if (reason.includes('escolta')) {
            const escort = f.spawn(); escort.x = target.x + 90;
            if (reason === 'sigilo escolta') escort.stealth = true;
            if (reason === 'fuera cobertura escolta') { target.x = 140; escort.x = 230; }
        }
        if (reason === 'cambiar') { const next = f.spawn({ threat: 4 }); next.x = -100; f.shoot(next); }
        if (reason === 'mover') f.hero.x = 1;
        if (reason === 'stun') f.hero.stunTimer = 1;
        if (reason === 'retirar') new TacticalActionSystem(f.game).sell(f.hero);
        if (reason === 'fuera') target.x = 10000;
        if (reason === 'muerto') target.isAlive = false;
        f.update(reason === 'pausa' ? 2.5 : 0); assert.equal(f.kit.damageMultiplier(target), 1);
    });
}

test('Angela: limites de aislamiento, muertos y escapados no cuentan; comunes no cargan', () => {
    const f = setup('angela'), target = f.spawn({ threat: 4 }), escort = f.spawn(); escort.x = 130.01;
    for (let i = 0; i < 3; i++) f.shoot(target); close(f.kit.damageMultiplier(target), 1.9);
    escort.x = 40; escort.isAlive = false; close(f.kit.damageMultiplier(target), 1.9);
    escort.isAlive = true; escort.hasReachedEnd = true; close(f.kit.damageMultiplier(target), 1.9);
    target.threat = 1; f.shoot(target); assert.equal(f.kit.stacks, 0);
    assert.equal(f.kit.isEligible(null), false);
});

for (const id of ['lady_sif', 'white_tiger']) {
    for (const reason of ['mover', 'stun', 'retirar']) {
        test(`${id}: reinicia recarga por ${reason}`, () => {
            const f = setup(id); f.update(4);
            if (reason === 'mover') f.hero.x = 1;
            if (reason === 'stun') f.hero.stunTimer = 1;
            if (reason === 'retirar') new TacticalActionSystem(f.game).sell(f.hero);
            f.update(0); assert.equal(f.kit.cooldown, 4);
        });
    }
}

test('cuatro kits preservan vidas, dinero, rareza, prioridad y stats base', () => {
    for (const id of ['lady_sif', 'white_tiger', 'tigra', 'angela']) {
        const f = setup(id), target = f.spawn({ threat: 4, armor: 50 }); f.hero.targetingPriority = 'Debil';
        const base = f.hero.getEffectiveStats();
        for (let i = 0; i < 12; i++) { f.update(1); f.shoot(target); }
        assert.equal(f.game.resourceManager.lives, 20); assert.equal(f.game.resourceManager.credits, 0);
        assert.equal(f.hero.targetingPriority, 'Debil'); assert.deepEqual(f.hero.getEffectiveStats(), base);
        assert.equal(heroes[id].rarity, id === 'angela' ? 'Epic' : 'Rare');
        assert.ok(f.hero.abilitySystem.getDisplayState().label);
    }
});
