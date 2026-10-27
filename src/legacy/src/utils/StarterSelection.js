import { normalizeRarity } from './Rarity.js';

export const RECOMMENDED_STARTER_IDS = ['black_widow', 'hawkeye', 'korg'];

function getStarterRole(hero = {}) {
    return hero.formationRole || hero.category || hero.tags?.[0] || 'flex';
}

function hasCombatVisual(hero = {}) {
    return Boolean(hero.visual || hero.sprite);
}

function isAuraOnly(hero = {}) {
    return Boolean(hero.supportAura || hero.special?.supportAura);
}

export function isStarterEligible(hero = {}) {
    return Boolean(hero?.id)
        && normalizeRarity(hero.rarity) === 'Common'
        && hasCombatVisual(hero)
        && !isAuraOnly(hero);
}

export function scoreStarterHero(hero = {}) {
    const metrics = hero.teamMetrics || {};
    const profile = hero.special?.projectileProfile || {};
    const damage = Number(hero.damage || 0);
    const fireRate = Number(hero.fireRate || 1);
    const range = Number(hero.range || 0);
    const cost = Number(hero.cost || 0);
    const dps = damage * fireRate;

    return Math.round(
        dps * 1.45
        + Math.min(235, range) * 0.18
        + Number(metrics.damage || 0) * 12
        + Number(metrics.control || 0) * 14
        + Number(metrics.detection || 0) * 8
        + (hero.canSeeStealth ? 18 : 0)
        + (profile.splashRadius ? 12 : 0)
        + (profile.armorPenetration ? 10 : 0)
        - cost * 0.03
    );
}

export function selectStarterHeroes(heroDatabase = {}, count = 3, preferredIds = RECOMMENDED_STARTER_IDS) {
    const heroes = Array.isArray(heroDatabase) ? heroDatabase : Object.values(heroDatabase || {});
    const eligible = heroes.filter(isStarterEligible);
    const selected = [];
    const selectedIds = new Set();

    const addHero = (hero) => {
        if (!hero || selectedIds.has(hero.id) || !isStarterEligible(hero)) return false;
        selected.push(hero);
        selectedIds.add(hero.id);
        return true;
    };

    preferredIds.forEach((id) => addHero(eligible.find((hero) => hero.id === id)));

    const remaining = eligible
        .filter((hero) => !selectedIds.has(hero.id))
        .sort((a, b) => scoreStarterHero(b) - scoreStarterHero(a));

    while (selected.length < count && remaining.length) {
        const selectedRoles = new Set(selected.map(getStarterRole));
        const diverseIndex = remaining.findIndex((hero) => !selectedRoles.has(getStarterRole(hero)));
        const index = diverseIndex >= 0 ? diverseIndex : 0;
        addHero(remaining.splice(index, 1)[0]);
    }

    return selected.slice(0, count);
}
