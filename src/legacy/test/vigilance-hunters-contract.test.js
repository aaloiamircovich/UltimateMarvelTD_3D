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
    const kit = hero.abilitySystem.vigilanceKit || hero.abilitySystem.streetKit;
    const update = dt => kit.update(dt, game.enemies, hero.getEffectiveStats());
    return { hero, game, spawn, shoot, kit, update };
}

for (const level of [1, 49, 50, 51, 99, 100]) {
    test(`Heimdall ${level}: tres amenazas avanzadas, revelado y marca sin vision global`, () => {
        const f = setup('heimdall', level);
        const targets = Array.from({ length: 5 }, (_, i) => f.spawn(80 + i, 0, { stealth: true }));
        f.update(4.9); assert.ok(targets.every(e => e.stealth)); f.update(0.1);
        assert.deepEqual(targets.map(e => e.stealth), [true, true, false, false, false]);
        close(targets[4].getDamageTakenMultiplier(), 1.11);
        assert.equal(f.kit.cooldown, 5); assert.equal(f.hero.getProjectileEffects(targets[0]).length, 0);
        targets[4].updateDebuffs(2.5); assert.equal(targets[4].stealth, true);
        const ally = new Hero(roster.hulk, 0, 0, f.game); f.game.heroes.push(ally);
        assert.equal(ally.getEffectiveStats().canSeeStealth, false);
    });
    test(`Squirrel Girl ${level}: una entidad, cuatro golpes de30%, lento inicial`, () => {
        const f = setup('squirrel_girl', level), primary = f.spawn(), front = f.spawn(100);
        const power = f.hero.getEffectiveStats().damage;
        f.update(6); f.shoot(primary);
        assert.equal(f.kit.harassment.target, front); assert.equal(f.game.heroes.length, 1);
        f.update(0.75); close(front.maxHp - front.hp, power * 0.3);
        close(front.debuffs[0].power, 0.28); close(front.debuffs[0].duration, 1.4);
        front.updateDebuffs(1.4); f.update(2.25);
        close(front.maxHp - front.hp, power * 1.2); assert.equal(front.debuffs.length, 0);
        assert.equal(f.kit.harassment, null); assert.equal(primary.hp, primary.maxHp);
        assert.equal(f.hero.combatStats.abilityActivations, 1);
    });
    test(`Blade ${level}: remate preparado de elite herido, consumido una vez al disparar`, () => {
        const f = setup('blade', level), e = f.spawn(80, 0, { isBoss: true });
        e.hp *= 0.5; e.applyStatus({ type: 'bleed', power: 0.1, duration: 5 }, f.hero);
        const power = f.hero.getEffectiveStats().damage;
        f.update(6); const shot = f.shoot(e); close(shot.damage, power * 2);
        assert.equal(f.kit.cooldownRemaining, 6); close(f.shoot(e).damage, power);
        assert.equal(shot.effects.find(s => s.type === 'bleed').power, 0.3);
        assert.equal(f.hero.combatStats.abilityActivations, 1); assert.equal(f.game.resourceManager.lives, 20);
    });
    test(`Ghost Rider ${level}: Penitencia respeta tope despues del escalado y recarga fija`, () => {
        const f = setup('ghost_rider', level), boss = f.spawn(80, 0, { isBoss: true, hp: 100 });
        boss.hp = 50; f.update(10); close(boss.hp, 50); f.update(1);
        close(boss.hp, 38); assert.equal(f.kit.cooldownRemaining, 11);
        for (let i = 0; i < 30; i++) f.kit.updatePenance(f.game.enemies, f.hero.getEffectiveStats());
        close(boss.hp, 38); assert.equal(f.game.resourceManager.lives, 20);
    });
}

for (const id of ['heimdall', 'squirrel_girl', 'blade', 'ghost_rider']) {
    for (const action of ['move', 'stun', 'sell']) {
        test(`${id}: ${action} reinicia preparacion, no modifica nivel ni recursos`, () => {
            const f = setup(id, 50), e = f.spawn(); f.update(11); f.shoot(e);
            if (action === 'move') f.hero.x = 1;
            if (action === 'stun') f.hero.applyStun(1);
            if (action === 'sell') new TacticalActionSystem(f.game).sell(f.hero);
            f.hero.update(0, f.game.enemies, []);
            assert.ok((f.kit.cooldown ?? f.kit.cooldownRemaining) > 0);
            if (id === 'squirrel_girl') assert.equal(f.kit.harassment, null);
            assert.equal(f.hero.level, 50); assert.deepEqual(f.game.resourceManager, { lives: 20, credits: 0 });
        });
    }
}

test('Heimdall: cruz excluye diagonales y exterior; cooldown vacio no se consume', () => {
    const f = setup('heimdall'), diagonal = f.spawn(150, 150, { stealth: true }), outside = f.spawn(1000, 0, { stealth: true });
    f.update(5); assert.equal(f.kit.cooldown, 0); assert.ok(diagonal.stealth && outside.stealth);
    const inside = f.spawn(120, 0, { stealth: true, statusResistance: 0.5 });
    f.update(0); assert.equal(inside.stealth, false); close(inside.debuffs[0].duration, 1.25);
    inside.applyStatus({ type: 'mark', power: 0.3, duration: 10 }, { id: 'ally' });
    close(inside.getDamageTakenMultiplier(), 1.3);
});

test('Heimdall: el revelado emitido persiste al retirarlo, pero no emite otro', () => {
    const f = setup('heimdall'), e = f.spawn(80, 0, { stealth: true }); f.update(5);
    new TacticalActionSystem(f.game).sell(f.hero); f.update(10);
    assert.equal(e.stealth, false); e.updateDebuffs(2.5); assert.equal(e.stealth, true);
    assert.equal(f.hero.combatStats.abilityActivations, 1);
});

test('Squirrel Girl: excluye ocultos, voladores y fugados; no encadena ni cambia de presa', () => {
    const f = setup('squirrel_girl'), e = f.spawn(), hidden = f.spawn(90, 0, { stealth: true }), flying = f.spawn(100, 0, { flying: true }), escaped = f.spawn(110);
    escaped.hasReachedEnd = true; f.update(6); f.shoot(e); assert.equal(f.kit.harassment.target, e);
    e.x = 1000; f.update(0.75); assert.equal(f.kit.harassment, null);
    for (const target of [e, hidden, flying, escaped]) assert.equal(target.hp, target.maxHp);
});

test('Squirrel Girl: presupuesto capturado, sin proc de ataque adicional y mismo resultado con dt grande', () => {
    for (const steps of [[3], [0.5, 0.5, 0.5, 0.5, 0.5, 0.5]]) {
        const f = setup('squirrel_girl'), e = f.spawn(); f.update(6); f.shoot(e);
        const damage = f.kit.harassment.damage; f.hero.level = 100;
        for (const dt of steps) f.update(dt);
        close(e.maxHp - e.hp, damage * 4); assert.equal(f.hero.abilitySystem.attackCount, 1);
        assert.equal(f.hero.getProjectileEffects(e).length, 0);
    }
});

test('Squirrel Girl: slow respeta inmunidad y resistencia, fuego rapido no crea duplicados', () => {
    for (const extra of [{ immuneToSlow: true }, { statusResistance: 0.5 }]) {
        const f = setup('squirrel_girl'), e = f.spawn(80, 0, extra); f.update(6); f.shoot(e);
        const entity = f.kit.harassment; for (let i = 0; i < 50; i++) f.shoot(e);
        assert.equal(f.kit.harassment, entity); f.update(0.75);
        if (extra.immuneToSlow) assert.equal(e.debuffs.length, 0); else close(e.debuffs[0].duration, 0.7);
        assert.equal(f.hero.combatStats.abilityActivations, 1);
    }
});

test('Blade: no remata sanos, soldados, sin sangrado, ocultos ni fuera de cobertura', () => {
    for (const mode of ['healthy', 'soldier', 'noBleed', 'outside', 'hidden', 'escaped']) {
        const f = setup('blade'), e = f.spawn(80, 0, { threat: mode === 'soldier' ? 1 : 4 });
        if (mode !== 'healthy') e.hp *= 0.5;
        if (mode !== 'noBleed') e.applyStatus({ type: 'bleed', power: 0.1, duration: 5 }, f.hero);
        if (mode === 'outside') e.x = 10000;
        if (mode === 'escaped') e.hasReachedEnd = true;
        if (mode === 'hidden') { e.nativeStealth = true; f.hero.getEffectiveStats = () => ({ range: 110, canSeeStealth: false }); }
        f.update(6); assert.equal(f.kit.getAttackDamageMultiplier(e), 1); assert.equal(f.kit.cooldownRemaining, 0);
    }
});

test('Blade: bajas no alteran cadencia, preparacion ni vidas; remate no ejecuta', () => {
    const f = setup('blade'), e = f.spawn(80, 0, { threat: 4 }); const rate = f.hero.getEffectiveStats().fireRate;
    for (let i = 0; i < 100; i++) f.hero.abilitySystem.onKill(e);
    close(f.hero.getEffectiveStats().fireRate, rate); assert.equal(f.kit.cooldownRemaining, 6);
    e.hp *= 0.5; e.applyStatus({ type: 'bleed', power: 0.1, duration: 5 }, f.hero); f.update(6);
    CombatSystem.applyImpact(f.shoot(e), e, f.hero, f.game.resourceManager);
    assert.ok(e.isAlive); assert.equal(f.game.resourceManager.lives, 20);
});

test('Ghost Rider: recuperacion de cadena compartida, no renovable al retirar fuente', () => {
    const f = setup('ghost_rider'), e = f.spawn(100, 0, { isBoss: true });
    f.kit.pullWithChain(e); close(e.distanceTravelled, 76); assert.equal(e.hellChainRecovery, 6);
    const other = new Hero(roster.ghost_rider, 0, 0, f.game); f.game.heroes.push(other);
    new TacticalActionSystem(f.game).sell(f.hero);
    other.abilitySystem.streetKit.pullWithChain(e); close(e.distanceTravelled, 76);
    e.updateDebuffs(6); other.abilitySystem.streetKit.pullWithChain(e); close(e.distanceTravelled, 52);
});

test('Ghost Rider: cadena terrestre58, voladores y fuera de alcance intactos', () => {
    const f = setup('ghost_rider'), ground = f.spawn(100), fly = f.spawn(100, 0, { flying: true }), outside = f.spawn(1000);
    for (const e of [ground, fly, outside]) f.kit.pullWithChain(e);
    close(ground.distanceTravelled, 42); close(fly.distanceTravelled, 100); close(outside.distanceTravelled, 1000);
    for (let i = 0; i < 100; i++) f.shoot(ground);
    close(ground.distanceTravelled, 42);
});

test('Ghost Rider: Penitencia escala con vida perdida pero no obtiene reset por bonus de cooldown', () => {
    const damages = [];
    for (const remaining of [1, 0.5, 0.1]) {
        const f = setup('ghost_rider'), e = f.spawn(80, 0, { isBoss: true }); e.hp *= remaining;
        f.game.progression.getHeroBonuses = () => ({ damage: 0, fireRate: 0, range: 0, critChance: 0, abilityCooldown: 0.9, abilityPower: 0.4 });
        const before = e.hp; f.update(11); damages.push(before - e.hp); assert.equal(f.kit.cooldownRemaining, 11);
    }
    assert.ok(damages[0] < damages[1] && damages[1] < damages[2]);
});

test('Ghost Rider: marca aliada no sobrepasa12% pero sigue amplificando ataques sin tope', () => {
    const f = setup('ghost_rider', 100), e = f.spawn(80, 0, { isBoss: true, hp: 100 });
    e.applyStatus({ type: 'mark', power: 0.5, duration: 5 }, { id: 'ally' });
    f.update(11); close(e.hp, 88);
    CombatSystem.applyDamage({ damage: 10, attackerType: f.hero.category }, e, f.hero, f.game.resourceManager, 1);
    close(e.hp, 73);
});
