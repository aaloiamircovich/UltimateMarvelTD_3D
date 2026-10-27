export const MASTERY_CHALLENGES = [
    { id: 'impacto', name: 'Impacto decisivo', description: 'Inflige 5.000 de dano en una mision.', test: (stats) => stats.damageDealt >= 5000 },
    { id: 'especialista', name: 'Especialista', description: 'Activa habilidades 5 veces en una mision.', test: (stats) => stats.abilityActivations >= 5 },
    { id: 'protector', name: 'Protector', description: 'Derrota 25 enemigos en una mision.', test: (stats) => stats.kills >= 25 }
];

export const CODEX_MECHANICS = ['colocacion', 'prioridades', 'sinergias', 'objetos', 'afijos', 'ramas', 'evoluciones', 'modos'];

export function completedMasteryChallenges(stats = {}) {
    return MASTERY_CHALLENGES.filter((challenge) => challenge.test(stats)).map((challenge) => challenge.id);
}

export function createCodexSnapshot(state, data) {
    const discovered = state.codexDiscovered;
    const enemies = flattenEnemyDatabase(data.enemies || {});
    const factionTotal = new Set(Object.values(enemies).map((enemy) => enemy.faction).filter(Boolean)).size;
    return {
        heroes: { found: discovered.heroes.length, total: Object.keys(data.heroes).length },
        enemies: { found: discovered.enemies.length, total: Object.keys(enemies).length },
        items: { found: discovered.items.length, total: Object.keys(data.items).length },
        factions: { found: discovered.factions.length, total: factionTotal },
        mechanics: { found: discovered.mechanics.length, total: CODEX_MECHANICS.length }
    };
}

export function flattenEnemyDatabase(enemies = {}) {
    if (enemies.normal || enemies.bosses) {
        return { ...(enemies.normal || {}), ...(enemies.bosses || {}) };
    }
    return enemies;
}
