import test from 'node:test';
import assert from 'node:assert/strict';
import { Enemy } from '../src/entities/Enemy.js';
import { Hero } from '../src/entities/Hero.js';

test('Captain Marvel vuela, atraviesa la línea y regresa a su posición', () => {
    const game = createGame();
    const hero = createHero('captain_marvel', game, { damage: 60, range: 140, category: 'Cósmico' });
    const enemy = createEnemy(180, 0);
    game.heroes = [hero];
    game.enemies = [enemy];
    hero.abilitySystem.cosmicKit.resource = 60;
    hero.abilitySystem.cosmicKit.cooldownRemaining = 0;

    hero.abilitySystem.update(0.1, [enemy], hero.getEffectiveStats(), []);
    assert.equal(hero.x, 0);
    assert.equal(hero.abilitySystem.cosmicKit.canAttack(), false);
    hero.abilitySystem.update(0.45, [enemy], hero.getEffectiveStats(), []);
    assert.equal(enemy.y, 0);
    assert.ok(enemy.hp < enemy.maxHp);
    hero.abilitySystem.update(1.4, [enemy], hero.getEffectiveStats(), []);
    assert.equal(hero.x, 0);
    assert.equal(hero.y, 0);
});

test('Star-Lord dispara a dos blancos y cambia munición', () => {
    const game = createGame();
    const hero = createHero('star_lord', game, { range: 200 });
    const targets = [createEnemy(80, 0), createEnemy(110, 0)];
    game.heroes = [hero];
    game.enemies = targets;
    const projectiles = [];
    hero.abilitySystem.cosmicKit.update(1, [], hero.getEffectiveStats());
    hero.abilitySystem.onAttack(targets[0], hero.getEffectiveStats(), { attacker: hero, damage: 20, effects: [] }, projectiles);
    assert.equal(projectiles.length, 1);
    assert.equal(projectiles[0].target, targets[1]);
    assert.equal(hero.abilitySystem.setCombatMode('cryo'), true);
    assert.equal(hero.getProjectileEffects(targets[0])[0].type, 'slow');
    assert.equal(hero.abilitySystem.setCombatMode('incendiary'), true);
    assert.equal(hero.getProjectileEffects(targets[0])[0].type, 'burn');
});

test('Groot crea raíces sobre la ruta sin desplazar enemigos', () => {
    const game = createGame();
    const hero = createHero('groot', game, { range: 130 });
    const enemy = createEnemy(90, 0);
    game.heroes = [hero];
    game.enemies = [enemy];

    hero.abilitySystem.update(10, [enemy], hero.getEffectiveStats(), []);
    const wall = hero.abilitySystem.cosmicKit.rootWall;
    assert.ok(wall);
    hero.abilitySystem.update(0.2, [enemy], hero.getEffectiveStats(), []);
    assert.equal(enemy.y, 0);
    assert.ok(enemy.debuffs.some((effect) => effect.type === 'slow'));
});

test('Gamora ejecuta enemigos débiles pero no jefes', () => {
    const game = createGame();
    const hero = createHero('gamora', game, { damage: 40, range: 100 });
    const target = createEnemy(60, 0);
    target.hp = 100;
    game.heroes = [hero];
    game.enemies = [target];

    hero.abilitySystem.onAttack(target, hero.getEffectiveStats(), { damage: 40 }, []);
    assert.equal(target.isAlive, false);

    const boss = createEnemy(60, 0, { isBoss: true });
    boss.hp = 100;
    game.enemies = [boss];
    hero.abilitySystem.onAttack(boss, hero.getEffectiveStats(), { damage: 40 }, []);
    assert.equal(boss.isAlive, true);
});

test('Silver Surfer configura Poder Cósmico y atraviesa objetivos', () => {
    const game = createGame();
    const hero = createHero('silver_surfer', game, { damage: 50, range: 240, category: 'Cósmico' });
    const aligned = createEnemy(100, 0);
    const outside = createEnemy(100, 70);
    game.heroes = [hero];
    game.enemies = [aligned, outside];

    assert.equal(hero.abilitySystem.setCombatMode('control'), true);
    for (let index = 0; index < 2; index++) hero.abilitySystem.onAttack(aligned, hero.getEffectiveStats(), { damage: 50 }, []);
    assert.ok(aligned.hp < aligned.maxHp);
    assert.equal(outside.hp, outside.maxHp);
    assert.equal(hero.abilitySystem.getProjectileProfile().chainCount, 2);
});

function createHero(id, game, overrides = {}) {
    return new Hero({ id, name: id, damage: 20, range: 180, fireRate: 1, category: 'Cósmico', allowedTerrains: [0, 1, 3], tags: ['Guardianes'], ...overrides }, 0, 0, game);
}

function createEnemy(x, y, overrides = {}) {
    const enemy = new Enemy({ id: 'target', hp: 500, speed: 60, category: 'Cósmico', ...overrides }, [{ x: 0, y: 0 }, { x: 400, y: 0 }]);
    enemy.x = x;
    enemy.y = y;
    enemy.distanceTravelled = x;
    return enemy;
}

function createGame() {
    return {
        heroes: [], enemies: [], projectiles: [], activeTeam: [],
        resourceManager: { lives: 19, maxLives: 20, addLife(amount) { this.lives = Math.min(this.maxLives, this.lives + amount); }, addCredits: () => {} },
        random: { next: () => 0.5 },
        vfx: { addBeam: () => {}, addBurst: () => {}, addLightning: () => {}, addRing: () => {} },
        audio: { play: () => {} }, showHeroRanges: false
    };
}
