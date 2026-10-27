import test from 'node:test';
import assert from 'node:assert/strict';
import { Enemy } from '../src/entities/Enemy.js';
import { Hero } from '../src/entities/Hero.js';

test('Wolverine entra en frenesi, salta y regresa a su puesto', () => {
    const game = createGame(); const hero = createHero('wolverine', game, { range: 70 }); const enemy = createEnemy(150);
    game.heroes = [hero]; game.enemies = [enemy]; hero.abilitySystem.mutantKit.resource = 55;
    hero.abilitySystem.update(0.1, [enemy], hero.getEffectiveStats(), []);
    assert.notEqual(hero.x, 0); assert.equal(enemy.y, 0);
    hero.abilitySystem.update(0.9, [enemy], hero.getEffectiveStats(), []);
    assert.equal(hero.x, 0); assert.equal(hero.y, 0);
});

test('Jean Grey empuja por la ruta y libera el medidor Phoenix', () => {
    const game = createGame(); const hero = createHero('jean_grey', game, { damage: 60, range: 220 }); const enemies = [createEnemy(120), createEnemy(150)];
    game.heroes = [hero]; game.enemies = enemies;
    for (let i = 0; i < 4; i++) hero.abilitySystem.onAttack(enemies[0], hero.getEffectiveStats(), {}, []);
    assert.equal(enemies[1].distanceTravelled, 150); assert.equal(enemies[1].y, 0);
    hero.abilitySystem.mutantKit.resource = 100; const hp = enemies[0].hp;
    hero.abilitySystem.mutantKit.cooldownRemaining = 0;
    hero.abilitySystem.update(0.1, enemies, hero.getEffectiveStats(), []);
    assert.equal(enemies[0].hp, hp);
    hero.abilitySystem.update(0.6, enemies, hero.getEffectiveStats(), []);
    assert.ok(enemies[1].distanceTravelled < 150);
    assert.ok(enemies[0].hp < hp); assert.equal(hero.abilitySystem.mutantKit.resource, 0);
});

test('Phoenix carga su medidor mas rapido que Jean Grey base', () => {
    const game = createGame();
    game.progression = { getHeroBonuses: () => ({}), getHeroEvolution: () => ({ id: 'phoenix', stats: { damage: 0.22, fireRate: 0.08, range: 0.08, critChance: 5 } }) };
    const hero = createHero('jean_grey', game);
    const enemy = createEnemy(100);
    hero.abilitySystem.onAttack(enemy, hero.getEffectiveStats(), {}, []);
    assert.equal(hero.abilitySystem.mutantKit.resource, 14);
});

test('Cyclops alterna linea penetrante y rebotes opticos', () => {
    const game = createGame(); const hero = createHero('cyclops', game, { damage: 40, range: 240 }); const enemies = [createEnemy(100), createEnemy(180)];
    game.heroes = [hero]; game.enemies = enemies;
    for (let i = 0; i < 3; i++) hero.abilitySystem.onAttack(enemies[0], hero.getEffectiveStats(), {}, []);
    assert.ok(enemies[1].hp < enemies[1].maxHp);
    assert.equal(hero.abilitySystem.setCombatMode('ricochet'), true);
    assert.equal(hero.abilitySystem.getProjectileProfile().chainCount, 3);
});

test('Storm crea clima de hielo y electricidad sobre la ruta', () => {
    const game = createGame(); const hero = createHero('storm', game, { range: 200 }); const enemy = createEnemy(100);
    game.heroes = [hero]; game.enemies = [enemy];
    hero.abilitySystem.update(9, [enemy], hero.getEffectiveStats(), []);
    hero.abilitySystem.update(0.2, [enemy], hero.getEffectiveStats(), []);
    assert.ok(enemy.debuffs.some((effect) => effect.type === 'slow')); assert.equal(enemy.y, 0);
    assert.equal(hero.abilitySystem.setCombatMode('lightning'), true);
});

test('Domino genera economia sin desviar enemigos de la ruta', () => {
    const game = createGame(); const hero = createHero('domino', game); const enemy = createEnemy(370);
    game.heroes = [hero]; game.enemies = [enemy]; const start = enemy.distanceTravelled;
    hero.abilitySystem.update(0.1, [enemy], hero.getEffectiveStats(), []);
    for (let index = 0; index < 5; index++) hero.abilitySystem.onAttack(enemy, hero.getEffectiveStats(), {}, []);
    assert.equal(enemy.distanceTravelled, start); assert.equal(enemy.y, 0);
    assert.equal(hero.abilitySystem.getDisplayState().label, 'Economia: +15% recompensa');
});

test('Scarlet Witch enlaza maldiciones y altera el tiempo', () => {
    const game = createGame(); const hero = createHero('scarlet_witch', game, { range: 220 }); const enemies = [createEnemy(100), createEnemy(130)];
    game.heroes = [hero]; game.enemies = enemies;
    enemies.forEach(enemy => enemy.applyStatus({ type: 'curse', power: 0.0048, duration: 4 }, hero));
    hero.abilitySystem.mysticKit.update(7);
    hero.abilitySystem.onAttack(enemies[0], hero.getEffectiveStats(), {}, []);
    assert.equal(hero.abilitySystem.mysticKit.network.targets.length, 2);
    hero.abilitySystem.update(0.1, enemies, hero.getEffectiveStats(), []);
    assert.ok(enemies.every((enemy) => enemy.debuffs.some((effect) => effect.type === 'slow')));
});

test('Ant-Man alterna formas diminuta y gigante con impacto seguro', () => {
    const game = createGame(); const hero = createHero('ant_man', game, { damage: 28, range: 110 }); const enemy = createEnemy(90);
    game.heroes = [hero]; game.enemies = [enemy];
    assert.ok(hero.getEffectiveStats().fireRate > hero.fireRate);
    for (let i = 0; i < 3; i++) hero.abilitySystem.onAttack(enemy, hero.getEffectiveStats(), {}, []);
    hero.abilitySystem.update(4, [enemy], hero.getEffectiveStats(), []);
    assert.equal(hero.abilitySystem.setCombatMode('giant'), true); const start = enemy.distanceTravelled;
    hero.abilitySystem.onAttack(enemy, hero.getEffectiveStats(), {}, []);
    assert.ok(enemy.distanceTravelled < start); assert.equal(enemy.y, 0);
});

test('Winter Soldier selecciona tres tipos de municion', () => {
    const game = createGame(); const hero = createHero('winter_soldier', game); game.heroes = [hero];
    assert.equal(hero.abilitySystem.getProjectileProfile().armorPenetration, 0.65);
    assert.equal(hero.abilitySystem.setCombatMode('shock'), true);
    assert.equal(hero.getProjectileEffects().length, 0);
    hero.abilitySystem.mutantKit.attackCount = 2;
    assert.equal(hero.getProjectileEffects()[0].type, 'stun');
    assert.equal(hero.abilitySystem.setCombatMode('explosive'), true); assert.ok(hero.abilitySystem.getProjectileProfile().splashRadius > 0);
});

function createHero(id, game, overrides = {}) { return new Hero({ id, name: id, damage: 35, range: 160, fireRate: 1.3, category: 'Mutante', allowedTerrains: [0, 1, 3], tags: ['X-Men'], ...overrides }, 0, 0, game); }
function createEnemy(x, overrides = {}) { const enemy = new Enemy({ id: 'target', hp: 900, speed: 60, category: 'Mutante', ...overrides }, [{ x: 0, y: 0 }, { x: 400, y: 0 }]); enemy.x = x; enemy.y = 0; enemy.distanceTravelled = x; return enemy; }
function createGame() { return { heroes: [], enemies: [], projectiles: [], activeTeam: [], resourceManager: { lives: 19, maxLives: 20, credits: 0, addLife(n) { this.lives = Math.min(this.maxLives, this.lives + n); }, addCredits(n) { this.credits += n; } }, random: { next: () => 0.5 }, vfx: { addBeam: () => {}, addBurst: () => {}, addLightning: () => {}, addRing: () => {} }, audio: { play: () => {} }, showHeroRanges: false }; }
