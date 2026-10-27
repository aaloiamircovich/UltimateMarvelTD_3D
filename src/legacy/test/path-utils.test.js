import test from 'node:test';
import assert from 'node:assert/strict';
import { distanceToPath, getClosestPointOnPath, isOrthogonalPath, normalizeLevelPath, normalizePath, removeDuplicatePoints } from '../src/utils/PathUtils.js';

test('normalizePath crea entrada y salida fuera del mapa', () => {
    const result = normalizePath([
        { x: 0, y: 120 },
        { x: 300, y: 120 },
        { x: 300, y: 500 },
        { x: 800, y: 500 }
    ], 800, 600);

    assert.deepEqual(result[0], { x: -40, y: 120 });
    assert.deepEqual(result.at(-1), { x: 840, y: 500 });
    assert.equal(isOrthogonalPath(result), true);
});

test('normalizePath convierte segmentos diagonales en segmentos ortogonales', () => {
    const result = normalizePath([
        { x: 0, y: 100 },
        { x: 300, y: 300 },
        { x: 800, y: 500 }
    ], 800, 600);

    assert.equal(isOrthogonalPath(result), true);
    assert.ok(result.length > 5);
});

test('normalizePath respeta entradas y salidas verticales', () => {
    const result = normalizePath([
        { x: 400, y: 0 },
        { x: 400, y: 200 },
        { x: 700, y: 600 }
    ], 800, 600);

    assert.deepEqual(result[0], { x: 400, y: -40 });
    assert.deepEqual(result.at(-1), { x: 700, y: 640 });
    assert.equal(isOrthogonalPath(result), true);
});

test('normalizeLevelPath conserva rutas exactas de mapas manuales', () => {
    const level = {
        rendering: { pathMode: 'exact' },
        path: [
            { x: 80, y: 592 },
            { x: 80, y: 400 },
            { x: 368, y: 400 }
        ]
    };
    const result = normalizeLevelPath(level, 800, 600);

    assert.deepEqual(result, level.path);
    assert.equal(isOrthogonalPath(result), true);
});

test('removeDuplicatePoints elimina puntos consecutivos repetidos', () => {
    assert.deepEqual(removeDuplicatePoints([
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 40, y: 0 }
    ]), [
        { x: 0, y: 0 },
        { x: 40, y: 0 }
    ]);
});

test('distanceToPath mide la distancia al tramo mas cercano', () => {
    const path = [{ x: 0, y: 100 }, { x: 200, y: 100 }, { x: 200, y: 300 }];
    assert.equal(distanceToPath({ x: 80, y: 140 }, path), 40);
    assert.equal(distanceToPath({ x: 240, y: 220 }, path), 40);
});

test('getClosestPointOnPath limita la proyeccion a los extremos', () => {
    const closest = getClosestPointOnPath({ x: 260, y: 40 }, [{ x: 0, y: 100 }, { x: 200, y: 100 }]);
    assert.deepEqual(closest, { x: 200, y: 100, distance: Math.hypot(60, 60) });
});
