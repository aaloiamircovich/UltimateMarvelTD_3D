import { getEffectiveSupportAura } from './SupportAuraSystem.js';

const SUPPORT_AURA_COPY = {
    damage: 'dano',
    fireRate: 'cadencia',
    range: 'rango'
};

export function buildWaveDamageCheck({ heroes = [], waveModel = {}, waveSeconds = 8 } = {}) {
    const requiredDamage = Math.max(0, Math.round(Number(waveModel.effectiveHp || waveModel.totalHp || 0)));
    const safeWaveSeconds = Math.max(0, Number(waveSeconds || 0));
    const totalEnemies = Math.max(0, Number(waveModel.total || 0));
    const stealthCount = Math.max(0, Number(waveModel.stealthCount || 0));
    const roles = new Set(waveModel.roles || []);
    const needsDetection = stealthCount > 0 || roles.has('stealth') || roles.has('phaser');
    const hiddenCount = stealthCount > 0 ? stealthCount : needsDetection ? totalEnemies : 0;
    const hiddenShare = totalEnemies > 0 ? Math.min(1, hiddenCount / totalEnemies) : needsDetection ? 1 : 0;
    const visibleShareForNonDetectors = needsDetection ? Math.max(0, 1 - hiddenShare) : 1;
    const hasDetector = heroes.some(heroCanDetect);
    const contributors = heroes.map((hero) => {
        const stats = hero.getEffectiveStats?.() || hero;
        const damage = Math.max(0, Number(stats.damage || hero.damage || 0));
        const fireRate = Math.max(0, Number(stats.fireRate || hero.fireRate || 0));
        const range = Math.max(0, Number(stats.range || hero.range || 100));
        const config = hero.config || hero;
        const isPureAura = Boolean(config.special?.supportAura?.type || config.supportAura?.type);
        const detectsStealth = heroCanDetect(hero);
        const control = Number(config.teamMetrics?.control || hero.teamMetrics?.control || 0);
        const coverageFactor = Math.max(0.55, Math.min(1.12, range / 170));
        const controlFactor = 1 + Math.min(0.1, control * 0.015);
        const detectionFactor = detectsStealth ? 1 : visibleShareForNonDetectors;
        const contribution = isPureAura ? 0 : damage * fireRate * coverageFactor * controlFactor * detectionFactor;
        return {
            id: hero.id || config.id || '',
            name: hero.name || config.name || hero.id || 'Heroe',
            dps: contribution
        };
    }).filter((entry) => entry.dps > 0);
    const supports = heroes
        .map(buildSupportContribution)
        .filter(Boolean)
        .slice(0, 4);
    const dps = contributors.reduce((total, entry) => total + entry.dps, 0);
    const expectedDamage = Math.round(dps * safeWaveSeconds);
    const topContributors = contributors
        .sort((a, b) => b.dps - a.dps)
        .slice(0, 3)
        .map((entry) => ({
            id: entry.id,
            name: entry.name,
            dps: Math.round(entry.dps),
            share: dps > 0 ? Math.round((entry.dps / dps) * 100) : 0
        }));
    const ratio = requiredDamage > 0 ? expectedDamage / requiredDamage : 0;
    const pct = Math.round(ratio * 100);
    const { tone, label } = getDamageTone(ratio);
    const detectionThreatLabel = getDetectionThreatLabel(waveModel);
    const warnings = needsDetection && !hasDetector
        ? [{
            id: 'detection',
            icon: 'fa-eye-slash',
            label: 'Sin deteccion',
            detail: `DPS reducido contra ${detectionThreatLabel}.`
        }]
        : [];
    const detectionDetail = warnings.length ? ' · DPS sin deteccion reducido' : '';
    return {
        tone,
        label,
        dps: Math.round(dps),
        expectedDamage,
        requiredDamage,
        ratio: Number(ratio.toFixed(2)),
        contributors: topContributors,
        supports,
        warnings,
        detail: requiredDamage > 0 ? `Cubre ${pct}% del HP estimado${detectionDetail}` : 'Sin HP preparado para comparar'
    };
}

function buildSupportContribution(hero = {}) {
    const config = hero.config || hero;
    const scaledAura = getEffectiveSupportAura(hero);
    if (!scaledAura?.type) return null;
    const typeLabel = scaledAura.targetCondition === 'mark' ? 'contra marcados' : SUPPORT_AURA_COPY[scaledAura.type] || 'aura';
    const power = Math.max(0, Math.round(Number(scaledAura.power || 0) * 100));
    const range = Math.max(0, Math.round(Number(scaledAura.range || hero.range || config.range || 0)));

    return {
        id: hero.id || config.id || '',
        name: hero.name || config.name || hero.id || 'Heroe',
        type: scaledAura.type,
        label: `+${power}% ${typeLabel}`,
        range,
        detectStealth: Boolean(scaledAura.detectStealth)
    };
}

function heroCanDetect(hero = {}) {
    const config = hero.config || hero;
    const stats = hero.getEffectiveStats?.() || hero;
    const aura = config.special?.supportAura || config.supportAura || hero.special?.supportAura || hero.supportAura;
    const detectionScore = Number(config.teamMetrics?.detection || hero.teamMetrics?.detection || 0);
    const text = normalizeDetectionText([
        config.name,
        config.ability,
        config.abilityDesc,
        config.niche,
        ...(config.tags || [])
    ].filter(Boolean).join(' '));

    return Boolean(hero.canSeeStealth || stats.canSeeStealth || config.canSeeStealth || aura?.detectStealth)
        || detectionScore >= 4
        || /sigilo|deteccion|rastreo|edith|revela/.test(text);
}

function getDetectionThreatLabel(waveModel = {}) {
    const roles = new Set(waveModel.roles || []);
    const hasStealth = Number(waveModel.stealthCount || 0) > 0 || roles.has('stealth');
    const hasPhaser = roles.has('phaser');
    if (hasStealth && hasPhaser) return 'sigilo/fase';
    if (hasPhaser) return 'fase';
    return 'sigilo';
}

function getDamageTone(ratio) {
    if (ratio >= 1.25) return { tone: 'dominant', label: 'Potencia amplia' };
    if (ratio >= 1) return { tone: 'ready', label: 'Potencia suficiente' };
    if (ratio >= 0.76) return { tone: 'thin', label: 'Potencia justa' };
    return { tone: 'danger', label: 'Falta daño' };
}

function normalizeDetectionText(value = '') {
    return String(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}
