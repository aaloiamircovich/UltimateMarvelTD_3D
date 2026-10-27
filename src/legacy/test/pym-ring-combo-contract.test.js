import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Hero } from '../src/entities/Hero.js';
import { Enemy } from '../src/entities/Enemy.js';
import { CombatSystem } from '../src/systems/CombatSystem.js';
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
    const spawn = (x = 50, extra = {}) => {
        const enemy = new Enemy({ id: 'target', category: hero.category, hp: 1e8, speed: 1, ...extra },
            [{ x: 0, y: 0 }, { x: 10000, y: 0 }], game);
        enemy.x = x; enemy.distanceTravelled = x; game.enemies.push(enemy); return enemy;
    };
    const shoot = target => { const shots = []; hero.shoot(target, hero.getEffectiveStats(), shots); return shots[0]; };
    const kit = id === 'ant_man' ? hero.abilitySystem.mutantKit : hero.abilitySystem.streetKit;
    const update = dt => kit.update(dt, game.enemies, hero.getEffectiveStats());
    const mode = value => hero.abilitySystem.setCombatMode(value);
    return { hero, game, spawn, shoot, kit, update, mode };
}

for (const level of [1, 49, 50, 51, 99, 100]) {
    test(`Ant-Man ${level}: carga diminuta, impacto gigante y cinco victimas maximo`, () => {
        const f = setup('ant_man', level), targets = Array.from({ length: 7 }, () => f.spawn());
        for (let i = 0; i < 8; i++) f.shoot(targets[0]);
        assert.equal(f.kit.pymCharge, 3);
        f.mode('giant'); f.shoot(targets[0]); assert.equal(f.hero.combatStats.abilityActivations, 0);
        f.update(4); const shot = f.shoot(targets[0]);
        assert.ok(shot.splashRadius > 0);
        assert.equal(targets.filter(t => t.hp < t.maxHp).length, 5);
        assert.equal(f.kit.pymCharge, 0); assert.equal(f.kit.cooldownRemaining, 4);
        assert.equal(f.hero.combatStats.abilityActivations, 1);
        assert.ok(targets.every(t => t.y === 0));
        assert.equal(f.game.resourceManager.credits, 0); assert.equal(f.game.resourceManager.lives, 20);
    });
    for (const mode of ['orbit', 'volley', 'guard']) {
        test(`Shang-Chi ${level}: finalizador ${mode} consume una sola carga`, () => {
            const f = setup('shang_chi', level), target = f.spawn(); f.mode(mode);
            for (let i = 0; i < 3; i++) f.shoot(target);
            assert.equal(f.kit.ringCharge, 3); f.update(4);
            const shot = f.shoot(target);
            if (mode === 'orbit') { assert.equal(shot.chainCount, 4); assert.equal(shot.chainRange, 110); }
            if (mode === 'volley') { assert.equal(shot.splashRadius, 82); close(shot.armorPenetration, 0.5); }
            if (mode === 'guard') {
                const effect = shot.effects.find(e => e.type === 'slow');
                close(effect.power, 0.45); close(effect.duration, 1.5);
            }
            assert.equal(f.kit.ringCharge, 0); assert.equal(f.kit.cooldownRemaining, 4);
            assert.equal(f.hero.combatStats.abilityActivations, 1);
            const normal = f.shoot(target);
            if (mode === 'orbit') assert.equal(normal.chainCount, 3);
            if (mode === 'volley') assert.equal(normal.splashRadius, 62);
            if (mode === 'guard') assert.equal(normal.effects.some(e => e.type === 'slow'), false);
            assert.equal(f.game.resourceManager.credits, 0); assert.equal(f.game.resourceManager.lives, 20);
        });
    }
}

for (const id of ['ant_man', 'shang_chi']) {
    test(`${id}: cambios validos, invalidos y consultas no cargan ni reinician recarga`, () => {
        const f = setup(id), target = f.spawn();
        const field = id === 'ant_man' ? 'pymCharge' : 'ringCharge';
        f.shoot(target); f.update(1);
        for (let i = 0; i < 10; i++) {
            for (const mode of id === 'ant_man' ? ['giant', 'tiny'] : ['guard', 'volley', 'orbit']) f.mode(mode);
            assert.equal(f.mode('invalid'), false); f.kit.getDisplayState(); f.hero.getProjectileProfile();
        }
        assert.equal(f.kit[field], 1); assert.equal(f.kit.cooldownRemaining, 3);
        assert.equal(setup(id).kit.cooldownRemaining, 4);
    });
}

test('Ant-Man: gigante no carga Pym, ni siquiera durante la recarga', () => {
    const f = setup('ant_man'), target = f.spawn(); f.mode('giant'); f.update(10);
    for (let i = 0; i < 12; i++) f.shoot(target);
    assert.equal(f.kit.pymCharge, 0); assert.equal(f.hero.combatStats.abilityActivations, 0);
});

test('Ant-Man: no consume sobre blancos fuera de alcance y respeta inmunidades de retroceso', () => {
    const f = setup('ant_man'), target = f.spawn(50, { isBoss: true, immuneToKnockback: true });
    const flying = f.spawn(51, { flying: true }), hidden = f.spawn(52, { stealth: true });
    for (let i = 0; i < 3; i++) f.shoot(target);
    f.mode('giant'); f.update(4);
    f.kit.onAttack(f.spawn(10000), f.hero.getEffectiveStats());
    assert.equal(f.kit.pymCharge, 3); assert.equal(f.kit.cooldownRemaining, 0);
    f.kit.onAttack(target, { ...f.hero.getEffectiveStats(), canSeeStealth: false });
    close(target.distanceTravelled, 50); close(flying.distanceTravelled, 51);
    close(hidden.hp, hidden.maxHp); assert.ok(target.hp < target.maxHp);
});

test('Ant-Man: jefe retrocede 15px, no abandona ruta y carga consumida no reaparece', () => {
    const f = setup('ant_man'), target = f.spawn(50, { isBoss: true });
    for (let i = 0; i < 3; i++) f.shoot(target);
    f.update(4); f.mode('giant'); f.shoot(target);
    close(target.distanceTravelled, 35); close(target.y, 0);
    f.mode('tiny'); f.mode('giant'); f.update(4); f.shoot(target);
    close(target.distanceTravelled, 35);
});

test('Shang-Chi: cambio con combo listo elige finalizador sin ataque gratis', () => {
    const f = setup('shang_chi'), target = f.spawn();
    for (let i = 0; i < 3; i++) f.shoot(target);
    f.update(4); f.mode('volley');
    assert.equal(f.hero.combatStats.shots, 3); assert.equal(f.kit.ringCharge, 3);
    const shot = f.shoot(target); f.mode('orbit');
    assert.equal(shot.splashRadius, 82); assert.equal(shot.chainCount, 0);
    assert.equal(f.kit.cooldownRemaining, 4);
});

test('Shang-Chi: Guardia respeta inmunidad a slow y no lo transmite por rebote', () => {
    const f = setup('shang_chi'), target = f.spawn(50, { isBoss: true, immuneToSlow: true }), other = f.spawn(60);
    f.mode('guard'); for (let i = 0; i < 3; i++) f.shoot(target);
    f.update(4); CombatSystem.applyImpact(f.shoot(target), target, f.hero, f.game.resourceManager);
    assert.equal(target.debuffs.some(e => e.type === 'slow'), false);
    assert.equal(other.debuffs.some(e => e.type === 'slow'), false);
});
