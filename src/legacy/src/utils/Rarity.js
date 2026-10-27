export const HERO_RARITIES = ['Common', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Secret'];

export function normalizeRarity(value = 'Common') {
    return HERO_RARITIES.includes(value) ? value : 'Common';
}

export function getRarityClass(value = 'Common') {
    return `rarity-${normalizeRarity(value).toLowerCase()}`;
}
