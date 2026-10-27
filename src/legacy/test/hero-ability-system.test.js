import test from 'node:test';
import assert from 'node:assert/strict';
import { Enemy } from '../src/entities/Enemy.js';
import { Hero } from '../src/entities/Hero.js';
import { HeroAbilitySystem } from '../src/systems/HeroAbilitySystem.js';

test('Sobrecarga ARC encuentra solo enemigos alineados', () => {
    const origin = { x: 0, y: 0 };
    const target = { x: 100, y: 0 };
    const aligned = { x: 70, y: 10, isAlive: true };
    const outside = { x: 70, y: 35, isAlive: true };
    const behind = { x: -10, y: 0, isAlive: true };

    const result = HeroAbilitySystem.getLineTargets(origin, target, [aligned, outside, behind], 120, 20);
    assert.deepEqual(result, [aligned]);
});

test('Spider-Man inmoviliza al acumular tres redes', () => {
    const enemy = createEnemy(100, 0);
    const web = { type: 'web', duration: 2.6, power: 0.2 };
    let binds = 0;
    const source = { recordAbility: () => { binds++; } };

    enemy.applyStatus(web, source);
    enemy.applyStatus(web, source);
    enemy.updateDebuffs(0.1);
    assert.equal(enemy.speed, 60);

    enemy.applyStatus(web, source);
    enemy.updateDebuffs(0.1);
    assert.equal(enemy.speed, 0);
    assert.equal(enemy.debuffs.find((status) => status.type === 'web').stacks, 0);
    assert.equal(binds, 1);
});

test('Capitan America usa aura de dano sin disparar', () => {
    const game = createGame();
    const captain = new Hero({
        ...createHeroConfig('capitan_america'),
        special: { supportAura: { type: 'damage', power: 0.1, range: 150 } }
    }, 0, 0, game);
    const ally = new Hero(createHeroConfig('iron_man'), 100, 0, game);
    game.heroes = [captain, ally];

    const stats = ally.getEffectiveStats();
    assert.equal(stats.damage, 11);
    assert.equal(stats.fireRate, 1);
    const projectiles = [];
    captain.update(2, [createEnemy(40, 0)], projectiles);
    assert.equal(projectiles.length, 0);
});

test('Iron Man activa Sobrecarga ARC cada tres ataques', () => {
    const game = createGame();
    const target = createEnemy(100, 0);
    game.enemies = [target];
    const hero = new Hero(createHeroConfig('iron_man'), 0, 0, game);
    hero.abilitySystem.arcCooling = 0;
    game.heroes = [hero];
    const config = { damage: 10, attacker: hero, attackerType: 'Tecnológico', effects: [] };

    hero.abilitySystem.onAttack(target, hero.getEffectiveStats(), config, []);
    hero.abilitySystem.onAttack(target, hero.getEffectiveStats(), config, []);
    hero.abilitySystem.onAttack(target, hero.getEffectiveStats(), config, []);

    assert.equal(target.hp, 86.5);
    assert.equal(hero.combatStats.abilityActivations, 1);
});

test('Extremis activa Sobrecarga ARC cada dos ataques', () => {
    const game = createGame();
    game.progression = { getHeroBonuses: () => null, getHeroEvolution: () => ({ id: 'iron_man_extremis', stats: { damage: 0.18, fireRate: 0.12, range: 0, critChance: 4 } }) };
    const target = createEnemy(100, 0);
    game.enemies = [target];
    const hero = new Hero(createHeroConfig('iron_man'), 0, 0, game);
    hero.abilitySystem.arcCooling = 0;
    game.heroes = [hero];
    const config = { damage: 10, attacker: hero, attackerType: 'Tecnologico', effects: [] };

    hero.abilitySystem.onAttack(target, hero.getEffectiveStats(), config, []);
    hero.abilitySystem.onAttack(target, hero.getEffectiveStats(), config, []);

    assert.equal(hero.combatStats.abilityActivations, 1);
});

test('Iron Spider inmoviliza con dos redes y detecta sigilo', () => {
    const game = createGame();
    game.progression = { getHeroBonuses: () => ({}), getHeroEvolution: () => ({ id: 'iron_spider', stats: { damage: 0.1, fireRate: 0, range: 0.16, critChance: 3 } }) };
    const hero = new Hero(createHeroConfig('spiderman'), 0, 0, game);
    const enemy = createEnemy(100, 0);
    const web = hero.abilitySystem.getAttackEffects(enemy).find((effect) => effect.type === 'web');

    enemy.applyStatus(web, hero);
    enemy.applyStatus(web, hero);
    enemy.updateDebuffs(0.1);

    assert.equal(enemy.speed, 0);
    assert.equal(hero.getEffectiveStats().canSeeStealth, true);
});

test('Thor prepara Tormenta Divina con tres objetivos conectados', () => {
    const game = createGame();
    const targets = [createEnemy(50, 0), createEnemy(90, 0), createEnemy(130, 0)];
    game.enemies = targets;
    const hero = new Hero(createHeroConfig('thor'), 0, 0, game);
    game.heroes = [hero];

    const kit = hero.abilitySystem.arcaneStormKit;
    kit.update(11);
    hero.abilitySystem.onAttack(targets[0], hero.getEffectiveStats(), {}, []);
    assert.ok(targets.every(target => target.hp === 100));
    kit.update(1);

    assert.ok(targets.every((target) => target.hp < 100));
    assert.equal(kit.cooldown, 10);
    assert.equal(hero.combatStats.abilityActivations, 1);
});

test('cooldown de habilidad activa no baja solo por nivel', () => {
    const levelOne = new Hero({ ...createHeroConfig('thor'), level: 1 }, 0, 0, createGame());
    const levelHundred = new Hero({ ...createHeroConfig('thor'), level: 100 }, 0, 0, createGame());

    assert.equal(levelOne.abilitySystem.arcaneStormKit.cooldown, 11);
    assert.equal(levelHundred.abilitySystem.arcaneStormKit.cooldown, 11);
});

test('Doctor Strange prepara un eco sin duplicar proyectiles ni sus efectos', () => {
    const game = createGame();
    const targets = [createEnemy(50, 0), createEnemy(80, 0)];
    game.enemies = targets;
    const hero = new Hero(createHeroConfig('doctor_strange'), 0, 0, game);
    game.heroes = [hero];
    const projectiles = [];
    const config = { damage: 10, attacker: hero, attackerType: 'Místico', effects: [], radius: 5 };
    const kit = hero.abilitySystem.arcaneStormKit;
    kit.update(9);
    hero.abilitySystem.onAttack(targets[0], hero.getEffectiveStats(), config, projectiles);
    hero.abilitySystem.onAttack(targets[0], hero.getEffectiveStats(), config, projectiles);

    assert.equal(projectiles.length, 0);
    assert.equal(kit.echo.target, targets[1]);
    assert.equal(kit.echo.damage, 6.5);
    assert.equal(hero.combatStats.abilityActivations, 1);
});

test('Strange respeta punto ciego, sigilo y alcance efectivo en campo y portales', () => {
    const game = createGame();
    const hero = new Hero({ ...createHeroConfig('doctor_strange'), rangePattern: 'ring' }, 0, 0, game);
    game.heroes = [hero];
    const [inner, visible, hidden, buffRange] = [10, 110, 120, 230].map((x) => createEnemy(x, 0));
    hidden.stealth = true;
    game.enemies = [inner, visible, hidden, buffRange];
    const stats = { ...hero.getEffectiveStats(), range: 250, canSeeStealth: false };
    hero.getEffectiveStats = () => stats;
    assert.deepEqual(hero.abilitySystem.getTargetsInRange(game.enemies, stats.range, stats), [visible, buffRange]);
    const kit = hero.abilitySystem.arcaneStormKit;
    kit.update(9);
    kit.onAttack(buffRange, stats);
    assert.equal(inner.debuffs.length, 0);
    assert.equal(hidden.debuffs.length, 0);
    assert.equal(buffRange.debuffs[0].type, 'slow');
    assert.equal(visible.debuffs.length, 0);
    assert.equal(kit.echo.target, buffRange);
    assert.ok(hero.abilitySystem.getTargetsInRange(game.enemies, stats.range, { ...stats, canSeeStealth: true }).includes(hidden));
});

test('portal no duplica hacia un objetivo muerto si no quedan candidatos validos', () => {
    const game = createGame();
    const hero = new Hero(createHeroConfig('doctor_strange'), 0, 0, game);
    game.heroes = [hero];
    const target = createEnemy(100, 0);
    target.isAlive = false;
    game.enemies = [target];
    const kit = hero.abilitySystem.arcaneStormKit;
    kit.update(9);
    kit.onAttack(target, hero.getEffectiveStats());
    assert.equal(kit.portal, null);
    assert.equal(hero.combatStats.abilityActivations, 0);
});

test('Thor no activa tormenta usando enemigos que no puede detectar', () => {
    const game = createGame();
    const hero = new Hero(createHeroConfig('thor'), 0, 0, game);
    game.heroes = [hero];
    const targets = [createEnemy(50, 0), createEnemy(80, 0), createEnemy(100, 0)];
    game.enemies = targets;
    targets[2].stealth = true;
    const kit = hero.abilitySystem.arcaneStormKit;
    kit.update(11);
    kit.onAttack(targets[0], hero.getEffectiveStats());
    assert.equal(hero.combatStats.abilityActivations, 0);
    assert.equal(targets[1].hp, 100);
});

test('indicadores ARC y redes siguen los umbrales de evolucion', () => {
    const game = createGame();
    const ironMan = new Hero(createHeroConfig('iron_man'), 0, 0, game);
    const spider = new Hero(createHeroConfig('spiderman'), 0, 0, game);
    ironMan.abilitySystem.arcCharge = 1;
    ironMan.abilitySystem.arcCooling = 0;
    assert.equal(ironMan.abilitySystem.getDisplayState().label, 'Carga ARC 1/3');
    assert.equal(spider.abilitySystem.getDisplayState().label, 'Redes 0/3');
    game.progression = { getHeroEvolution: (id) => ({ id: id === 'iron_man' ? 'iron_man_extremis' : 'iron_spider' }) };
    assert.deepEqual(ironMan.abilitySystem.getDisplayState(), { label: 'Carga ARC 1/2', progress: 0.5, ready: true });
    assert.equal(spider.abilitySystem.getDisplayState().label, 'Redes 0/2');
});

function createHeroConfig(id) {
    return {
        id,
        name: id,
        damage: 10,
        range: 200,
        fireRate: 1,
        category: id === 'iron_man' ? 'Tecnológico' : 'Místico',
        allowedTerrains: [1]
    };
}

function createEnemy(x, y) {
    const enemy = new Enemy({ id: 'target', hp: 100, speed: 100, category: 'Urbano' }, [
        { x, y },
        { x: x + 300, y }
    ]);
    enemy.x = x;
    enemy.y = y;
    return enemy;
}

function createGame() {
    return {
        heroes: [],
        enemies: [],
        projectiles: [],
        resourceManager: { lives: 20 },
        random: { next: () => 0.5 },
        vfx: { addBeam: () => {}, addBurst: () => {}, addLightning: () => {}, addRing: () => {} },
        audio: { play: () => {} },
        showHeroRanges: false
    };
}
