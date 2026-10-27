import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MissionSystem } from '../src/systems/MissionSystem.js';
import { isOrthogonalPath, normalizeLevelPath } from '../src/utils/PathUtils.js';

const levels = JSON.parse(fs.readFileSync(new URL('../data/levels.json', import.meta.url), 'utf8'));

test('Manhattan ya no activa evacuacion civil ni barricada', () => {
    const game = createGame();
    const mission = new MissionSystem(game);
    mission.loadLevel(levels[1]);
    mission.onWaveStart(3);
    mission.onWaveFinished(3);

    assert.equal(levels[1].mission.mechanic.type, 'urban_assault');
    assert.equal('civiliansSaved' in mission.state.metrics, false);
    assert.equal('civilianActive' in mission.state, false);
    assert.equal(mission.state.metrics.wavesCleared, 1);
});

test('Manhattan no dibuja tokens CIV ni BARRICADA en el campo', () => {
    const labels = [];
    const mission = new MissionSystem(createGame());
    mission.loadLevel(levels[1]);
    mission.onWaveStart(3);
    mission.update(1);
    mission.render(createCanvasContext(labels));

    assert.equal(labels.includes('CIV'), false);
    assert.equal(labels.includes('BARRICADA'), false);
});

test('Base Avengers ya no usa puerta ni auxiliar', () => {
    const game = createGame();
    const labels = [];
    const mission = new MissionSystem(game);
    mission.loadLevel(levels[0]);
    mission.onWaveStart(1);
    mission.update(0.1);
    mission.render(createCanvasContext(labels));

    assert.equal(levels[0].mission.mechanic.type, 'base_assault');
    assert.equal(labels.includes('PUERTA'), false);
    assert.equal(labels.includes('AUX'), false);
    assert.equal(mission.state.metrics.mechanicUses, 0);
});

test('Wakanda usa ruta manual exacta sin red cinetica anterior', () => {
    const game = createGame();
    game.path = normalizeLevelPath(levels[2], game.canvas.width, game.canvas.height);
    const mission = new MissionSystem(game);
    mission.loadLevel(levels[2]);
    mission.onWaveStart(2);

    assert.equal(levels[2].mission.mechanic.type, 'manual_assault');
    assert.equal(isOrthogonalPath(game.path), true);
    assert.deepEqual(game.path[0], levels[2].path[0]);
    assert.deepEqual(game.path.slice(3, 5), [{ x: 720, y: 80 }, { x: 368, y: 80 }]);
    assert.deepEqual(game.path.at(-1), levels[2].path.at(-1));
    assert.equal(game.mapRegenerations, 0);
    assert.equal(mission.handleLeak({ name: 'Outrider' }), false);
    assert.equal('shieldCharges' in mission.state, false);
    assert.equal(mission.state.metrics.leaks, 1);
});

test('Las runas del Sanctum marcan enemigos dentro de su zona', () => {
    const game = createGame();
    const statuses = [];
    game.enemies = [{ uid: 'elfo', x: 240, y: 320, isAlive: true, applyStatus: (status) => statuses.push(status) }];
    const mission = new MissionSystem(game);
    mission.loadLevel(levels[3]);
    mission.update(0.1);

    assert.ok(statuses.some((status) => status.type === 'mark' && status.power === 0.12));
});

test('Knowhere no entrega creditos automaticos por carga retirada', () => {
    const game = createGame();
    game.resourceManager.credits = 0;
    game.resourceManager.addCredits = (amount) => { game.resourceManager.credits += amount; };
    const mission = new MissionSystem(game);
    mission.loadLevel(levels[5]);
    for (let index = 0; index < 8; index++) mission.onEnemyDefeated({ isBoss: false });

    assert.equal(levels[5].mission.mechanic.type, 'cosmic_route');
    assert.equal(game.resourceManager.credits, 0);
    assert.equal(mission.state.metrics.mechanicUses, 0);
});

function createGame() {
    return {
        canvas: { width: 800, height: 600 },
        gridSize: 40,
        path: [],
        enemies: [],
        mapRegenerations: 0,
        generateLevelMap() { this.mapRegenerations++; },
        resourceManager: { lives: 20 },
        progression: {
            getMapProgress: () => ({ missionObjectives: [] }),
            completeMissionObjective: () => true
        },
        uiManager: { updateMissionStatus: () => {}, showToast: () => {} },
        vfx: null
    };
}

function createCanvasContext(labels) {
    return {
        save() {},
        restore() {},
        beginPath() {},
        arc() {},
        fill() {},
        stroke() {},
        fillText(label) { labels.push(label); },
        set fillStyle(value) {},
        set strokeStyle(value) {},
        set lineWidth(value) {},
        set textAlign(value) {},
        set textBaseline(value) {},
        set font(value) {}
    };
}
