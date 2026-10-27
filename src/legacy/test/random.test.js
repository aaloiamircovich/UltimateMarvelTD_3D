import test from 'node:test';
import assert from 'node:assert/strict';
import { RandomSource } from '../src/utils/Random.js';

test('RandomSource repite una secuencia con la misma semilla', () => {
    const first = new RandomSource('avengers-initiative');
    const second = new RandomSource('avengers-initiative');

    const firstSequence = Array.from({ length: 6 }, () => first.next());
    const secondSequence = Array.from({ length: 6 }, () => second.next());

    assert.deepEqual(firstSequence, secondSequence);
    assert.ok(firstSequence.every((value) => value >= 0 && value < 1));
});

test('RandomSource puede reiniciar su secuencia', () => {
    const random = new RandomSource(42);
    const first = random.next();
    random.next();
    random.reset();
    assert.equal(random.next(), first);
});
