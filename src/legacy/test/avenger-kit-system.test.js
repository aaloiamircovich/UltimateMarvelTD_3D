import test from 'node:test';
import assert from 'node:assert/strict';
import { Enemy } from '../src/entities/Enemy.js';
import { Hero } from '../src/entities/Hero.js';

test('Hulk convierte presion cercana en furia y ejecuta salto gamma', () => {
    const game = createGame();
    const hero = createHero('hulk', game, { damage: 40, range: 70, fireRate: 0.5, category: 'Mutante' });
    const enemies = [createEnemy(40, 0), createEnemy(65, 0)];
    game.heroes = [hero];
    game.enemies = enemies;
    hero.abilitySystem.update(4.2, enemies, hero.getEffectiveStats(), []);

    assert.ok(enemies.every((enemy) => enemy.hp < enemy.maxHp));
    assert.ok(enemies.every((enemy) => enemy.debuffs.some((effect) => effect.type === 'stun')));
    assert.ok(hero.abilitySystem.avengerKit.cooldownRemaining > 0);
    assert.equal(hero.combatStats.abilityActivations, 1);
});

test('Black Widow sabotea soportes y encadena cada cuarta descarga', () => {
    const game = createGame();
    const hero = createHero('black_widow', game, { damage: 20, range: 180, fireRate: 2, category: 'Urbano' });
    const support = createEnemy(80, 0, { archetype: 'support' });
    const second = createEnemy(110, 0);
    game.heroes = [hero];
    game.enemies = [support, second];

    const effects = hero.getProjectileEffects(support);
    assert.deepEqual(effects.map((effect) => effect.type), ['armorBreak']);
    for (let index = 0; index < 4; index++) hero.abilitySystem.onAttack(support, hero.getEffectiveStats(), { damage: 20 }, []);

    assert.ok(second.hp < second.maxHp);
    assert.ok(support.debuffs.some((effect) => effect.type === 'sabotage'));
    assert.equal(hero.combatStats.abilityActivations, 1);
});

test('Hawkeye cambia entre tres municiones con perfiles distintos', () => {
    const game = createGame();
    const hero = createHero('hawkeye', game);
    const target = createEnemy(80, 0);

    assert.equal(hero.abilitySystem.getProjectileProfile().splashRadius, 68);
    assert.equal(hero.abilitySystem.setCombatMode('cryo'), true);
    assert.equal(hero.getProjectileEffects(target)[0].type, 'slow');
    assert.equal(hero.abilitySystem.setCombatMode('piercing'), true);
    assert.equal(hero.abilitySystem.getProjectileProfile().armorPenetration, 0.65);
    assert.equal(hero.abilitySystem.setCombatMode('imposible'), false);
});

test('Black Panther contraataca sin sacar enemigos del camino', () => {
    const game = createGame();
    const hero = createHero('black_panther', game, { damage: 30, range: 90, fireRate: 1.8, category: 'Tecnológico' });
    const enemy = createEnemy(40, 0);
    enemy.pathIndex = 0;
    enemy.distanceTravelled = 40;
    game.heroes = [hero];
    game.enemies = [enemy];

    hero.abilitySystem.update(0.1, [enemy], hero.getEffectiveStats(), []);

    assert.ok(enemy.hp < enemy.maxHp);
    assert.equal(enemy.y, 0);
    assert.ok(enemy.x >= 0 && enemy.x <= 40);
    assert.ok(hero.abilitySystem.avengerKit.resource >= 20);
});

test('Vision alterna densidad y atraviesa enemigos alineados', () => {
    const game = createGame();
    const hero = createHero('vision', game, { damage: 30, range: 180, fireRate: 1.2, category: 'Tecnológico' });
    const aligned = createEnemy(90, 0);
    const outside = createEnemy(90, 60);
    game.heroes = [hero];
    game.enemies = [aligned, outside];

    assert.equal(hero.abilitySystem.setCombatMode('dense'), true);
    hero.abilitySystem.avengerKit.update(4, [], hero.getEffectiveStats());
    for (let index = 0; index < 3; index++) hero.abilitySystem.onAttack(aligned, hero.getEffectiveStats(), { damage: 30 }, []);

    assert.ok(aligned.hp < aligned.maxHp);
    assert.equal(outside.hp, outside.maxHp);
    assert.equal(hero.combatStats.abilityActivations, 1);
});

test('Redwing comparte deteccion cercana y marca objetivos en reconocimiento', () => {
    const game = createGame();
    const falcon = createHero('falcon', game, { damage: 18, range: 120, fireRate: 2, category: 'Tecnológico' });
    const ally = createHero('iron_man', game, { damage: 20, range: 120, fireRate: 1, category: 'Tecnológico' });
    ally.x = 100;
    const stealth = createEnemy(170, 0, { stealth: true, archetype: 'support' });
    game.heroes = [falcon, ally];
    game.enemies = [stealth];

    falcon.abilitySystem.update(0.1, [stealth], falcon.getEffectiveStats(), []);

    assert.ok(stealth.debuffs.some((effect) => effect.type === 'mark'));
    assert.equal(ally.getEffectiveStats().canSeeStealth, true);
    assert.ok(falcon.abilitySystem.avengerKit.cooldownRemaining > 0);
});

test('kit Avenger mantiene cooldown fijo aunque suba el nivel', () => {
    const levelOne = createHero('falcon', createGame(), { level: 1 });
    const levelHundred = createHero('falcon', createGame(), { level: 100 });

    assert.equal(levelOne.abilitySystem.avengerKit.getCooldown(2.4), 2.4);
    assert.equal(levelHundred.abilitySystem.avengerKit.getCooldown(2.4), 2.4);
});

function createHero(id, game, overrides = {}) {
    return new Hero({
        id,
        name: id,
        damage: 20,
        range: 180,
        fireRate: 1,
        category: 'Urbano',
        allowedTerrains: [1],
        ...overrides
    }, 0, 0, game);
}

function createEnemy(x, y, overrides = {}) {
    const enemy = new Enemy({
        id: 'target',
        hp: 500,
        speed: 60,
        category: 'Urbano',
        ...overrides
    }, [{ x: 0, y: 0 }, { x: 300, y: 0 }]);
    enemy.x = x;
    enemy.y = y;
    enemy.distanceTravelled = x;
    return enemy;
}

function createGame() {
    return {
        heroes: [],
        enemies: [],
        projectiles: [],
        resourceManager: { lives: 20, addCredits: () => {}, addLife: () => {} },
        random: { next: () => 0.5 },
        vfx: { addBeam: () => {}, addBurst: () => {}, addLightning: () => {}, addRing: () => {} },
        audio: { play: () => {} },
        showHeroRanges: false
    };
}
