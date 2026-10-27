export const DOT_TYPES = new Set(['burn', 'bleed', 'poison', 'curse']);
export const DAMAGE_BASES = new Set(['flat', 'attackDamage', 'maxHealth']);

export function resolveStatusDamage(effect, target, source) {
    const basis = effect.damageBasis || (['poison', 'curse'].includes(effect.type) ? 'maxHealth' : 'flat');
    if (!DAMAGE_BASES.has(basis)) return null;
    const power = Number(effect.power ?? 0.5);
    const base = basis === 'maxHealth' ? Number(target.maxHp)
        : basis === 'attackDamage' ? Number(effect.attackDamageSnapshot ?? source?.getEffectiveStats?.()?.damage ?? source?.damage ?? 0)
            : 1;
    if (!Number.isFinite(power) || power < 0 || !Number.isFinite(base) || base < 0) return null;
    const damagePerSecond = base * power;
    if (!Number.isFinite(damagePerSecond)) return null;
    return { damageBasis: basis, damagePerSecond };
}
