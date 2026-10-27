export const CAMPAIGN_MAX_WAVES = 100;
export const MINI_BOSS_WAVE_INTERVAL = 25;
export const STARS_PER_LEVEL_UNLOCK = 25;

export function normalizeCampaignWave(wave = 1) {
    return Math.max(1, Math.floor(Number(wave) || 1));
}

export function isFinalBossWave(wave = 1, maxWaves = CAMPAIGN_MAX_WAVES) {
    return normalizeCampaignWave(wave) === Math.max(1, Math.floor(Number(maxWaves) || CAMPAIGN_MAX_WAVES));
}

export function isMiniBossWave(wave = 1, maxWaves = CAMPAIGN_MAX_WAVES) {
    const safeWave = normalizeCampaignWave(wave);
    return safeWave < Math.max(1, Math.floor(Number(maxWaves) || CAMPAIGN_MAX_WAVES))
        && safeWave % MINI_BOSS_WAVE_INTERVAL === 0;
}

export function isBossWave(wave = 1, maxWaves = CAMPAIGN_MAX_WAVES) {
    return isFinalBossWave(wave, maxWaves) || isMiniBossWave(wave, maxWaves);
}

export function getLevelUnlockRequirement(index = 0) {
    return Math.max(0, Number(index) || 0) * STARS_PER_LEVEL_UNLOCK;
}

export function isLevelUnlockedByStars(index = 0, stars = 0) {
    return Math.max(0, Number(stars) || 0) >= getLevelUnlockRequirement(index);
}

export function getFixedDifficultyKey(level = {}) {
    const difficulty = String(level.difficulty || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (difficulty.includes('facil')) return 'easy';
    if (difficulty.includes('normal') || difficulty.includes('media')) return 'normal';
    return 'hard';
}
