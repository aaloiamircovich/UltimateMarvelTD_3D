import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMPAIGN_MAX_WAVES, MINI_BOSS_WAVE_INTERVAL, getFixedDifficultyKey, getLevelUnlockRequirement, isBossWave, isFinalBossWave, isLevelUnlockedByStars, isMiniBossWave } from '../src/utils/LevelProgression.js';

test('Los mapas se desbloquean cada 25 estrellas en campana de 100 oleadas', () => {
    assert.equal(CAMPAIGN_MAX_WAVES, 100);
    assert.equal(getLevelUnlockRequirement(0), 0);
    assert.equal(getLevelUnlockRequirement(1), 25);
    assert.equal(getLevelUnlockRequirement(2), 50);
    assert.equal(isLevelUnlockedByStars(0, 0), true);
    assert.equal(isLevelUnlockedByStars(1, 24), false);
    assert.equal(isLevelUnlockedByStars(1, 25), true);
    assert.equal(isLevelUnlockedByStars(2, 49), false);
    assert.equal(isLevelUnlockedByStars(2, 50), true);
});

test('La dificultad de mapa es fija segun su configuracion', () => {
    assert.equal(getFixedDifficultyKey({ difficulty: 'Facil' }), 'easy');
    assert.equal(getFixedDifficultyKey({ difficulty: 'Normal' }), 'normal');
    assert.equal(getFixedDifficultyKey({ difficulty: 'Dificil' }), 'hard');
    assert.equal(getFixedDifficultyKey({ difficulty: 'Extrema' }), 'hard');
});

test('La campana reserva jefes solo para 25, 50, 75 y 100', () => {
    assert.equal(MINI_BOSS_WAVE_INTERVAL, 25);
    const waves = Array.from({ length: CAMPAIGN_MAX_WAVES }, (_item, index) => index + 1);

    assert.deepEqual(waves.filter((wave) => isMiniBossWave(wave)), [25, 50, 75]);
    assert.deepEqual(waves.filter((wave) => isBossWave(wave)), [25, 50, 75, 100]);
    assert.equal(isFinalBossWave(100), true);
    assert.equal(isMiniBossWave(100), false);
    assert.equal([10, 20, 30, 40, 60, 80, 90].some((wave) => isBossWave(wave)), false);
});
