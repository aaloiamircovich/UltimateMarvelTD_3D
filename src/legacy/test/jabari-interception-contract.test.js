import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Hero } from '../src/entities/Hero.js';
import { Enemy } from '../src/entities/Enemy.js';
import { Projectile } from '../src/entities/Projectile.js';
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
    const spawn = (progress = 0.5, extra = {}) => {
        const enemy = new Enemy({ id: 'target', category: hero.category, hp: 1e8, speed: 1, ...extra },
            [{ x: 0, y: 0 }, { x: 1000, y: 0 }], game);
        enemy.x = 40; enemy.distanceTravelled = progress * 1000; game.enemies.push(enemy); return enemy;
    };
    const shoot = target => { const shots = []; hero.shoot(target, hero.getEffectiveStats(), shots); return shots[0]; };
    const hit = shot => CombatSystem.applyImpact(shot, shot.target, hero, game.resourceManager);
    const kit = hero.abilitySystem.streetKit, focus = hero.abilitySystem.focusKit;
    const update = dt => kit.update(dt, game.enemies, hero.getEffectiveStats());
    return { hero, game, spawn, shoot, hit, kit, focus, update };
}

for (const level of [1, 49, 50, 51, 99, 100]) {
    test(`M'Baku ${level}: barrera limitada por poder, no por vida del jefe`, () => {
        const f = setup('mbaku', level), target = f.spawn(0.5, { barrierRatio: 1, isBoss: true });
        const barrier = target.behavior.barrier, damage = f.hero.getEffectiveStats().damage;
        f.shoot(target); close(target.behavior.barrier, barrier);
        f.update(4); f.shoot(target);
        close(target.behavior.barrier, barrier - damage * 1.2);
        close(target.hp, target.maxHp); close(f.hero.combatStats.damageDealt, damage * 1.2);
        assert.equal(f.kit.cooldownRemaining, 4); assert.equal(target.behavior.barrierRechargeDelay, 5);
        f.shoot(target); close(target.behavior.barrier, barrier - damage * 1.2);
        f.update(4); target.behavior.barrier = 10; f.shoot(target);
        close(target.behavior.barrier, 8); close(target.hp, target.maxHp);
    });
    test(`Korg ${level}: tres terrestres activan pisoton, cinco victimas como maximo`, () => {
        const f = setup('korg', level);
        const targets = Array.from({ length: 6 }, (_, i) => f.spawn(i / 10));
        const damage = f.hero.getEffectiveStats().damage;
        f.update(4.99); assert.ok(targets.every(t => t.hp === t.maxHp));
        f.update(0.02);
        assert.equal(targets.filter(t => t.hp < t.maxHp).length, 5);
        close(targets[5].maxHp - targets[5].hp, damage * 0.5);
        assert.equal(targets[5].debuffs.find(e => e.type === 'slow').power, 0.35);
        assert.equal(f.kit.cooldownRemaining, 5); assert.equal(f.hero.combatStats.abilityActivations, 1);
        f.update(0); assert.equal(f.hero.combatStats.abilityActivations, 1);
        assert.equal(f.hero.getProjectileProfile().splashRadius, 48);
        assert.equal(f.hero.getProjectileEffects(targets[0]).length, 0);
    });
    test(`Red Guardian ${level}: segundo impacto intercepta al avanzado, sin stun primario`, () => {
        const f = setup('red_guardian', level), primary = f.spawn(0.3), near = f.spawn(0.4), front = f.spawn(0.8, { isBoss: true, statusResistance: 0.5 });
        near.x = 41; front.x = 70;
        assert.equal(f.shoot(primary).interceptBounce, false); f.update(3);
        const shot = f.shoot(primary); assert.equal(shot.interceptBounce, true); f.hit(shot);
        assert.equal(primary.debuffs.length, 0); assert.equal(near.hp, near.maxHp);
        close(front.maxHp - front.hp, shot.damage * 0.48);
        close(front.debuffs.find(e => e.type === 'stun').duration, front.getStatusDuration('stun', 0.3));
        assert.equal(f.shoot(primary).interceptBounce, false);
        assert.equal(f.kit.cooldownRemaining, 3);
    });
    test(`Echo ${level}: cuarto ataque +60% y marca propia, consume preparacion`, () => {
        const f = setup('echo', level), target = f.spawn(0.5, { statusResistance: 0.5 });
        const damage = f.hero.getEffectiveStats().damage;
        for (let i = 0; i < 3; i++) { const shot = f.shoot(target); close(shot.damage, damage); assert.equal(shot.effects.length, 0); }
        assert.equal(f.focus.getDisplayState().ready, true);
        const shot = f.shoot(target); close(shot.damage, damage * 1.6); f.hit(shot);
        const mark = target.debuffs.find(e => e.type === 'mark'); close(mark.power, 0.12);
        close(mark.duration, target.getStatusDuration('mark', 2.2));
        assert.equal(f.focus.stacks, 0); assert.equal(f.hero.combatStats.abilityActivations, 1);
        close(f.shoot(target).damage, damage);
        const evolutionCrit = f.game.progression.getHeroEvolution()?.stats?.critChance || 0;
        assert.equal(f.hero.getEffectiveStats().critChance, f.hero.critChance + 4 + evolutionCrit);
    });
}

for (const reason of ['cambiar', 'mover', 'stun', 'retirar', 'esperar', 'muerto', 'fuera']) {
    test(`Echo: cancela combo al ${reason}`, () => {
        const f = setup('echo'), target = f.spawn();
        for (let i = 0; i < 3; i++) f.shoot(target);
        if (reason === 'cambiar') f.shoot(f.spawn());
        if (reason === 'mover') f.hero.x += 1;
        if (reason === 'stun') f.hero.stunTimer = 2;
        if (reason === 'retirar') new TacticalActionSystem(f.game).sell(f.hero);
        if (reason === 'muerto') target.isAlive = false;
        if (reason === 'fuera') target.x = 10000;
        f.focus.update(reason === 'esperar' ? 2.5 : 0);
        assert.equal(f.focus.damageMultiplier(target), 1); assert.equal(f.focus.attackEffects(target).length, 0);
    });
}

for (const reason of ['sigilo', 'fuera', 'stun', 'sin barrera', 'muerto']) {
    test(`M'Baku: no consume desafio con ${reason}`, () => {
        const f = setup('mbaku'), target = f.spawn(0.5, { barrierRatio: 1 }); f.update(4);
        if (reason === 'sigilo') target.stealth = true;
        if (reason === 'fuera') target.x = 10000;
        if (reason === 'stun') f.hero.stunTimer = 1;
        if (reason === 'sin barrera') target.behavior.barrier = 0;
        if (reason === 'muerto') target.isAlive = false;
        const before = target.behavior.barrier; f.kit.onAttack(target, f.hero.getEffectiveStats());
        assert.equal(f.kit.cooldownRemaining, 0); assert.equal(target.behavior.barrier, before);
    });
}

test('Korg: no cuenta voladores, sigilo, fuera de radio ni muertos; inmunidad respeta dano', () => {
    const f = setup('korg'), a = f.spawn(), b = f.spawn(), c = f.spawn(0.8, { immuneToSlow: true });
    c.flying = true; f.update(5); assert.equal(f.hero.combatStats.abilityActivations, 0);
    c.flying = false; c.stealth = true; f.update(0); assert.equal(f.hero.combatStats.abilityActivations, 0);
    c.stealth = false; c.x = 66; f.update(0); assert.equal(f.hero.combatStats.abilityActivations, 0);
    c.x = 40; c.isAlive = false; f.update(0); assert.equal(f.hero.combatStats.abilityActivations, 0);
    c.isAlive = true; f.hero.stunTimer = 2; f.update(0); assert.equal(f.hero.combatStats.abilityActivations, 0);
    f.hero.stunTimer = 0; f.update(0); assert.ok(c.hp < c.maxHp); assert.equal(c.debuffs.length, 0);
    assert.ok(a.debuffs.length && b.debuffs.length);
});

test('Red Guardian: compara rutas propias; ignora sigilo/fuera, no paraliza rezagados ni inmunes', () => {
    const f = setup('red_guardian'), primary = f.spawn(0.5), hidden = f.spawn(0.99), outside = f.spawn(0.98), front = f.spawn(0.1, { immuneToStun: true });
    hidden.stealth = true; outside.x = 124;
    front.path = [{ x: 0, y: 0 }, { x: 100, y: 0 }]; front.distanceTravelled = 80;
    f.update(3); f.hit(f.shoot(primary));
    assert.ok(front.hp < front.maxHp); assert.equal(front.debuffs.length, 0);
    assert.equal(hidden.hp, hidden.maxHp); assert.equal(outside.hp, outside.maxHp);
    front.config.immuneToStun = false; front.immuneToStun = false; front.distanceTravelled = 10;
    f.update(3); f.hit(f.shoot(primary)); assert.equal(front.debuffs.length, 0);
});

test('Red Guardian: objetos con mas rebotes no multiplican stun y pool limpia bandera', () => {
    const f = setup('red_guardian'), primary = f.spawn(0.1), a = f.spawn(0.9), b = f.spawn(0.7);
    f.update(3); const shot = f.shoot(primary); shot.chainCount = 3; f.hit(shot);
    assert.equal(a.debuffs.length, 1); assert.equal(b.debuffs.length, 0);
    shot.reset(0, 0, primary, { chainCount: 1 }); assert.equal(shot.interceptBounce, false);
    assert.equal(new Projectile(0, 0, primary).interceptBounce, false);
});

test('cuatro kits: no curan base ni generan dinero, conservan prioridades y rareza', () => {
    for (const id of ['mbaku', 'korg', 'red_guardian', 'echo']) {
        const f = setup(id); f.hero.targetingPriority = 'Debil'; const target = f.spawn(0.8, { barrierRatio: 1 });
        f.spawn(); f.spawn();
        for (let i = 0; i < 12; i++) { f.update(1); f.focus?.update(1); f.hit(f.shoot(target)); }
        assert.equal(f.game.resourceManager.lives, 20); assert.equal(f.game.resourceManager.credits, 0);
        assert.equal(f.hero.targetingPriority, 'Debil'); assert.equal(heroes[id].rarity, 'Common');
        assert.ok(f.kit.getDisplayState() || f.focus.getDisplayState());
    }
});
