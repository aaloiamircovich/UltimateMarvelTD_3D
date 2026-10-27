import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Hero } from '../src/entities/Hero.js';
import { Enemy } from '../src/entities/Enemy.js';

const heroes = JSON.parse(fs.readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8'));
function setup(level = 1) {
    const game = { heroes: [], enemies: [], projectiles: [], random: { next: () => 0 }, resourceManager: { lives: 15 } };
    const luke = new Hero({ ...heroes.luke_cage, level }, 0, 0, game);
    const ally = new Hero({ id: 'ally', damage: 10, range: 120, fireRate: 1.2, critChance: 5 }, 40, 0, game);
    game.heroes = [luke, ally];
    return { game, luke, ally };
}

test('Luke deja de aumentar alcance y cadencia aliados, incluso con copias cercanas', () => {
    const { game, luke, ally } = setup();
    const alone = { damage: ally.damage, range: ally.range, fireRate: ally.fireRate };
    for (const x of [0, 134, 136, 1000]) {
        luke.x = x;
        for (const [key, value] of Object.entries(alone)) assert.equal(ally.getEffectiveStats()[key], value, key);
    }
    game.heroes.push(new Hero(heroes.luke_cage, 20, 0, game));
    assert.equal(ally.getEffectiveStats().fireRate, ally.fireRate);
    assert.equal(ally.getEffectiveStats().range, ally.range);
});

test('Luke reduce stun 50% en niveles 1/50/100; el aliado no hereda tenacidad', () => {
    for (const level of [1, 50, 100]) {
        const { luke, ally } = setup(level);
        luke.applyStun(4);
        ally.applyStun(4);
        assert.equal(luke.stunTimer, 2);
        assert.equal(ally.stunTimer, 4);
        assert.equal(luke.getStunResistance(), 0.5);
        assert.equal(luke.isSupportAuraOnly(), false);
    }
});

test('Luke no ataca aturdido y recupera su ruptura al terminar la mitad del tiempo', () => {
    const { game, luke, ally } = setup();
    const target = new Enemy({ id: 'target', hp: 10000, speed: 1, armor: 0.5 }, [{ x: 40, y: 0 }, { x: 1000, y: 0 }]);
    game.enemies = [target];
    luke.applyStun(4);
    ally.applyStun(4);
    luke.update(1.9, [target], game.projectiles);
    assert.equal(game.projectiles.length, 0);
    luke.update(0.2, [target], game.projectiles);
    assert.equal(game.projectiles.length, 1);
    const shot = game.projectiles[0];
    shot.x = target.x;
    shot.y = target.y;
    shot.update(0);
    assert.ok(target.hp < target.maxHp);
    assert.ok(target.debuffs.some((effect) => effect.type === 'armorBreak' && effect.power === 0.28));
    const allyShots = [];
    ally.update(2.1, [target], allyShots);
    assert.equal(allyShots.length, 0);
    assert.equal(game.resourceManager.lives, 15);
});

test('reaplicar stun no acumula ni acorta el tiempo pendiente; no concede disparo gratis', () => {
    const { luke } = setup();
    luke.timer = 10;
    luke.applyStun(6);
    assert.equal(luke.stunTimer, 3);
    assert.equal(luke.timer, 0);
    luke.update(1, [], []);
    luke.applyStun(2);
    assert.equal(luke.stunTimer, 2);
    luke.applyStun(8);
    assert.equal(luke.stunTimer, 4);
});

test('tenacidad es acotada y el indicador no promete una guardia activable', () => {
    const { luke, ally } = setup();
    assert.match(luke.abilitySystem.getDisplayState().label, /50%/);
    assert.equal(luke.abilitySystem.getDisplayState().progress, null);
    for (const [resistance, expected] of [[-1, 0], [1, 0.8], [NaN, 0]]) {
        ally.config.special = { stunResistance: resistance };
        assert.equal(ally.getStunResistance(), expected);
    }
    assert.match(heroes.luke_cage.abilityDesc, /50% menos/);
});

test('una fase real de boss aplica la reduccion solo a Luke', () => {
    const { game, luke, ally } = setup();
    const boss = new Enemy({ id: 'boss', isBoss: true, hp: 1000, speed: 1 }, [{ x: 40, y: 0 }, { x: 1000, y: 0 }], game);
    boss.behavior.activateBossPhase({ name: 'Stun', stunHeroes: true, stunDuration: 4 });
    assert.equal(luke.stunTimer, 2);
    assert.equal(ally.stunTimer, 4);
});
