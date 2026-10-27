export function getLineEndpoint(origin, target, length) {
    const dx = target.x - origin.x;
    const dy = target.y - origin.y;
    const magnitude = Math.hypot(dx, dy) || 1;
    return {
        x: origin.x + dx / magnitude * length,
        y: origin.y + dy / magnitude * length
    };
}

export function getLineTargets(origin, target, enemies = [], length, width) {
    const endpoint = getLineEndpoint(origin, target, length);
    return getLineTargetsToEndpoint(origin, endpoint, enemies, width);
}

export function getLineTargetsToEndpoint(origin, endpoint, enemies = [], width) {
    const vx = endpoint.x - origin.x;
    const vy = endpoint.y - origin.y;
    const lengthSquared = vx * vx + vy * vy || 1;

    return enemies.filter((enemy) => {
        if (!enemy.isAlive) return false;
        const projection = ((enemy.x - origin.x) * vx + (enemy.y - origin.y) * vy) / lengthSquared;
        if (projection < 0 || projection > 1) return false;
        const closestX = origin.x + projection * vx;
        const closestY = origin.y + projection * vy;
        return Math.hypot(enemy.x - closestX, enemy.y - closestY) <= width;
    });
}
