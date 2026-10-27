import test from 'node:test';
import assert from 'node:assert/strict';
import { getLineEndpoint, getLineTargets } from '../src/utils/LineTargeting.js';

test('getLineEndpoint extiende la linea hasta la longitud indicada', () => {
    const endpoint = getLineEndpoint({ x: 0, y: 0 }, { x: 3, y: 4 }, 10);

    assert.equal(endpoint.x, 6);
    assert.equal(endpoint.y, 8);
});

test('getLineTargets filtra enemigos vivos, alineados y dentro del ancho', () => {
    const origin = { x: 0, y: 0 };
    const target = { x: 100, y: 0 };
    const aligned = { x: 70, y: 10, isAlive: true };
    const outside = { x: 70, y: 35, isAlive: true };
    const behind = { x: -10, y: 0, isAlive: true };
    const dead = { x: 80, y: 0, isAlive: false };

    const result = getLineTargets(origin, target, [aligned, outside, behind, dead], 120, 20);

    assert.deepEqual(result, [aligned]);
});

test('getLineTargets evita NaN si origen y objetivo coinciden', () => {
    const origin = { x: 10, y: 10 };
    const target = { x: 10, y: 10 };
    const enemy = { x: 10, y: 10, isAlive: true };

    const result = getLineTargets(origin, target, [enemy], 120, 20);

    assert.deepEqual(result, [enemy]);
});
