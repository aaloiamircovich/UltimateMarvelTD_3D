import test from 'node:test';
import assert from 'node:assert/strict';
import { completedMasteryChallenges, createCodexSnapshot, flattenEnemyDatabase } from '../src/systems/MasteryCodexSystem.js';

test('maestria se completa por desafios de una mision y no por experiencia', () => {
    assert.deepEqual(completedMasteryChallenges({ damageDealt: 6000, abilityActivations: 5, kills: 12 }).sort(), ['especialista', 'impacto']);
    assert.deepEqual(completedMasteryChallenges({ damageDealt: 10, abilityActivations: 0, kills: 0 }), []);
});

test('codice informa descubrimientos separados por categoria', () => {
    const state = { codexDiscovered: { heroes: ['hero'], enemies: ['enemy'], items: [], factions: ['Hydra'], mechanics: ['colocacion'] } };
    const data = { heroes: { hero: {} }, enemies: { enemy: { faction: 'Hydra' }, other: { faction: 'Kree' } }, items: { item: {} } };
    const snapshot = createCodexSnapshot(state, data);
    assert.deepEqual(snapshot.enemies, { found: 1, total: 2 });
    assert.deepEqual(snapshot.factions, { found: 1, total: 2 });
});

test('codice cuenta enemigos agrupados por normal y bosses', () => {
    const state = { codexDiscovered: { heroes: [], enemies: ['hydra_soldier'], items: [], factions: ['Hydra'], mechanics: [] } };
    const data = {
        heroes: {},
        enemies: {
            normal: { hydra_soldier: { faction: 'Hydra' } },
            bosses: { loki: { faction: 'Asgard' } }
        },
        items: {}
    };
    const snapshot = createCodexSnapshot(state, data);

    assert.equal(Object.keys(flattenEnemyDatabase(data.enemies)).length, 2);
    assert.deepEqual(snapshot.enemies, { found: 1, total: 2 });
    assert.deepEqual(snapshot.factions, { found: 1, total: 2 });
});
