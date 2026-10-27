import test from 'node:test';
import assert from 'node:assert/strict';
import { Enemy } from '../src/entities/Enemy.js';
import { Hero } from '../src/entities/Hero.js';

test('Daredevil revela ocultos locales sin compartir vision global', () => {
    const game = createGame();
    const daredevil = createHero('daredevil', game, { canSeeStealth: true });
    const ally = createHero('iron_man', game, { canSeeStealth: false });
    game.heroes = [daredevil, ally];

    const hidden = createEnemy(100, 0, { stealth: true });
    daredevil.abilitySystem.update(8, [hidden], daredevil.getEffectiveStats(), []);
    assert.ok(daredevil.abilitySystem.streetKit.radarTimer > 0);
    assert.equal(ally.getEffectiveStats().canSeeStealth, false);
    assert.equal(hidden.stealth, false);
});

test('Moon Knight alterna alcance, dano y control con el ciclo lunar', () => {
    const game = createGame();
    const hero = createHero('moon_knight', game, { damage: 40, range: 120 });
    game.heroes = [hero];
    assert.ok(hero.getEffectiveStats().range > 120);

    hero.abilitySystem.update(10.1, [], hero.getEffectiveStats(), []);
    assert.ok(hero.getEffectiveStats().damage > 40);
    hero.abilitySystem.update(10.1, [], hero.getEffectiveStats(), []);
    assert.equal(hero.getProjectileEffects()[0].type, 'slow');
});

test('Blade sangra elites sin curar la base', () => {
    const game = createGame();
    const hero = createHero('blade', game);
    game.heroes = [hero];
    const elite = createEnemy(50, 0, { threat: 5 });
    assert.equal(hero.getProjectileEffects(elite)[0].duration, 5);

    for (let index = 0; index < 6; index++) hero.abilitySystem.onKill();
    assert.equal(game.resourceManager.lives, 19);
    assert.equal(hero.abilitySystem.streetKit.cooldownRemaining, 6);
    assert.equal(hero.combatStats.abilityActivations, 0);
});

test('Ghost Rider arrastra por la ruta y usa Penitencia solo contra jefes', () => {
    const game = createGame();
    const hero = createHero('ghost_rider', game, { damage: 60, range: 180, category: 'Mistico' });
    const boss = createEnemy(170, 0, { isBoss: true, hp: 1000 });
    boss.hp = 600;
    game.heroes = [hero];
    game.enemies = [boss];
    const start = boss.distanceTravelled;

    for (let index = 0; index < 5; index++) hero.abilitySystem.onAttack(boss, hero.getEffectiveStats(), {}, []);
    assert.ok(boss.distanceTravelled < start);
    assert.equal(boss.y, 0);
    const beforePenance = boss.hp;
    hero.abilitySystem.update(11, [boss], hero.getEffectiveStats(), []);
    assert.ok(boss.hp < beforePenance);
});

test('Luke Cage no intercepta fugas ni conserva buffs aliados', () => {
    const game = createGame();
    const hero = createHero('luke_cage', game, { range: 90 });
    const ally = createHero('ally', game, { range: 120, fireRate: 1.2 });
    const enemy = createEnemy(350, 0);
    game.heroes = [hero, ally];
    game.enemies = [enemy];
    const start = enemy.distanceTravelled;

    hero.abilitySystem.update(0.1, [enemy], hero.getEffectiveStats(), []);
    assert.equal(enemy.distanceTravelled, start);
    assert.equal(enemy.y, 0);
    assert.equal(ally.getEffectiveStats().range, ally.range);
    assert.equal(ally.getEffectiveStats().fireRate, ally.fireRate);
    assert.equal(hero.abilitySystem.getDisplayState().progress, null);
});

test('Shang-Chi configura tres patrones de los Diez Anillos', () => {
    const game = createGame();
    const hero = createHero('shang_chi', game);
    game.heroes = [hero];
    assert.equal(hero.abilitySystem.getCombatMode(), 'orbit');
    assert.equal(hero.abilitySystem.getProjectileProfile().chainCount, 3);
    assert.equal(hero.abilitySystem.setCombatMode('volley'), true);
    assert.ok(hero.abilitySystem.getProjectileProfile().splashRadius > 0);
    assert.equal(hero.abilitySystem.setCombatMode('guard'), true);
    assert.equal(hero.getEffectiveStats().fireRate > hero.fireRate, true);
});

test('She-Hulk prepara e impacta grupos con retroceso seguro', () => {
    const game = createGame();
    const hero = createHero('she_hulk', game, { damage: 55, range: 100, category: 'Mutante' });
    const enemies = [createEnemy(100, 0), createEnemy(130, 0)];
    game.heroes = [hero];
    game.enemies = enemies;
    const start = enemies[1].distanceTravelled;
    hero.abilitySystem.update(4, enemies, hero.getEffectiveStats(), []);
    for (let index = 0; index < 3; index++) hero.abilitySystem.onAttack(enemies[0], hero.getEffectiveStats(), {}, []);
    assert.ok(enemies[1].distanceTravelled < start);
    assert.equal(enemies[1].y, 0);
    assert.ok(enemies[1].debuffs.some((effect) => effect.type === 'mark'));
});

function createHero(id, game, overrides = {}) {
    return new Hero({ id, name: id, damage: 30, range: 140, fireRate: 1.5, category: 'Urbano', allowedTerrains: [1, 3], tags: ['Callejero'], ...overrides }, 0, 0, game);
}

function createEnemy(x, y, overrides = {}) {
    const config = { id: 'target', hp: 600, speed: 60, category: 'Urbano', ...overrides };
    const enemy = new Enemy(config, [{ x: 0, y: 0 }, { x: 400, y: 0 }]);
    enemy.x = x;
    enemy.y = y;
    enemy.distanceTravelled = x;
    return enemy;
}

function createGame() {
    return {
        heroes: [], enemies: [], projectiles: [], activeTeam: [],
        resourceManager: {
            lives: 19, maxLives: 20, credits: 0,
            addLife(amount) { this.lives = Math.min(this.maxLives, this.lives + amount); },
            addCredits(amount) { this.credits += amount; }
        },
        random: { next: () => 0.5 },
        vfx: { addBeam: () => {}, addBurst: () => {}, addLightning: () => {}, addRing: () => {} },
        audio: { play: () => {} }, showHeroRanges: false
    };
}
