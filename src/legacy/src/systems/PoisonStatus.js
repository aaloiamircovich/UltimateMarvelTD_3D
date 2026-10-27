const MAX_STACKS = 12;
const TICK_INTERVAL = 0.5;
const EPSILON = 1e-10;

export function addPoisonStacks(status, effect, dot, source, duration, applyTick) {
    const requested = Number(effect.stacks ?? 1);
    if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(requested) || requested < 1) return false;
    const count = Math.min(MAX_STACKS, Math.floor(requested));
    let accepted = false;
    for (let index = 0; index < count; index++) {
        const layer = { type: 'poison', ...dot, power: effect.power, source, duration, tickTimer: 0, stacks: 1, explicitDamageBasis: true };
        if (status.applications.length < MAX_STACKS) {
            status.applications.push(layer);
            accepted = true;
            continue;
        }
        let weakestIndex = 0;
        status.applications.forEach((entry, slot) => {
            const weakest = status.applications[weakestIndex];
            if (entry.damagePerSecond < weakest.damagePerSecond || (entry.damagePerSecond === weakest.damagePerSecond && entry.duration < weakest.duration)) weakestIndex = slot;
        });
        const weakest = status.applications[weakestIndex];
        if (dot.damagePerSecond <= weakest.damagePerSecond) {
            // At the cap, equal or weaker hits can only refresh their own equivalent contribution.
            const matching = status.applications.filter((entry) => entry.source === source && entry.damagePerSecond === dot.damagePerSecond && entry.damageBasis === dot.damageBasis)
                .sort((a, b) => a.duration - b.duration)[0];
            if (matching) {
                matching.duration = Math.max(matching.duration, duration);
                accepted = true;
            }
            continue;
        }
        // Replacement ends the old contribution; settle only the time it actually lived.
        if (weakest.tickTimer > 0 && !applyTick(weakest, weakest.tickTimer)) {
            weakest.tickTimer = 0;
            syncSummary(status);
            return accepted;
        }
        status.applications[weakestIndex] = layer;
        accepted = true;
    }
    syncSummary(status);
    return accepted;
}

export function updatePoisonStacks(status, dt, applyTick) {
    let remaining = Math.max(0, dt);
    let alive = true;
    // Process events chronologically so a large frame cannot give a later tick the kill.
    while (remaining > EPSILON && status.applications.length && alive) {
        const step = Math.min(remaining, ...status.applications.map((entry) => Math.max(0, Math.min(entry.duration, TICK_INTERVAL - entry.tickTimer))));
        for (const entry of status.applications) {
            entry.duration -= step;
            entry.tickTimer += step;
        }
        remaining -= step;
        for (const entry of status.applications) {
            if (entry.tickTimer >= TICK_INTERVAL - EPSILON || entry.duration <= EPSILON) {
                if (entry.tickTimer > 0) alive = applyTick(entry, entry.tickTimer);
                entry.tickTimer = 0;
                if (!alive) break;
            }
        }
        status.applications = status.applications.filter((entry) => entry.duration > EPSILON);
    }
    syncSummary(status);
}

export function consumePoisonStacks(status, source, count, applyTick) {
    if (!Number.isInteger(count) || count <= 0 || count > MAX_STACKS) return 0;
    const selected = status.applications.filter(layer => layer.source === source && layer.duration > 0)
        .sort((a, b) => a.duration - b.duration).slice(0, count);
    if (selected.length !== count) return 0;
    status.applications = status.applications.filter(layer => !selected.includes(layer));
    syncSummary(status);
    // Settle elapsed poison before exchanging its remaining lifetime for the bite.
    for (const layer of selected) {
        if (layer.tickTimer > 0 && !applyTick(layer, layer.tickTimer)) break;
    }
    return count;
}

function syncSummary(status) {
    status.stacks = status.applications.length;
    status.duration = Math.max(0, ...status.applications.map((entry) => entry.duration));
    status.damagePerSecond = status.applications.reduce((sum, entry) => sum + entry.damagePerSecond, 0);
}
