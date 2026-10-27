export const HERO_MAX_LEVEL = 100;
export const HERO_LEVEL_COST_BASE = 180;
export const HERO_LEVEL_COST_GROWTH = 1.08;
export const HERO_POWER_SPIKE_LEVELS = [16, 36, 100];

const RARITY_DAMAGE_CAPS = {
    Common: 18,
    Rare: 21,
    Epic: 24,
    Legendary: 27,
    Mythic: 30,
    Secret: 33
};

const SUPPORT_AURA_SCALE_CAPS = {
    Common: 0.45,
    Rare: 0.55,
    Epic: 0.65,
    Legendary: 0.75,
    Mythic: 0.85,
    Secret: 0.95
};

const SUPPORT_AURA_RANGE_SCALE_CAPS = {
    Common: 0.06,
    Rare: 0.075,
    Epic: 0.09,
    Legendary: 0.105,
    Mythic: 0.12,
    Secret: 0.135
};

const HERO_DAMAGE_CURVE_ANCHORS = [
    [1, 1],
    [15, 2.8],
    [16, 3.4],
    [35, 6.1],
    [36, 7.4],
    [99, 0.97],
    [100, 1]
];

export function normalizeHeroLevel(level = 1) {
    return Math.max(1, Math.min(HERO_MAX_LEVEL, Math.floor(Number(level) || 1)));
}

export function getHeroLevelUpgradeSteps(currentLevel, amount = 1) {
    const level = normalizeHeroLevel(currentLevel);
    const requested = Math.max(1, Math.floor(Number(amount) || 1));
    return Math.max(0, Math.min(requested, HERO_MAX_LEVEL - level));
}

export function calculateHeroLevelCost(currentLevel, amount = 1) {
    const level = normalizeHeroLevel(currentLevel);
    const steps = getHeroLevelUpgradeSteps(level, amount);
    if (steps <= 0) return Infinity;

    let total = 0;
    for (let index = 0; index < steps; index++) {
        const rawCost = HERO_LEVEL_COST_BASE * Math.pow(HERO_LEVEL_COST_GROWTH, level + index - 1);
        total += Math.ceil(rawCost / 10) * 10;
    }
    return total;
}

export function normalizeHeroRarity(rarity = 'Common') {
    return RARITY_DAMAGE_CAPS[rarity] ? rarity : 'Common';
}

export function getHeroPowerSpikeStage(level = 1) {
    const normalized = normalizeHeroLevel(level);
    if (normalized >= HERO_POWER_SPIKE_LEVELS[2]) return 3;
    if (normalized >= HERO_POWER_SPIKE_LEVELS[1]) return 2;
    if (normalized >= HERO_POWER_SPIKE_LEVELS[0]) return 1;
    return 0;
}

export const getHeroEvolutionStage = getHeroPowerSpikeStage;

export function getHeroLevelDamageMultiplier(level = 1, rarity = 'Common') {
    const normalized = normalizeHeroLevel(level);
    const cap = RARITY_DAMAGE_CAPS[normalizeHeroRarity(rarity)];
    const anchors = HERO_DAMAGE_CURVE_ANCHORS.map(([anchorLevel, value]) => [
        anchorLevel,
        anchorLevel >= 99 ? cap * value : value
    ]);

    for (let index = 1; index < anchors.length; index++) {
        const [previousLevel, previousValue] = anchors[index - 1];
        const [nextLevel, nextValue] = anchors[index];
        if (normalized > nextLevel) continue;
        const span = Math.max(1, nextLevel - previousLevel);
        const progress = (normalized - previousLevel) / span;
        return previousValue + (nextValue - previousValue) * progress;
    }

    return cap;
}

export function getHeroDamageAtLevel(baseDamage, level = 1, rarity = 'Common') {
    return Math.floor(Number(baseDamage || 0) * getHeroLevelDamageMultiplier(level, rarity));
}

export function getSupportAuraLevelScale(level = 1, rarity = 'Common') {
    const cap = SUPPORT_AURA_SCALE_CAPS[normalizeHeroRarity(rarity)];
    return 1 + Math.min(cap, (normalizeHeroLevel(level) - 1) * (cap / (HERO_MAX_LEVEL - 1)));
}

export function getSupportAuraRangeScale(level = 1, rarity = 'Common') {
    const cap = SUPPORT_AURA_RANGE_SCALE_CAPS[normalizeHeroRarity(rarity)];
    return 1 + Math.min(cap, (normalizeHeroLevel(level) - 1) * (cap / (HERO_MAX_LEVEL - 1)));
}

export function getScaledSupportAura(aura = null, level = 1, rarity = 'Common') {
    if (!aura?.type) return null;
    const scaled = {
        ...aura,
        power: Number(aura.power || 0) * getSupportAuraLevelScale(level, rarity)
    };
    if (Number.isFinite(Number(aura.range))) {
        scaled.range = Number(aura.range) * getSupportAuraRangeScale(level, rarity);
    }
    return scaled;
}
