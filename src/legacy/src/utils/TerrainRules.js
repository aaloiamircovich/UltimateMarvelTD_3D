export const TERRAIN = {
    water: 0,
    grass: 1,
    buildable: 1,
    path: 2,
    street: 2,
    mountain: 3,
    forest: 4,
    park: 4,
    blocked: 5,
    sidewalk: 11,
    detail: 12
};

export const TERRAIN_LABELS = {
    [TERRAIN.water]: 'Agua',
    [TERRAIN.grass]: 'Pasto',
    [TERRAIN.path]: 'Camino',
    [TERRAIN.mountain]: 'Montaña',
    [TERRAIN.forest]: 'Bosque',
    [TERRAIN.blocked]: 'Bloqueado',
    [TERRAIN.sidewalk]: 'Vereda',
    [TERRAIN.detail]: 'Detalle urbano'
};

const PLACEMENT_ALIASES = {
    [TERRAIN.sidewalk]: TERRAIN.grass,
    [TERRAIN.detail]: TERRAIN.grass,
    [TERRAIN.forest]: TERRAIN.grass
};

export function getPlacementTerrain(terrainType) {
    return PLACEMENT_ALIASES[terrainType] ?? terrainType;
}

export function getTerrainLabel(terrainType) {
    return TERRAIN_LABELS[terrainType] || `Terreno ${terrainType}`;
}

export function getPlacementTerrainLabel(terrainType) {
    return getTerrainLabel(getPlacementTerrain(terrainType));
}

export function getAllowedTerrainLabels(allowedTerrains = [TERRAIN.grass]) {
    return [...new Set(allowedTerrains.map((terrain) => getTerrainLabel(terrain)))]
        .join(', ');
}

export function isBlockedPlacementTerrain(terrainType) {
    return terrainType === undefined
        || terrainType === TERRAIN.path
        || terrainType === TERRAIN.blocked;
}

export function canPlaceOnTerrain(heroConfig, terrainType) {
    if (isBlockedPlacementTerrain(terrainType)) return false;
    const allowedTerrains = heroConfig?.allowedTerrains || [TERRAIN.grass];
    return allowedTerrains.includes(getPlacementTerrain(terrainType));
}

export function getTerrainPlacementTone(terrainType) {
    const placementTerrain = getPlacementTerrain(terrainType);
    if (placementTerrain === TERRAIN.water) return '#22d3ee';
    if (placementTerrain === TERRAIN.mountain) return '#f4d35e';
    if (placementTerrain === TERRAIN.grass) return '#46d369';
    return '#94a3b8';
}
