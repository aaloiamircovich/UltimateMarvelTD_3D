import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Enemy } from '../src/entities/Enemy.js';
import { Hero } from '../src/entities/Hero.js';
import { CombatSystem } from '../src/systems/CombatSystem.js';

const heroes = JSON.parse(fs.readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8'));
const items = JSON.parse(fs.readFileSync(new URL('../data/items.json', import.meta.url), 'utf8'));

test('Redwing MK II solo asiste a Falcon cuando ya evoluciono por nivel', () => {
    const target = createEnemy(80, 0);
    const projectiles = [];
    const lockedGame = createGame();
    const lockedFalcon = new Hero(heroes.falcon, 0, 0, lockedGame);
    lockedFalcon.items = [items.redwing_mk2];
    lockedGame.heroes = [lockedFalcon];
    lockedGame.enemies = [target];

    for (let index = 0; index < 4; index++) lockedFalcon.shoot(target, lockedFalcon.getEffectiveStats(), projectiles);
    assert.equal(projectiles.length, 4);

    const evolvedTarget = createEnemy(80, 0);
    const evolvedProjectiles = [];
    const evolvedGame = createGame({ evolvedIds: ['falcon'] });
    const evolvedFalcon = new Hero(heroes.falcon, 0, 0, evolvedGame);
    evolvedFalcon.items = [items.redwing_mk2];
    evolvedGame.heroes = [evolvedFalcon];
    evolvedGame.enemies = [evolvedTarget];

    for (let index = 0; index < 4; index++) evolvedFalcon.shoot(evolvedTarget, evolvedFalcon.getEffectiveStats(), evolvedProjectiles);
    assert.equal(evolvedProjectiles.length, 5);
});

test('Mjolnir mantiene a Captain America como aura pura sin ataque', () => {
    const game = createGame({
        evolutionOverrides: {
            capitan_america: { id: 'capitan_america_evolution', levelEvolved: true, allowsSupportAttack: true, stats: {} }
        }
    });
    const captain = new Hero(heroes.capitan_america, 0, 0, game);
    captain.items = [items.mjolnir];
    const target = createEnemy(100, 0);
    const projectiles = [];
    game.heroes = [captain];
    game.enemies = [target];

    assert.equal(captain.isSupportAuraOnly(), true);
    captain.update(2, [target], projectiles);

    assert.equal(projectiles.length, 0);
});

test('Capucha Infernal propaga una maldicion al matar', () => {
    const game = createGame({ evolvedIds: ['the_hood'] });
    const hood = new Hero(heroes.the_hood, 0, 0, game);
    hood.items = [items.capucha_infernal];
    const defeated = createEnemy(80, 0, { hp: 1 });
    const chained = createEnemy(105, 0, { hp: 300 });
    game.heroes = [hood];
    game.enemies = [defeated, chained];

    CombatSystem.applyDamage({ attackerType: hood.category, damage: 50, color: '#7f1d1d' }, defeated, hood, game.resourceManager, 1);

    assert.equal(defeated.isAlive, false);
    assert.ok(chained.hp < chained.maxHp);
    assert.ok(chained.debuffs.some((effect) => effect.type === 'curse'));
});

function createGame({ evolvedIds = [], evolutionOverrides = {} } = {}) {
    const evolved = new Set(evolvedIds);
    return {
        heroes: [],
        enemies: [],
        projectiles: [],
        resourceManager: { lives: 20, addCredits: () => {}, addLife: () => {} },
        progression: {
            getHeroBonuses: () => ({ damage: 0, fireRate: 0, range: 0, critChance: 0 }),
            getHeroEvolution(heroId) {
                if (evolutionOverrides[heroId]) return evolutionOverrides[heroId];
                if (!evolved.has(heroId)) return null;
                return { id: heroes[heroId].evolutionId, levelEvolved: true, stats: { damage: 0, fireRate: 0, range: 0, critChance: 0 } };
            }
        },
        random: { next: () => 0.99 },
        vfx: { addBeam: () => {}, addBurst: () => {}, addFloatingText: () => {}, addLightning: () => {}, addRing: () => {} },
        audio: { play: () => {} },
        showHeroRanges: false
    };
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
