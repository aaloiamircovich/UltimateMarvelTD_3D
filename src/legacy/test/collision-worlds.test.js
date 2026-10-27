import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MissionSystem } from '../src/systems/MissionSystem.js';
import { WaveManager } from '../src/systems/WaveManager.js';
import { isOrthogonalPath } from '../src/utils/PathUtils.js';

const levels = JSON.parse(fs.readFileSync(new URL('../data/levels.json', import.meta.url), 'utf8'));
const enemies = JSON.parse(fs.readFileSync(new URL('../data/enemies.json', import.meta.url), 'utf8'));

test('los cuatro mundos nuevos conservan rutas ortogonales', () => {
    assert.equal(levels.length, 11);
    for (const level of levels.slice(7)) {
        assert.equal(isOrthogonalPath(level.path), true, level.name);
        assert.ok((level.alternatePaths || []).every(isOrthogonalPath), level.name);
    }
});

test('Asgard alterna entrada y el Bifrost avanza sobre la ruta', () => {
    const game = createGame(); let advanced = 0;
    game.enemies = [{ uid: 'elf', x: 240, y: 160, isAlive: true, moveForward(distance) { advanced += distance; } }];
    const mission = new MissionSystem(game); mission.loadLevel(levels[7]); mission.onWaveStart(2); mission.update(0.1);
    assert.equal(isOrthogonalPath(game.path), true);
    assert.equal(advanced, 145);
    assert.equal(mission.state.metrics.mechanicUses, 1);
});

test('Dimensión Oscura alterna ralentización y aceleración', () => {
    const game = createGame(); const statuses = [];
    game.enemies = [{ uid: 'zealot', x: 220, y: 300, isAlive: true, applyStatus: (effect) => statuses.push(effect.type) }];
    const mission = new MissionSystem(game); mission.loadLevel(levels[8]); mission.onWaveStart(1);
    mission.update(0.1); mission.update(6.1);
    assert.ok(statuses.includes('slow'));
    assert.ok(statuses.includes('haste'));
    assert.equal(mission.state.metrics.mechanicUses, 1);
});

test('Savage Land consume vegetación y revela rutas por tandas', () => {
    const game = createGame(); const statuses = [];
    game.enemies = [{ uid: 'raptor', x: 200, y: 180, isAlive: true, applyStatus: (effect) => statuses.push(effect.type) }];
    const mission = new MissionSystem(game); mission.loadLevel(levels[9]); mission.onWaveStart(4); mission.update(0.1);
    assert.equal(isOrthogonalPath(game.path), true);
    assert.equal(mission.state.vegetation, 4);
    assert.deepEqual(statuses, ['slow']);
});

test('The Raft libera mini-jefe en el segmento del enemigo dañado', () => {
    const game = createGame(); const spawned = [];
    const source = { uid: 'escapee', x: 200, y: 180, hp: 50, maxHp: 100, isAlive: true };
    game.enemies = [source]; game.spawnEnemy = (config, origin) => spawned.push({ config, origin });
    const mission = new MissionSystem(game); mission.loadLevel(levels[10]); mission.onWaveStart(1); mission.update(0.1); mission.update(0.1);
    assert.equal(spawned.length, 1);
    assert.equal(spawned[0].config.id, 'raft_abomination');
    assert.equal(spawned[0].origin, source);
});

test('cada mundo nuevo usa facción y jefe propios', () => {
    const expected = [
        ['asgard', 'Elfos Oscuros / Gigantes', 'malekith'],
        ['dark-dimension', 'Dimensión Oscura / Zealots', 'baron_mordo'],
        ['savage-land', 'Bestias / Mutados', 'sauron'],
        ['the-raft', 'Prisioneros / Saboteadores', 'abomination']
    ];
    for (const [theme, label, boss] of expected) {
        const manager = new WaveManager(createWaveGame(theme), enemies);
        manager.currentWave = 25; manager.prepareNextWave();
        assert.equal(manager.faction.label, label);
        assert.equal(manager.preparedQueue[0].config.id, boss);
    }
});

function createGame() {
    return { canvas: { width: 800, height: 600 }, gridSize: 40, path: [], enemies: [], generateLevelMap: () => {}, resourceManager: { lives: 20 }, progression: { getMapProgress: () => ({ missionObjectives: [] }), completeMissionObjective: () => true }, uiManager: { updateMissionStatus: () => {}, showToast: () => {} }, vfx: { addRing: () => {} }, audio: { play: () => {} } };
}
function createWaveGame(theme) {
    return { uiManager: null, heroes: [], enemies: [], completedWaves: [], stars: 0, path: [{ x: 0, y: 0 }, { x: 40, y: 0 }], currentLevel: { theme: { id: theme } }, resourceManager: { addCredits: () => {} }, pause: () => {} };
}
