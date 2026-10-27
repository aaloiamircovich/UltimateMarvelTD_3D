export const RANGE_PATTERNS = new Set(['circle', 'cross', 'x', 'ring']);

export function normalizeRangePattern(value = 'circle') {
    return RANGE_PATTERNS.has(value) ? value : 'circle';
}

export function getHeroRangePattern(hero = {}) {
    return normalizeRangePattern(hero.rangePattern || hero.config?.rangePattern || hero.special?.rangePattern || hero.config?.special?.rangePattern);
}

export function isPointInRangePattern(origin = {}, point = {}, range = 0, pattern = 'circle', geometryScale = 1) {
    const dx = Number(point.x || 0) - Number(origin.x || 0);
    const dy = Number(point.y || 0) - Number(origin.y || 0);
    const distance = Math.hypot(dx, dy);
    const normalized = normalizeRangePattern(pattern);
    if (distance > range) return false;
    const geometryRange = range * geometryScale;

    if (normalized === 'ring') {
        const innerRadius = geometryRange * 0.38;
        return distance >= innerRadius;
    }

    if (normalized === 'cross') {
        const laneWidth = Math.max(18, geometryRange * 0.16);
        return Math.abs(dx) <= laneWidth || Math.abs(dy) <= laneWidth;
    }

    if (normalized === 'x') {
        const laneWidth = Math.max(18, geometryRange * 0.16);
        return Math.abs(Math.abs(dx) - Math.abs(dy)) <= laneWidth;
    }

    return true;
}

export function getRangePatternLabel(pattern = 'circle') {
    const labels = {
        circle: 'Circulo',
        cross: 'Cruz',
        x: 'X',
        ring: 'Anillo'
    };
    return labels[normalizeRangePattern(pattern)];
}
