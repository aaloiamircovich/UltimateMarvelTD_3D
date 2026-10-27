import test from 'node:test';
import assert from 'node:assert/strict';
import { ReplaySystem } from '../src/systems/ReplaySystem.js';

test('replay conserva semilla y decisiones tacticas', () => {
    const game = { waveManager: { currentWave: 4 } };
    const replay = new ReplaySystem(game);
    replay.reset('daily:2026-06-23', 'level_2', 'daily');
    replay.record('branch', { branchId: 'bounty' });
    const imported = new ReplaySystem(game);
    assert.equal(imported.importReplay(replay.exportReplay()).ok, true);
    assert.equal(imported.replay.seed, 'daily:2026-06-23');
    assert.deepEqual(imported.replay.actions[0], { wave: 4, type: 'branch', payload: { branchId: 'bounty' } });
});

test('replay rechaza estructuras desconocidas', () => {
    assert.equal(new ReplaySystem({}).importReplay('{"seed":"x"}').ok, false);
});

test('replay compacto conserva resumen y codigo de build', () => {
    const game = {
        waveManager: { currentWave: 7 },
        progression: {
            state: {
                lastMissionSummary: {
                    result: 'victory',
                    mode: 'campaign',
                    map: 'Manhattan',
                    wave: 7,
                    lives: 18,
                    bestHero: 'Storm',
                    totals: { kills: 42 },
                    tactical: { tacticalScore: 1234 },
                    recordedAt: '2026-07-13T12:00:00.000Z'
                }
            },
            exportBuildCode: () => 'BUILD-CODE'
        }
    };
    const replay = new ReplaySystem(game);
    replay.reset('campaign:level_1', 'level_1', 'campaign');
    replay.record('deploy', { heroId: 'storm', x: 128, y: 256 });

    const code = replay.exportReplayCode();
    assert.ok(!code.includes('{'));

    const imported = new ReplaySystem({ waveManager: { currentWave: 1 } });
    const result = imported.importReplayCode(code);

    assert.equal(result.ok, true);
    assert.equal(result.buildCode, 'BUILD-CODE');
    assert.equal(result.summary.bestHero, 'Storm');
    assert.equal(result.summary.kills, 42);
    assert.deepEqual(imported.replay.actions[0].payload, { heroId: 'storm', x: 128, y: 256 });
});

test('replay compacto rechaza codigos ajenos', () => {
    assert.equal(new ReplaySystem({}).importReplayCode('no-es-un-replay').ok, false);
});
