import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateItemEffects, getActiveSets } from '../src/systems/ItemEffectSystem.js';

test('un solo objeto no activa bonus de set', () => {
    const items = [
        { set: 'stark', effects: { fireRatePct: 0.25 } },
        { set: 'stark', effects: { rangePct: 0.05 } }
    ];
    const effects = aggregateItemEffects(items);

    assert.equal(getActiveSets(items).length, 0);
    assert.equal(effects.fireRatePct, 0.25);
    assert.equal(effects.rangePct, undefined);
});

test('metadata obsoleta de forja no escala efectos numericos', () => {
    const effects = aggregateItemEffects([{ effects: { damagePct: 0.1 }, forgeLevel: 3 }]);
    assert.ok(Math.abs(effects.damagePct - 0.1) < 1e-9);
});

test('efectos booleanos y perfiles de proyectil se combinan de forma segura', () => {
    const effects = aggregateItemEffects([
        { effects: { detectStealth: true, chainCount: 1, chainRange: 90 } },
        { effects: { chainCount: 1, chainRange: 120 } }
    ]);
    assert.equal(effects.detectStealth, true);
    assert.equal(effects.chainCount, 1);
    assert.equal(effects.chainRange, 90);
});
