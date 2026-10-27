import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { EncounterDirector, AFFIXES } from '../src/systems/EncounterDirector.js';
import { WaveManager } from '../src/systems/WaveManager.js';
import { Enemy } from '../src/entities/Enemy.js';

const database = JSON.parse(fs.readFileSync(new URL('../data/enemies.json', import.meta.url), 'utf8'));
const pool = ['hydra_soldier', 'aim_scientist', 'hand_ninja', 'doombot'].map((id) => database.normal[id]);

test('director repite la composición con la misma semilla de mapa y oleada', () => {
    const director = new EncounterDirector(createGame());
    const first = director.compose(pool, 8, 'bounty').map(signature);
    const second = director.compose(pool, 8, 'bounty').map(signature);
    assert.deepEqual(first, second);
});

test('rama de caza aumenta presupuesto y botín frente a contención', () => {
    const director = new EncounterDirector(createGame());
    const safe = director.compose(pool, 8, 'safe');
    const bounty = director.compose(pool, 8, 'bounty');
    assert.ok(totalThreat(bounty) > totalThreat(safe));
    assert.ok(bounty.reduce((sum, enemy) => sum + enemy.reward, 0) > safe.reduce((sum, enemy) => sum + enemy.reward, 0));
});

test('director elimina sigilo cuando el equipo no tiene detección', () => {
    const director = new EncounterDirector(createGame());
    const encounter = director.compose(pool, 7, 'safe', { detection: false, penetration: true });
    assert.ok(encounter.every((enemy) => !enemy.stealth && enemy.archetype !== 'stealth'));
});

test('quinta oleada intermedia incorpora elite con afijo sin tratarlo como mini boss', () => {
    const director = new EncounterDirector(createGame());
    const encounter = director.compose(pool, 5, 'safe');
    const elite = encounter.find((enemy) => enemy.isElite);
    assert.ok(elite);
    assert.equal(elite.isMiniBoss, undefined);
    assert.ok(elite.threat >= 4);
    assert.equal(elite.phases, undefined);
    assert.ok(AFFIXES.some((affix) => affix.id === elite.affix.id));
});

test('afijo regenerador recupera salud de forma limitada', () => {
    const game = createGame();
    const enemy = new Enemy({ ...database.normal.hydra_soldier, affix: { id: 'regenerator', label: 'Regenerador' } }, [{ x: 0, y: 0 }, { x: 400, y: 0 }], game);
    enemy.hp = enemy.maxHp / 2; const before = enemy.hp;
    enemy.update(1);
    assert.ok(enemy.hp > before);
    assert.ok(enemy.hp <= enemy.maxHp);
});

test('WaveManager permite elegir una rama antes de iniciar', () => {
    const game = createGame(); const manager = new WaveManager(game, database); game.waveManager = manager;
    manager.currentWave = 4; manager.prepareNextWave();
    const safeThreat = manager.preparedQueue.reduce((sum, entry) => sum + entry.config.threat, 0);
    assert.equal(manager.chooseBranch('bounty'), true);
    const bountyThreat = manager.preparedQueue.reduce((sum, entry) => sum + entry.config.threat, 0);
    assert.ok(bountyThreat > safeThreat);
});

function signature(enemy) { return `${enemy.id}:${enemy.affix?.id || '-'}`; }
function totalThreat(values) { return values.reduce((sum, enemy) => sum + (enemy.threat || 1), 0); }
function createGame() { return { currentLevel: { theme: { id: 'new-york' } }, difficulty: 'normal', heroes: [], activeTeam: [], uiManager: null, enemies: [], completedWaves: [], stars: 0, path: [{ x: 0, y: 0 }, { x: 400, y: 0 }], resourceManager: { addCredits: () => {} }, vfx: { addRing: () => {}, addBurst: () => {} }, pause: () => {} }; }
