export const MAX_TOTAL_COOLDOWN_REDUCTION = 0.35;

export function getSpecialCooldownReduction(hero) {
    return clampReduction(hero?.config?.special?.statModifiers?.cooldown, 0.5);
}

export function applyCooldownReductions(hero, base, levelReduction = 0) {
    const progression = hero?.game?.progression?.getHeroBonuses?.(hero.id);
    const synergy = hero?.game?.teamSynergy?.getAbilityModifiers?.(hero);
    const reductions = [
        clampReduction(levelReduction, 0.5),
        clampReduction(progression?.cooldown, 0.75),
        clampReduction(synergy?.cooldown, 0.75),
        getSpecialCooldownReduction(hero)
    ];
    const combinedReduction = 1 - reductions.reduce((factor, reduction) => factor * (1 - reduction), 1);
    return base * (1 - Math.min(MAX_TOTAL_COOLDOWN_REDUCTION, combinedReduction));
}

function clampReduction(value, max) {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(max, numeric));
}
