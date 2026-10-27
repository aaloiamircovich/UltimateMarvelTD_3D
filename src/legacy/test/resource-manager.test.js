import test from 'node:test';
import assert from 'node:assert/strict';
import { ResourceManager } from '../src/systems/ResourceManager.js';

test('ResourceManager administra creditos sin permitir saldo negativo', () => {
    const resources = new ResourceManager({}, 20, 100);

    assert.equal(resources.removeCredits(80), true);
    assert.equal(resources.credits, 20);
    assert.equal(resources.removeCredits(25), false);
    assert.equal(resources.credits, 20);
    assert.equal(resources.removeCredits(-10), false);
    resources.addCredits(-50);
    assert.equal(resources.credits, 20);
});

test('ResourceManager conserva creditos infinitos en modo admin', () => {
    const resources = new ResourceManager(null, 20, 650);
    resources.setInfiniteCredits(true);

    assert.equal(resources.credits, Number.POSITIVE_INFINITY);
    assert.equal(resources.removeCredits(999999), true);
    resources.addCredits(50);
    assert.equal(resources.credits, Number.POSITIVE_INFINITY);
});

test('ResourceManager no expone curacion directa de base', () => {
    const resources = new ResourceManager({}, 20, 0);
    resources.removeLife(5);
    assert.equal(typeof resources.addLife, 'undefined');
    assert.equal(resources.lives, 15);
});

test('ResourceManager dispara gameOver una sola vez al llegar a cero', () => {
    let calls = 0;
    const resources = new ResourceManager({ gameOver: () => calls++ }, 2, 0);
    resources.removeLife(2);
    resources.removeLife(1);

    assert.equal(resources.lives, 0);
    assert.equal(calls, 1);
});
