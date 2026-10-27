import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Enemy } from '../src/entities/Enemy.js';
import { Hero } from '../src/entities/Hero.js';
import { ProgressionManager } from '../src/systems/ProgressionManager.js';
import { ResourceManager } from '../src/systems/ResourceManager.js';
import { WaveManager } from '../src/systems/WaveManager.js';

const data = {
    heroes: readJson('../data/heroes.json'),
    enemies: readJson('../data/enemies.json'),
    items: readJson('../data/items.json'),
    levels: readJson('../data/levels.json')
};

test('flujo completo selecciona héroe, lo coloca, supera oleada y cobra recompensa', () => {
    const game = createGame();
    game.progression = new ProgressionManager(new MemoryStorage());
    game.progression.initialize(game, data);
    game.progression.startProfile('iron_man');

    const hero = data.heroes.iron_man;
    game.spawnHero(hero, 200, 220);
    assert.equal(game.heroes.length, 1);

    game.waveManager = new WaveManager(game, data.enemies);
    game.waveManager.startNextWave();
    let guard = 0;
    while (game.waveManager.currentWave === 1 && guard++ < 30) {
        game.waveManager.update(10);
        game.enemies.forEach((enemy) => game.resourceManager.addCredits(enemy.reward));
        game.enemies.length = 0;
    }

    assert.equal(game.waveManager.currentWave, 2);
    assert.deepEqual(game.completedWaves, [1]);
    assert.ok(game.resourceManager.credits > 650);
    assert.ok(game.progression.state.credits > 1200);
});

function createGame() {
    const game = {
        heroes: [], enemies: [], projectiles: [], completedWaves: [], stars: 0,
        path: [{ x: -40, y: 120 }, { x: 400, y: 120 }, { x: 840, y: 120 }],
        currentLevel: data.levels[0], difficulty: 'normal', isGameOver: false,
        audio: { setEnabled: () => {}, setBusVolume: () => {}, play: () => {} },
        uiManager: { renderWavePreview: () => {}, setNextWaveEnabled: () => {}, showToast: () => {} },
        missionSystem: { onWaveStart: () => {}, onWaveFinished: () => {} },
        pause: () => {},
        spawnEnemy(config) { const enemy = new Enemy(config, this.path, this); this.enemies.push(enemy); return enemy; },
        spawnHero(config, x, y) { const hero = new Hero(config, x, y, this); this.heroes.push(hero); return hero; }
    };
    game.resourceManager = new ResourceManager(game, 20, 650);
    return game;
}

function readJson(relativePath) {
    return JSON.parse(fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8'));
}

class MemoryStorage {
    constructor() { this.values = new Map(); }
    getItem(key) { return this.values.get(key) ?? null; }
    setItem(key, value) { this.values.set(key, String(value)); }
}
