export function getRouteProgress(enemy) {
    const path = enemy?.path;
    if (!Array.isArray(path) || path.length < 2 || !Number.isFinite(enemy.distanceTravelled)) return 0;
    let length = 0;
    for (let i = 1; i < path.length; i++) length += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    return Number.isFinite(length) && length > 0 ? Math.max(0, Math.min(1, enemy.distanceTravelled / length)) : 0;
}

export function normalizePath(path, width, height, margin = 40) {
    if (!Array.isArray(path) || path.length < 2) {
        return createFallbackPath(width, height, margin);
    }

    const insidePoints = path.map((point) => ({
        x: clamp(Number(point.x), 0, width),
        y: clamp(Number(point.y), 0, height)
    }));

    const safePath = [outsidePoint(insidePoints[0], width, height, true, margin), insidePoints[0]];

    for (let i = 1; i < insidePoints.length; i++) {
        const previous = safePath[safePath.length - 1];
        const next = insidePoints[i];

        if (previous.x !== next.x && previous.y !== next.y) {
            safePath.push({ x: next.x, y: previous.y });
        }

        safePath.push(next);
    }

    safePath.push(outsidePoint(insidePoints[insidePoints.length - 1], width, height, false, margin));
    return removeDuplicatePoints(safePath);
}

export function normalizeLevelPath(level, width, height, margin = 40) {
    if (level?.rendering?.pathMode === 'exact') {
        return normalizeExactPath(level.path, width, height);
    }

    return normalizePath(level?.path, width, height, margin);
}

export function normalizeExactPath(path, width, height) {
    if (!Array.isArray(path) || path.length < 2) return createFallbackPath(width, height, 0);

    return removeDuplicatePoints(path.map((point) => ({
        x: clamp(Number(point.x), 0, width),
        y: clamp(Number(point.y), 0, height)
    })));
}

export function isOrthogonalPath(path) {
    if (!Array.isArray(path) || path.length < 2) return false;

    return path.every((point, index) => {
        if (index === 0) return Number.isFinite(point.x) && Number.isFinite(point.y);
        const previous = path[index - 1];
        return Number.isFinite(point.x)
            && Number.isFinite(point.y)
            && (previous.x === point.x || previous.y === point.y);
    });
}

export function removeDuplicatePoints(points) {
    return points.filter((point, index) => {
        const previous = points[index - 1];
        return !previous || previous.x !== point.x || previous.y !== point.y;
    });
}

export function getClosestPointOnPath(point, path) {
    if (!point || !Array.isArray(path) || path.length < 2) return null;

    let closest = null;
    let closestDistance = Infinity;
    for (let index = 0; index < path.length - 1; index++) {
        const candidate = getClosestPointOnSegment(point, path[index], path[index + 1]);
        const distance = Math.hypot(point.x - candidate.x, point.y - candidate.y);
        if (distance < closestDistance) {
            closest = candidate;
            closestDistance = distance;
        }
    }

    return closest ? { ...closest, distance: closestDistance } : null;
}

export function distanceToPath(point, path) {
    return getClosestPointOnPath(point, path)?.distance ?? Infinity;
}

function getClosestPointOnSegment(point, start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) return { x: start.x, y: start.y };

    const projection = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
    const t = clamp(projection, 0, 1);
    return { x: start.x + dx * t, y: start.y + dy * t };
}

function createFallbackPath(width, height, margin) {
    return [
        { x: -margin, y: 120 },
        { x: width * 0.35, y: 120 },
        { x: width * 0.35, y: height * 0.75 },
        { x: width * 0.72, y: height * 0.75 },
        { x: width * 0.72, y: height * 0.35 },
        { x: width + margin, y: height * 0.35 }
    ];
}

function outsidePoint(point, width, height, isStart, margin) {
    if (point.x <= 0) return { x: -margin, y: point.y };
    if (point.x >= width) return { x: width + margin, y: point.y };
    if (point.y <= 0) return { x: point.x, y: -margin };
    if (point.y >= height) return { x: point.x, y: height + margin };

    return isStart ? { x: -margin, y: point.y } : { x: width + margin, y: point.y };
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
