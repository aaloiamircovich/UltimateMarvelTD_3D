import test from 'node:test';
import assert from 'node:assert/strict';
import { SpriteAnimator, collectVisualSources, directionFromVector } from '../src/rendering/SpriteAnimator.js';

test('directionFromVector resuelve las ocho direcciones', () => {
    assert.equal(directionFromVector(1, 0), 'east');
    assert.equal(directionFromVector(1, 1), 'south-east');
    assert.equal(directionFromVector(0, 1), 'south');
    assert.equal(directionFromVector(-1, 1), 'south-west');
    assert.equal(directionFromVector(-1, 0), 'west');
    assert.equal(directionFromVector(-1, -1), 'north-west');
    assert.equal(directionFromVector(0, -1), 'north');
    assert.equal(directionFromVector(1, -1), 'north-east');
});

test('SpriteAnimator reproduce ataque y vuelve a idle', () => {
    const animator = new SpriteAnimator({
        idle: { south: 'idle.png' },
        attack: { fps: 10, loop: false, frames: ['a.png', 'b.png', 'c.png'] }
    });

    animator.playAttack();
    assert.equal(animator.getCurrentSource(), 'a.png');
    animator.update(0.11);
    assert.equal(animator.getCurrentSource(), 'b.png');
    animator.update(0.21);
    assert.equal(animator.state, 'idle');
    assert.equal(animator.getCurrentSource(), 'idle.png');
});

test('SpriteAnimator conserva direccion ante vector nulo', () => {
    const animator = new SpriteAnimator({ defaultDirection: 'west', idle: { west: 'west.png' } });
    animator.faceVector(0, 0);
    assert.equal(animator.facing, 'west');
});

test('collectVisualSources devuelve fuentes unicas utilizables por precarga', () => {
    const sources = collectVisualSources({
        portrait: 'portrait.png',
        idle: { south: 'idle.png' },
        attack: { frames: ['a.png', 'b.png'] }
    });

    assert.deepEqual(sources, ['portrait.png', 'idle.png', 'a.png', 'b.png']);
});

test('SpriteAnimator reproduce caminata y ataque direccional', () => {
    const animator = new SpriteAnimator({
        defaultDirection: 'south',
        idle: { south: 'idle-south.png', east: 'idle-east.png' },
        walk: { fps: 4, frames: { south: ['walk-s-0.png', 'walk-s-1.png'], east: ['walk-e-0.png', 'walk-e-1.png'] } },
        attack: { fps: 10, loop: false, frames: { south: ['atk-s-0.png', 'atk-s-1.png'], east: ['atk-e-0.png', 'atk-e-1.png'] } }
    });

    animator.faceVector(1, 0);
    animator.setMoving(true);
    assert.equal(animator.getCurrentSource(), 'walk-e-0.png');
    animator.update(0.26);
    assert.equal(animator.getCurrentSource(), 'walk-e-1.png');
    animator.playAttack();
    assert.equal(animator.getCurrentSource(), 'atk-e-0.png');
    animator.update(0.21);
    assert.equal(animator.state, 'walk');
    assert.equal(animator.getCurrentSource(), 'walk-e-0.png');
});

test('collectVisualSources incluye caminata y ataques direccionales', () => {
    const sources = collectVisualSources({
        portrait: 'portrait.png',
        idle: { south: 'idle.png' },
        walk: { frames: { south: ['w0.png', 'w1.png'] } },
        attack: { frames: { south: ['a0.png', 'a1.png'] } }
    });

    assert.deepEqual(sources, ['portrait.png', 'idle.png', 'w0.png', 'w1.png', 'a0.png', 'a1.png']);
});
