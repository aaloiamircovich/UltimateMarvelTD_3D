export const ITEM_SLOTS = ['weapon', 'armor', 'artifact'];

export const SLOT_LABELS = {
    weapon: 'Arma',
    armor: 'Armadura',
    artifact: 'Artefacto'
};

export const SET_BONUSES = {
    stark: { name: 'Stark', description: 'Tecnologia ofensiva y cadencia.', effects: { fireRatePct: 0.1 } },
    vibranium: { name: 'Vibranium', description: 'Dano estable y respuesta contra blindaje.', effects: { damagePct: 0.1 } },
    pym: { name: 'Pym', description: 'Cadencia, movilidad y trucos de posicion.', effects: { rangePct: 0.12 } },
    mystic: { name: 'Mistico', description: 'Estados, maldiciones y control arcano.', effects: { critChance: 5 } },
    symbiote: { name: 'Simbionte', description: 'Dano acumulativo y estados agresivos.', effects: { consecutiveDamagePct: 0.012 } },
    tactical: { name: 'Tactico', description: 'Deteccion, control y anti-blindaje.', effects: { damagePct: 0.06, rangePct: 0.06 } },
    street: { name: 'Callejero', description: 'Control barato, criticos y economia.', effects: { critChance: 3 } },
    cosmic: { name: 'Cosmico', description: 'Escalado de jefes, alcance y efectos masivos.', effects: { bossDamagePct: 0.08 } },
    asgard: { name: 'Asgardiano', description: 'Poder mitico y maldiciones peligrosas.', effects: { damageToCursedPct: 0.1 } }
};

const NON_SCALING = new Set(['chainCount']);
const MAXIMUM_EFFECTS = new Set(['chainRange', 'chainFactor', 'splashRadius', 'splashFactor']);

export function aggregateItemEffects(items = []) {
    const total = {};
    items.filter(Boolean).slice(0, 1).forEach((item) => mergeEffects(total, item.effects || {}, 1));
    return total;
}

export function getActiveSets(items = []) {
    return [];
}

function mergeEffects(target, effects, multiplier) {
    Object.entries(effects).forEach(([key, value]) => {
        if (typeof value === 'boolean') {
            target[key] = Boolean(target[key] || value);
            return;
        }
        if (!Number.isFinite(value)) return;
        const scaled = NON_SCALING.has(key) ? value : value * multiplier;
        if (MAXIMUM_EFFECTS.has(key)) target[key] = Math.max(target[key] || 0, scaled);
        else target[key] = (target[key] || 0) + scaled;
    });
}
