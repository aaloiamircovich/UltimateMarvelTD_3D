import { RandomSource } from '../utils/Random.js';
import { isBossWave } from '../utils/LevelProgression.js';

const AFFIXES = [
    { id: 'regenerator', label: 'Regenerador' },
    { id: 'reflector', label: 'Reflector' },
    { id: 'commander', label: 'Comandante' },
    { id: 'unstable', label: 'Inestable' },
    { id: 'hunter', label: 'Cazador' }
];

export class EncounterDirector {
    constructor(game) {
        this.game = game;
    }

    getBranchOptions(wave) {
        if (wave < 4 || wave % 4 !== 0 || isBossWave(wave)) return [];
        return [
            { id: 'safe', label: 'Contención', description: 'Menos amenaza, botín normal.', threatFactor: 0.88, rewardFactor: 1 },
            { id: 'bounty', label: 'Cazar élite', description: '+30% amenaza y +25% botín.', threatFactor: 1.3, rewardFactor: 1.25 }
        ];
    }

    compose(pool, wave, branchId = 'safe', capabilities = {}) {
        const branch = this.getBranchOptions(wave).find((option) => option.id === branchId) || { threatFactor: 1, rewardFactor: 1 };
        const candidates = this.filterCounters(pool, capabilities);
        const random = new RandomSource(`${this.game.modeSystem?.getSeed?.() || 'campaign'}:${this.game.currentLevel?.theme?.id || 'new-york'}:${wave}:${branchId}`);
        let budget = Math.round((8 + wave * 1.15) * branch.threatFactor);
        const result = [];
        let index = 0;

        while (budget > 0 && result.length < 36) {
            const affordable = candidates.filter((enemy) => (enemy.threat || 1) <= budget);
            const selected = random.pick(affordable.length ? affordable : candidates);
            if (!selected) break;
            let config = { ...selected, reward: Math.round((selected.reward || 10) * branch.rewardFactor) };
            if (wave >= 5 && (index + wave) % (branchId === 'bounty' ? 3 : 5) === 0) config = this.applyAffix(config, random.pick(AFFIXES));
            result.push(config);
            budget -= selected.threat || 1;
            index++;
        }

        if (wave % 5 === 0 && !isBossWave(wave) && result.length) {
            const base = [...candidates].sort((a, b) => (b.threat || 1) - (a.threat || 1))[0];
            result.push(this.createElite(base, random.pick(AFFIXES), branch.rewardFactor));
        }
        return result;
    }

    filterCounters(pool, capabilities) {
        let filtered = [...pool];
        if (capabilities.detection === false) filtered = filtered.filter((enemy) => !enemy.stealth && enemy.archetype !== 'stealth' && enemy.archetype !== 'phaser');
        if (capabilities.penetration === false) {
            const unarmored = filtered.filter((enemy) => !['shield', 'tank'].includes(enemy.archetype) && (enemy.armor || 0) < 0.3);
            if (unarmored.length) filtered = unarmored;
        }
        return filtered.length ? filtered : pool.slice(0, 1);
    }

    sanitizeModifier(modifier, capabilities) {
        if (modifier.id === 'covert' && capabilities.detection === false) {
            return { id: 'standard', label: 'Patrulla adaptada', description: 'Amenaza ajustada a las respuestas disponibles.' };
        }
        return modifier;
    }

    applyAffix(config, affix) {
        const next = { ...config, affix, threat: Math.min(5, (config.threat || 1) + 1), reward: Math.round((config.reward || 10) * 1.35) };
        if (affix.id === 'reflector') next.barrierRatio = Math.max(next.barrierRatio || 0, 0.2);
        if (affix.id === 'commander') next.commandPower = 0.18;
        if (affix.id === 'hunter') { next.stealth = true; next.speed = Math.round(next.speed * 1.12); }
        return next;
    }

    createMiniBoss(config, affix, rewardFactor) {
        return this.applyAffix({
            ...config,
            id: `${config.id}_elite`,
            name: `${config.name} Élite`,
            hp: Math.round(config.hp * 2.7),
            speed: Math.max(28, Math.round(config.speed * 0.82)),
            reward: Math.round((config.reward || 10) * 2.6 * rewardFactor),
            armor: Math.min(0.65, (config.armor || 0) + 0.12),
            isMiniBoss: true,
            threat: 5,
            phases: [{ threshold: 0.6, name: 'Ataque anunciado', telegraph: 1.2, speed: 1.25, color: '#ffd166' }]
        }, affix);
    }

    createElite(config, affix, rewardFactor) {
        return this.applyAffix({
            ...config,
            id: `${config.id}_elite`,
            name: `${config.name} Élite`,
            hp: Math.round(config.hp * 1.55),
            speed: Math.max(32, Math.round(config.speed * 0.92)),
            reward: Math.round((config.reward || 10) * 1.75 * rewardFactor),
            armor: Math.min(0.55, (config.armor || 0) + 0.08),
            isElite: true,
            threat: Math.min(5, (config.threat || 1) + 1)
        }, affix);
    }
}

export { AFFIXES };
