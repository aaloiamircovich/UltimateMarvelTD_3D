import { flattenEnemyDatabase } from './MasteryCodexSystem.js';

const ROLE_LABELS = {
    boss: 'Jefe',
    tank: 'Tanque',
    shield: 'Blindado',
    support: 'Soporte',
    stealth: 'Sigilo',
    phaser: 'Faseador',
    flying: 'Aereo',
    runner: 'Rapido',
    summoner: 'Invocador',
    commander: 'Comandante',
    bruiser: 'Bruto'
};

export function buildVillainCodexModel(enemyDatabase = {}, discoveredIds = []) {
    const discovered = new Set(discoveredIds || []);
    const enemies = Object.values(flattenEnemyDatabase(enemyDatabase))
        .filter((enemy) => enemy?.id)
        .sort((a, b) => Number(Boolean(b.isBoss)) - Number(Boolean(a.isBoss)) || (b.threat || 1) - (a.threat || 1) || a.name.localeCompare(b.name));

    return {
        total: enemies.length,
        discovered: enemies.filter((enemy) => discovered.has(enemy.id)).length,
        entries: enemies.map((enemy) => {
            const unlocked = discovered.has(enemy.id);
            return {
                id: enemy.id,
                unlocked,
                name: unlocked ? enemy.name : 'Registro bloqueado',
                category: unlocked ? enemy.category : 'Desconocido',
                faction: unlocked ? enemy.faction || 'Sin faccion' : 'Avistamiento pendiente',
                role: unlocked ? ROLE_LABELS[enemy.archetype] || (enemy.isBoss ? 'Jefe' : 'Tropa') : '???',
                threat: unlocked ? Math.max(1, Math.min(5, Math.round(enemy.threat || (enemy.isBoss ? 5 : 1)))) : 0,
                sprite: unlocked ? enemy.visual?.portrait || enemy.sprite : null,
                traits: unlocked ? buildEnemyTraits(enemy) : ['No avistado'],
                isBoss: Boolean(enemy.isBoss)
            };
        })
    };
}

function buildEnemyTraits(enemy = {}) {
    const traits = [];
    const add = (condition, label) => { if (condition) traits.push(label); };
    add(enemy.isFinalBoss, 'Jefe final');
    add(enemy.isBoss, 'Jefe');
    add(enemy.stealth || enemy.archetype === 'stealth', 'Sigilo');
    add(enemy.barrierRatio > 0, 'Barrera');
    add((enemy.armor || 0) >= 0.25 || ['tank', 'shield'].includes(enemy.archetype), 'Blindaje');
    add(enemy.archetype === 'support' || enemy.healPower > 0, 'Cura');
    add(enemy.archetype === 'summoner' || enemy.summonId, 'Invoca');
    add(enemy.archetype === 'commander' || enemy.auraPower, 'Aura');
    add(enemy.archetype === 'phaser', 'Fasea');
    add(enemy.archetype === 'flying' || enemy.flying, 'Aereo');
    add(enemy.archetype === 'runner' || Number(enemy.speed || 0) >= 85, 'Rapido');
    return traits.length ? traits : ['Amenaza base'];
}
