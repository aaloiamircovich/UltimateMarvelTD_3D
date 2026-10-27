import { Projectile } from '../entities/Projectile.js';
import { CombatSystem } from './CombatSystem.js';
import { getLineEndpoint, getLineTargets } from '../utils/LineTargeting.js';
import { isPointInRangePattern, getHeroRangePattern } from '../utils/RangePattern.js';

const DEFAULT_MARK_DURATION = 2.2;

export const ITEM_SIGNATURES = {
    carga_viuda: {
        black_widow: pulse({ label: 'Descarga Widow', interval: 7, damageFactor: 0.85, chainCount: 1, chainRange: 110, color: '#4ee8ff', effects: [stun(0.22)] }),
        yelena_belova: pulse({ label: 'Descarga Widow', interval: 7, damageFactor: 0.8, chainCount: 1, chainRange: 105, color: '#4ee8ff', effects: [stun(0.2)] })
    },
    localizador_fury: {
        nick_fury: markDangerous({ label: 'Objetivo S.H.I.E.L.D.', damageBonus: 0.15 }),
        maria_hill: markDangerous({ label: 'Objetivo S.H.I.E.L.D.', damageBonus: 0.15 }),
        mockingbird: markDangerous({ label: 'Objetivo S.H.I.E.L.D.', damageBonus: 0.15 })
    },
    telarana_sintetica: {
        miles_morales: pulse({ label: 'Venom Blast', interval: 7, damageFactor: 0.95, chainCount: 2, chainRange: 115, color: '#ffe45e', visualStyle: 'web', effects: [stun(0.26), slow(0.28, 1)] })
    },
    tridente_atlante: {
        namor: pulse({ label: 'Marea Real', interval: 6, damageFactor: 0.9, splashRadius: 58, color: '#5ee7ff', visualStyle: 'water', effects: [slow(0.38, 1.5)] }),
        namora: pulse({ label: 'Marea Atlante', interval: 6, damageFactor: 0.82, splashRadius: 54, color: '#5ee7ff', visualStyle: 'water', effects: [slow(0.36, 1.4)] }),
        triton: pulse({ label: 'Marea Atlante', interval: 6, damageFactor: 0.78, splashRadius: 52, color: '#5ee7ff', visualStyle: 'water', effects: [slow(0.34, 1.4)] })
    },
    guante_quake: {
        quake: line({ label: 'Onda Sismica', interval: 5, damageFactor: 0.82, lineWidth: 34, lineRange: 240, color: '#f6c453', effects: [armorBreak(0.18, 1)] })
    },
    casco_nova: {
        nova: pulse({ label: 'Nova Force', interval: 8, damageFactor: 1.05, chainCount: 3, chainRange: 130, chainFactor: 0.62, color: '#58d6ff', visualStyle: 'cosmic' })
    },
    armadura_war_machine: {
        punisher: multiStrike({ label: 'Salva War Machine', interval: 10, damageFactor: 0.56, maxTargets: 3, splashRadius: 34, color: '#ffb347', visualStyle: 'explosive' }),
        war_machine: multiStrike({ label: 'Salva Integrada', interval: 10, damageFactor: 0.62, maxTargets: 3, splashRadius: 36, color: '#ffb347', visualStyle: 'explosive' })
    },
    alas_wasp: {
        wasp: extraShots({ label: 'Rafaga Miniaturizada', interval: 6, shots: 3, damageFactor: 0.45, color: '#ffe45e', visualStyle: 'pym' })
    },
    anillo_portal: {
        wong: pulse({ label: 'Portal Duplicado', interval: 7, damageFactor: 0.6, chainCount: 1, chainRange: 95, color: '#f5a623', visualStyle: 'mystic', originOffset: 28 })
    },
    cristal_terrigeno: {
        black_bolt: pulse({ label: 'Sobrecarga Terrigena', interval: 7, damageFactor: 1.35, splashRadius: 70, color: '#e9f8ff', visualStyle: 'sonic' }),
        crystal: rotatingElement({ label: 'Ataque Elemental', interval: 7 }),
        medusa: pulse({ label: 'Cabello Prensil', interval: 7, damageFactor: 0.85, chainCount: 3, chainRange: 105, color: '#ff8bd1', visualStyle: 'whip', effects: [slow(0.52, 1.6)] })
    },
    matriz_probabilidad: {
        black_cat: probability({ label: 'Golpe de Fortuna', critStep: 5, critCap: 25, onCritEffects: [armorBreak(0.16, 1), slow(0.28, 1)] }),
        domino: probability({ label: 'Doble Suerte', critStep: 5, critCap: 25, onCritExtraHit: 0.45, onCritCreditPct: 0.12, color: '#ffd166' })
    },
    manual_combate_elite: {
        elektra: pulse({ label: 'Apertura Perfecta', interval: 6, damageFactor: 1.05, color: '#ff476f', visualStyle: 'blade', effects: [stun(0.16)] }),
        echo: pulse({ label: 'Eco Perfecto', interval: 6, damageFactor: 0.92, chainCount: 1, chainRange: 80, color: '#ffffff', effects: [stun(0.14)] }),
        jessica_jones: pulse({ label: 'Golpe Perfecto', interval: 6, damageFactor: 1.28, color: '#fca311', visualStyle: 'impact', effects: [stun(0.18)] }),
        luke_cage: pulse({ label: 'Impacto Perfecto', interval: 6, damageFactor: 1.05, splashRadius: 42, color: '#fca311', visualStyle: 'impact', effects: [stun(0.16)] })
    },
    traje_moleculas_inestables: {
        human_torch: pulse({ label: 'Nova Flame', interval: 7, damageFactor: 1.0, splashRadius: 60, color: '#ff7b3d', visualStyle: 'fire', effects: [burnFromAttack(0.45, 4)] }),
        invisible_woman: pulse({ label: 'Pulso Invisible', interval: 7, damageFactor: 0.82, splashRadius: 56, color: '#dff7ff', visualStyle: 'energy', effects: [slow(0.32, 1.4)] })
    },
    protocolo_danger_room: {
        jubilee: pulse({ label: 'Ataque Perfecto', interval: 10, damageFactor: 0.88, splashRadius: 54, color: '#ff8cff', effects: [burnFromAttack(0.2, 3)] }),
        nightcrawler: multiStrike({ label: 'Bamf Assault', interval: 10, damageFactor: 0.62, maxTargets: 4, color: '#7c5cff', visualStyle: 'mystic' }),
        psylocke: pulse({ label: 'Corte Psiquico', interval: 10, damageFactor: 1.05, color: '#d946ef', visualStyle: 'blade', armorPenetration: 0.45 }),
        rogue: timedBuff({ label: 'Absorcion Rogue', interval: 10, duration: 3.2, damagePct: 0.18, fireRatePct: 0.12, color: '#86efac' }),
        beast: markDangerous({ label: 'Analisis Cientifico', damageBonus: 0.18, interval: 10 }),
        wolverine: timedBuff({ label: 'Berserker', interval: 10, duration: 3, fireRatePct: 0.2, critChance: 8, color: '#ffd166' }),
        x_23: multiStrike({ label: 'Corte Multiple', interval: 10, damageFactor: 0.7, maxTargets: 3, color: '#ff476f', visualStyle: 'blade', effects: [{ type: 'bleed', duration: 4, power: 0.3, damageBasis: 'attackDamage', chance: 1 }] }),
        cable: pulse({ label: 'Telekinetic Burst', interval: 10, damageFactor: 0.92, splashRadius: 58, color: '#93c5fd', visualStyle: 'mystic' })
    },
    comunicador_guardianes: {
        gamora: multiStrike({ label: 'Combo Guardian', interval: 8, damageFactor: 0.65, maxTargets: 3, color: '#69e58c', visualStyle: 'blade' }),
        mantis: pulse({ label: 'Onda Empatica', interval: 8, damageFactor: 0.62, splashRadius: 56, color: '#b6ff9d', effects: [slow(0.46, 1.8), stun(0.12)] }),
        rocket_raccoon: pulse({ label: 'Explosivo Guardian', interval: 8, damageFactor: 0.95, splashRadius: 58, color: '#ffb347', visualStyle: 'explosive' }),
        nebula: line({ label: 'Rafaga Cibernetica', interval: 8, damageFactor: 0.75, lineWidth: 28, lineRange: 220, color: '#60a5fa', armorPenetration: 0.28 }),
        drax: pulse({ label: 'Golpe Destructor', interval: 8, damageFactor: 1.05, splashRadius: 44, color: '#ef4444', visualStyle: 'impact' }),
        cosmo: pulse({ label: 'Pulso Telequinetico', interval: 8, damageFactor: 0.72, splashRadius: 60, color: '#a78bfa', effects: [slow(0.4, 1.6)] })
    },
    legado_wakanda: {
        okoye: pulse({ label: 'Lanza Real', interval: 7, damageFactor: 0.92, color: '#9d4edd', visualStyle: 'blade', effects: [armorBreak(0.22, 1)] }),
        shuri: pulse({ label: 'Analisis de Vibranium', interval: 7, damageFactor: 0.9, color: '#9d4edd', armorPenetration: 0.25 }),
        mbaku: pulse({ label: 'Golpe Jabari', interval: 7, damageFactor: 1.08, splashRadius: 40, color: '#f8fafc', effects: [armorBreak(0.2, 1)] })
    },
    runa_asgardiana: {
        hela: pulse({ label: 'Juicio Asgardiano', interval: 10, damageFactor: 1.22, splashRadius: 48, chainCount: 1, color: '#69e58c', visualStyle: 'blade' }),
        valkyrie: pulse({ label: 'Carga Valquiria', interval: 10, damageFactor: 1.12, splashRadius: 50, color: '#facc15', visualStyle: 'blade' }),
        lady_sif: pulse({ label: 'Corte de Sif', interval: 10, damageFactor: 1.28, color: '#fde68a', visualStyle: 'blade' }),
        heimdall: pulse({ label: 'Bifrost', interval: 10, damageFactor: 1.05, splashRadius: 60, color: '#ffd166', visualStyle: 'cosmic' }),
        beta_ray_bill: pulse({ label: 'Stormbreaker', interval: 10, damageFactor: 1.08, chainCount: 2, chainRange: 120, color: '#60a5fa', visualStyle: 'lightning' })
    },
    talisman_tigre: {
        white_tiger: focusRamp({ label: 'Espiritu Tigre', maxStacks: 8, damagePct: 0.035 }),
        tigra: focusRamp({ label: 'Espiritu Tigre', maxStacks: 8, damagePct: 0.035 })
    },
    redwing_mk2: {
        falcon: redwing({ label: 'Redwing MK II', interval: 4, damageFactor: 0.42, color: '#ef4444' })
    },
    baraja_cinetica: {
        gambit: pulse({ label: 'Carta Cinetica', interval: 5, damageFactor: 1.0, splashRadius: 52, color: '#f472b6', visualStyle: 'explosive' })
    },
    fragmento_bloodstone: {
        elsa_bloodstone: huntMark({ label: 'Presa Bloodstone', threshold: 4, damageBonus: 0.32 })
    },
    arsenal_deadpool: {
        deadpool: rotatingStrike({ label: 'Arsenal sin Fondo', interval: 3 })
    },
    totem_tierra_salvaje: {
        devil_dinosaur: pulse({ label: 'Rugido Salvaje', interval: 7, damageFactor: 0.98, splashRadius: 58, color: '#f97316', visualStyle: 'sonic', effects: [slow(0.34, 1.5)] })
    },
    amplificador_criocinetico: {
        luna_snow: pulse({ label: 'Zona Criocinetica', interval: 6, damageFactor: 0.58, splashRadius: 62, color: '#93c5fd', visualStyle: 'ice', effects: [slow(0.55, 2), { type: 'poison', duration: 3, power: 0.006, chance: 1 }] })
    },
    brazalete_kamala: {
        ms_marvel: line({ label: 'Puno Gigante', interval: 5, damageFactor: 1.0, lineWidth: 42, lineRange: 210, color: '#fbbf24', visualStyle: 'impact' })
    },
    nucleo_gamma: {
        she_hulk: focusRamp({ label: 'Furia Gamma', maxStacks: 10, damagePct: 0.03, decaySeconds: 4 })
    },
    senal_tippytoe: {
        squirrel_girl: line({ label: 'Estampida Tippy-Toe', interval: 8, damageFactor: 0.64, lineWidth: 54, lineRange: 260, color: '#d97706', visualStyle: 'impact' })
    },
    stormcaster: {
        storm: pulse({ label: 'Stormcaster', interval: 10, damageFactor: 1.05, splashRadius: 72, chainCount: 2, chainRange: 120, color: '#93c5fd', visualStyle: 'lightning', effects: [stun(0.22)] })
    },
    capucha_infernal: {
        the_hood: curseKill({ label: 'Proyectil Infernal', damageFactor: 0.45, color: '#7f1d1d' })
    },
    nucleo_adaptativo: {
        peni_parker: timedBuff({ label: 'Overclock SP//dr', interval: 10, duration: 3.2, fireRatePct: 0.28, color: '#60a5fa' }),
        vision: timedBuff({ label: 'Overclock de Densidad', interval: 10, duration: 3.2, fireRatePct: 0.24, armorPenetration: 0.25, color: '#facc15' }),
        winter_soldier: timedBuff({ label: 'Overclock Tactico', interval: 10, duration: 3.2, fireRatePct: 0.26, armorPenetration: 0.22, color: '#94a3b8' })
    },
    escudo_guardian_rojo: {
        red_guardian: pulse({ label: 'Escudo Rojo', interval: 6, damageFactor: 0.85, chainCount: 3, chainRange: 100, color: '#ef4444', visualStyle: 'shield' })
    },
    arsenal_knowhere: {
        korg: pulse({ label: 'Roca de Knowhere', interval: 8, damageFactor: 1.05, splashRadius: 54, color: '#a3a3a3', visualStyle: 'impact' }),
        yondu: line({ label: 'Flecha Yaka', interval: 8, damageFactor: 0.88, lineWidth: 28, lineRange: 280, color: '#ef4444', visualStyle: 'arrow' }),
        howard_the_duck: pulse({ label: 'Arma Improbable', interval: 8, damageFactor: 0.9, splashRadius: 46, color: '#facc15', visualStyle: 'explosive' })
    },
    cerebro: {
        profesor_x: pulse({ label: 'Pulso Psiquico', interval: 9, damageFactor: 0.65, splashRadius: 110, color: '#a78bfa', visualStyle: 'mystic', effects: [stun(0.34), { type: 'mark', duration: 4, power: 0.18, chance: 1 }] })
    },
    carcaj_flechas_truco: {
        kate_bishop: rotatingArrows({ label: 'Flechas Truco', interval: 4 })
    },
    mjolnir: {
        capitan_america: pulse({ label: 'Trueno del Capitan', interval: 5, damageFactor: 0.85, chainCount: 2, chainRange: 115, color: '#93c5fd', visualStyle: 'lightning', effects: [stun(0.18)] })
    },
    pocion_yggdrasil: {
        doctor_strange: pulse({ label: 'Dios de la Magia', interval: 10, damageFactor: 0.82, splashRadius: 96, color: '#f5a623', visualStyle: 'mystic', effects: [stun(0.38), slow(0.5, 2.2)] })
    },
    darkhold: {
        scarlet_witch: pulse({ label: 'Chaos Goddess', interval: 8, damageFactor: 1.18, splashRadius: 78, chainCount: 1, color: '#9f1239', visualStyle: 'mystic', effects: [curse(0.018, 5)] })
    },
    diez_anillos: {
        shang_chi: pulse({ label: 'Diez Anillos', interval: 6, damageFactor: 0.96, chainCount: 2, chainRange: 110, color: '#facc15', visualStyle: 'ring', effects: [stun(0.16)] })
    },
    espada_infinito: {
        silver_surfer: line({ label: 'Dark Surfer', interval: 7, damageFactor: 1.16, lineWidth: 36, lineRange: 300, color: '#111827', armorPenetration: 0.45 })
    },
    el_vacio: {
        sentry: voidStrike({ label: 'The Void', interval: 24, damageFactor: 3, color: '#111827' })
    },
    formula_phoenix: {
        jean_grey: pulse({ label: 'Dark Phoenix', interval: 8, damageFactor: 1.12, splashRadius: 76, color: '#ff3b3b', visualStyle: 'fire', effects: [burnFromAttack(0.36, 5)] })
    },
    guantelete_infinito: {
        adam_warlock: pulse({ label: 'Avatar del Infinito', interval: 8, damageFactor: 1.16, chainCount: 2, chainRange: 125, splashRadius: 46, color: '#ffd166', visualStyle: 'cosmic' })
    },
    particulas_pym: {
        ant_man: line({ label: 'Colonia Pym', interval: 7, damageFactor: 0.62, lineWidth: 46, lineRange: 240, color: '#ef3340', visualStyle: 'pym' })
    },
    simbionte: {
        spiderman: pulse({ label: 'Black Suit', interval: 7, damageFactor: 0.85, chainCount: 2, chainRange: 95, color: '#111827', effects: [slow(0.38, 1.5), { type: 'poison', duration: 4, power: 0.008, chance: 1 }] }),
        jeff_the_land_shark: pulse({ label: 'Venom Jeff', interval: 7, damageFactor: 0.78, splashRadius: 48, color: '#111827', effects: [slow(0.42, 1.8)] })
    },
    necroespada: {
        venom: pulse({ label: 'King in Black', interval: 9, damageFactor: 1.18, splashRadius: 58, color: '#111827', visualStyle: 'blade', effects: [curse(0.015, 5)] })
    }
};

export function hasSignatureItem(hero, itemId) {
    return Boolean(getSignatureConfig(hero, itemId));
}

export function getSignatureConfig(hero, itemId = getEquippedItem(hero)?.id) {
    if (!itemId || getEquippedItem(hero)?.id !== itemId) return null;
    const config = ITEM_SIGNATURES[itemId]?.[hero?.id];
    if (!config) return null;
    const evolution = hero?.game?.progression?.getHeroEvolution?.(hero.id);
    if (config.requiresEvolution !== false && !evolution?.levelEvolved) return null;
    return { ...config, itemId, evolution };
}

export function buildSignatureAttackContext(hero, target, stats) {
    const item = getEquippedItem(hero);
    const config = getSignatureConfig(hero, item?.id);
    const state = getState(hero, item?.id || 'none');
    const nextStats = { ...stats };

    if (!config) return { item, config: null, state, stats: nextStats };
    if (config.probability) nextStats.critChance += Math.min(config.critCap || 25, state.critBonus || 0);
    if (config.focusRamp) nextStats.damage *= 1 + getFocusStacks(hero, target, state, config) * (config.damagePct || 0);
    if (config.markDangerous) {
        updateDangerMark(hero, config, state, nextStats.range);
        if (hasActiveSignatureMark(target, state.markedUid, state.markedRemaining)) nextStats.damage *= 1 + (config.damageBonus || 0.15);
    }
    if (config.huntMark) {
        prepareHuntTarget(state, target);
        if (hasActiveSignatureMark(target, state.huntedUid, state.huntedRemaining)) nextStats.damage *= 1 + (config.damageBonus || 0.3);
    }

    return { item, config, state, stats: nextStats };
}

export function resolveSignatureAfterAttack(hero, target, stats, projectileConfig, projectiles, context = {}) {
    const { config, state } = context;
    if (!config || !target) return;

    if (state.extraShots > 0) {
        state.extraShots--;
        spawnProjectile(hero, target, {
            ...projectileConfig,
            damage: stats.damage * (state.extraShotDamageFactor || 0.45),
            color: state.extraShotColor || config.color || projectileConfig.color,
            visualStyle: state.extraShotVisualStyle || config.visualStyle || projectileConfig.visualStyle,
            radius: 4
        }, projectiles);
    }

    if (config.probability) resolveProbability(hero, target, stats, projectileConfig, projectiles, context);
    if (config.huntMark) updateHuntMark(hero, target, state, config);
    if (config.curseKill) state.curseKill = config;

    state.count = (state.count || 0) + 1;
    if (state.count < (config.interval || Infinity)) return;
    state.count = 0;

    if (config.markDangerous) return;
    triggerSignature(hero, target, stats, projectileConfig, projectiles, config, state);
}

export function resolveSignatureOnKill(hero, defeatedTarget = null) {
    const item = getEquippedItem(hero);
    const config = getSignatureConfig(hero, item?.id);
    const state = getState(hero, item?.id || 'none');
    if (!config?.curseKill || state.killChainActive) return;

    const stats = hero.getEffectiveStats?.() || { damage: hero.damage || 0, range: hero.range || 0 };
    const origin = defeatedTarget || hero;
    const target = getTargetsInRange(hero, Math.max(stats.range || 0, hero.range || 0))
        .filter((enemy) => enemy !== defeatedTarget)
        .sort((a, b) => distance(a, origin) - distance(b, origin))[0];
    if (!target) return;

    state.killChainActive = true;
    CombatSystem.applyDamage({
        secondaryEntity: true,
        attackerType: hero.category,
        damage: (stats.damage || hero.damage || 0) * (config.damageFactor || 0.45),
        color: config.color || '#7f1d1d',
        armorPenetration: 0.25
    }, target, hero, hero.game?.resourceManager, 1);
    applyEffects([curse(0.018, 5)], target, hero);
    hero.game?.vfx?.addBeam?.(origin, target, { color: config.color || '#7f1d1d', width: 3, duration: 0.22 });
    hero.game?.vfx?.addFloatingText?.(target.x, target.y - 36, config.label || 'Maldicion', {
        color: config.color || '#7f1d1d',
        size: 12,
        duration: 0.72,
        velocityY: -26
    });
    state.killChainActive = false;
}

export function applySignatureStats(stats, hero) {
    const item = getEquippedItem(hero);
    const config = getSignatureConfig(hero, item?.id);
    const state = getState(hero, item?.id || 'none');
    if (!config) return stats;
    applyTimedBuffStats(stats, state);
    return stats;
}

export function renderSignatureVisuals(hero, ctx) {
    if (!getSignatureConfig(hero, 'redwing_mk2')) return;
    const time = hero.visualTime || 0;
    const x = hero.x + Math.cos(time * 2.4) * 25;
    const y = hero.y - 12 + Math.sin(time * 2.4) * 8;
    ctx.save();
    ctx.fillStyle = '#ef4444';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y - 5);
    ctx.lineTo(x + 8, y + 4);
    ctx.lineTo(x, y + 2);
    ctx.lineTo(x - 8, y + 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}

function triggerSignature(hero, target, stats, projectileConfig, projectiles, config, state) {
    if (config.extraShots) {
        state.extraShots = config.extraShots;
        state.extraShotDamageFactor = config.damageFactor || 0.45;
        state.extraShotColor = config.color;
        state.extraShotVisualStyle = config.visualStyle;
        announce(hero, target, config);
        return;
    }
    if (config.timedBuff) {
        state.timedBuff = { ...config.timedBuff, remaining: config.timedBuff.duration || 3 };
        announce(hero, target, config);
        return;
    }
    if (config.rotatingElement) {
        const variants = [
            { color: '#ff7b3d', visualStyle: 'fire', effects: [burnFromAttack(0.2, 4)], splashRadius: 48 },
            { color: '#93c5fd', visualStyle: 'ice', effects: [slow(0.48, 1.8), stun(0.14)], splashRadius: 44 },
            { color: '#ffe45e', visualStyle: 'lightning', chainCount: 2, chainRange: 110 }
        ];
        const elementIndex = state.elementIndex ?? 0;
        const variant = variants[elementIndex % variants.length];
        state.elementIndex = elementIndex + 1;
        strikePulse(hero, target, stats, { ...config, ...variant, damageFactor: 0.88 }, projectiles);
        return;
    }
    if (config.rotatingStrike) {
        const variants = [
            { damageFactor: 0.72, maxTargets: 2, color: '#ffffff', visualStyle: 'ballistic' },
            { damageFactor: 1.18, maxTargets: 1, color: '#ef4444', visualStyle: 'blade' },
            { damageFactor: 0.92, maxTargets: 2, splashRadius: 48, color: '#ffb347', visualStyle: 'explosive' }
        ];
        const rotateIndex = state.rotateIndex ?? 0;
        const variant = variants[rotateIndex % variants.length];
        state.rotateIndex = rotateIndex + 1;
        strikeMulti(hero, target, stats, { ...config, ...variant }, projectiles);
        return;
    }
    if (config.rotatingArrows) {
        const variants = [
            { damageFactor: 0.9, splashRadius: 48, color: '#ffb347', visualStyle: 'explosive' },
            { damageFactor: 0.72, color: '#93c5fd', effects: [slow(0.48, 1.8)] },
            { damageFactor: 0.82, color: '#60a5fa', effects: [armorBreak(0.2, 1)] }
        ];
        const arrowIndex = state.arrowIndex ?? 0;
        const variant = variants[arrowIndex % variants.length];
        state.arrowIndex = arrowIndex + 1;
        strikePulse(hero, target, stats, { ...config, ...variant }, projectiles);
        return;
    }
    if (config.voidStrike) {
        strikeVoid(hero, target, stats, config);
        return;
    }
    if (config.line) {
        strikeLine(hero, target, stats, config);
        return;
    }
    if (config.multiStrike || config.redwing) {
        strikeMulti(hero, target, stats, config, projectiles);
        return;
    }
    strikePulse(hero, target, stats, config, projectiles);
}

function strikePulse(hero, target, stats, config) {
    const damage = stats.damage * (config.damageFactor || 0.75);
    const projectile = {
        secondaryEntity: true,
        attackerType: hero.category,
        damage,
        color: config.color,
        armorPenetration: config.armorPenetration || 0
    };

    CombatSystem.applyDamage(projectile, target, hero, hero.game?.resourceManager, 1);
    applyEffects(config.effects, target, hero);
    const enemies = hero.game?.enemies || [];
    const hit = new Set([target]);

    if (config.splashRadius) {
        hero.game?.vfx?.addBurst?.(target.x, target.y, { color: config.color || '#ffd166', radius: config.splashRadius, duration: 0.34 });
        enemies.filter((enemy) => enemy !== target && enemy.isAlive && distance(enemy, target) <= config.splashRadius)
            .forEach((enemy) => {
                hit.add(enemy);
                CombatSystem.applyDamage(projectile, enemy, hero, hero.game?.resourceManager, config.splashFactor || 0.45);
                applyEffects(config.effects, enemy, hero);
            });
    }

    let current = target;
    for (let jump = 0; jump < (config.chainCount || 0); jump++) {
        const next = enemies
            .filter((enemy) => enemy.isAlive && !hit.has(enemy) && distance(enemy, current) <= (config.chainRange || 100))
            .sort((a, b) => distance(a, current) - distance(b, current))[0];
        if (!next) break;
        hit.add(next);
        CombatSystem.applyDamage(projectile, next, hero, hero.game?.resourceManager, (config.chainFactor || 0.6) ** (jump + 1));
        applyEffects(config.effects, next, hero);
        hero.game?.vfx?.addBeam?.(current, next, { color: config.color || '#ffd166', width: 3, duration: 0.2 });
        current = next;
    }

    announce(hero, target, config);
}

function strikeLine(hero, target, stats, config) {
    const length = config.lineRange || stats.range * 1.25;
    const endpoint = getLineEndpoint(hero, target, length);
    const targets = getLineTargets(hero, target, hero.game?.enemies || [], length, config.lineWidth || 30);
    const projectile = {
        secondaryEntity: true,
        attackerType: hero.category,
        damage: stats.damage * (config.damageFactor || 0.7),
        color: config.color,
        armorPenetration: config.armorPenetration || 0
    };
    targets.forEach((enemy) => {
        CombatSystem.applyDamage(projectile, enemy, hero, hero.game?.resourceManager, 1);
        applyEffects(config.effects, enemy, hero);
    });
    hero.game?.vfx?.addBeam?.(hero, endpoint, { color: config.color || '#ffd166', width: config.lineWidth || 20, duration: 0.24 });
    announce(hero, target, config);
}

function strikeMulti(hero, target, stats, config, projectiles) {
    const targets = getTargetsInRange(hero, stats.range)
        .sort((a, b) => Number(b.isBoss) - Number(a.isBoss) || (b.threat || 1) - (a.threat || 1) || distance(a, target) - distance(b, target))
        .slice(0, config.maxTargets || 2);
    if (!targets.length) return;
    targets.forEach((enemy, index) => {
        const projectileConfig = {
            attacker: hero,
            damage: stats.damage * (config.damageFactor || 0.5),
            attackerType: hero.category,
            color: config.color || '#ffd166',
            visualStyle: config.visualStyle || 'energy',
            splashRadius: config.splashRadius || 0,
            splashFactor: config.splashFactor || 0.35,
            effects: config.effects || [],
            radius: 4
        };
        if (index === 0 && config.redwing) hero.game?.vfx?.addRing?.(hero.x, hero.y, { color: config.color || '#ef4444', radius: 26, duration: 0.28 });
        spawnProjectile(hero, enemy, projectileConfig, projectiles);
    });
    announce(hero, target, config);
}

function strikeVoid(hero, target, stats, config) {
    if (!target?.isAlive) return;
    const result = CombatSystem.executeNonBoss(target, hero, hero.game?.resourceManager, config.color, true);
    if (!result.killed) {
        const damage = stats.damage * (config.damageFactor || 3);
        CombatSystem.applyDamage({ secondaryEntity: true, attackerType: hero.category, damage, color: config.color, armorPenetration: 0.65 }, target, hero, hero.game?.resourceManager, 1);
    }
    hero.game?.vfx?.addBurst?.(target.x, target.y, { color: '#111827', radius: 74, duration: 0.42 });
    announce(hero, target, config);
}

function resolveProbability(hero, target, stats, projectileConfig, projectiles, context) {
    const { config, state, isCrit } = context;
    if (!isCrit) {
        state.critBonus = Math.min(config.critCap || 25, (state.critBonus || 0) + (config.critStep || 5));
        return;
    }
    state.critBonus = 0;
    applyEffects(config.onCritEffects, target, hero);
    if (config.onCritExtraHit) {
        const candidates = getTargetsInRange(hero, stats.range);
        const next = candidates.find((enemy) => enemy !== target) || candidates.find((enemy) => enemy === target);
        spawnProjectile(hero, next, {
            ...projectileConfig,
            damage: stats.damage * config.onCritExtraHit,
            color: config.color || projectileConfig.color,
            radius: 4
        }, projectiles);
    }
    if (config.onCritCreditPct) {
        const reward = Number(target?.reward ?? target?.config?.reward ?? 0);
        if (Number.isFinite(reward) && reward > 0) {
            const credits = Math.max(1, Math.ceil(reward * config.onCritCreditPct));
            hero.game?.resourceManager?.addCredits?.(credits);
            hero.recordGold?.(credits);
        }
    }
}

function updateDangerMark(hero, config, state, range) {
    if (state.count && config.interval && state.count % config.interval !== 0) return;
    const target = getTargetsInRange(hero, range)
        .sort((a, b) => Number(b.isBoss) - Number(a.isBoss) || (b.threat || 1) - (a.threat || 1) || b.hp - a.hp)[0];
    state.markedUid = null;
    state.markedRemaining = 0;
    if (!target?.applyStatus?.({ type: 'mark', duration: DEFAULT_MARK_DURATION, power: config.damageBonus || 0.15, chance: 1 }, hero)) return;
    state.markedUid = getTargetId(target);
    state.markedRemaining = target.getStatusDuration?.('mark', DEFAULT_MARK_DURATION) ?? DEFAULT_MARK_DURATION;
    hero.game?.vfx?.addRing?.(target.x, target.y, { color: '#40c9ff', radius: 20, duration: 0.26 });
}

function updateHuntMark(hero, target, state, config) {
    prepareHuntTarget(state, target);
    if (!target?.isAlive) return;
    state.huntHits++;
    if (state.huntHits >= (config.threshold || 4)) {
        if (!target.applyStatus?.({ type: 'mark', duration: 5, power: config.damageBonus || 0.3, chance: 1 }, hero)) return;
        state.huntedUid = getTargetId(target);
        state.huntedRemaining = target.getStatusDuration?.('mark', 5) ?? 5;
        hero.game?.vfx?.addRing?.(target.x, target.y, { color: '#ff3b5f', radius: 28, duration: 0.32 });
    }
}

function hasActiveSignatureMark(target, uid, remaining) {
    return Boolean(target?.isAlive && uid && getTargetId(target) === uid && remaining > 0
        && target.debuffs?.some((effect) => effect.type === 'mark' && effect.duration > 0));
}

function prepareHuntTarget(state, target) {
    if (state.huntTarget !== getTargetId(target) || !target?.isAlive
        || (state.huntedUid && !hasActiveSignatureMark(target, state.huntedUid, state.huntedRemaining))) {
        state.huntTarget = target?.isAlive ? getTargetId(target) : null;
        state.huntHits = 0;
        state.huntedUid = null;
        state.huntedRemaining = 0;
    }
}

function getFocusStacks(hero, target, state, config) {
    const targetId = getTargetId(target);
    if (state.focusTarget !== targetId) {
        state.focusTarget = targetId;
        state.focusStacks = 0;
    }
    state.focusStacks = Math.min(config.maxStacks || 8, (state.focusStacks || 0) + 1);
    state.focusTimer = config.decaySeconds || 3;
    return state.focusStacks;
}

function applyTimedBuffStats(stats, state) {
    const buff = state.timedBuff;
    if (!buff?.remaining || buff.remaining <= 0) return;
    stats.damage *= 1 + (buff.damagePct || 0);
    stats.fireRate *= 1 + (buff.fireRatePct || 0);
    stats.critChance += buff.critChance || 0;
    stats.armorPenetration = Math.min(0.85, (stats.armorPenetration || 0) + (buff.armorPenetration || 0));
}

export function updateSignatureTimers(hero, dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    // Unequipped items also age while the hero is deployed; reequipping cannot bank a buff.
    for (const state of Object.values(hero.signatureState || {})) {
        if (state.markedRemaining > 0) {
            state.markedRemaining = Math.max(0, state.markedRemaining - dt);
            if (state.markedRemaining < 1e-9) {
                state.markedRemaining = 0;
                state.markedUid = null;
            }
        }
        if (state.huntedRemaining > 0) {
            state.huntedRemaining = Math.max(0, state.huntedRemaining - dt);
            if (state.huntedRemaining < 1e-9) {
                state.huntedRemaining = 0;
                state.huntedUid = null;
                state.huntTarget = null;
                state.huntHits = 0;
            }
        }
        if (state.timedBuff?.remaining > 0) {
            state.timedBuff.remaining = Math.max(0, state.timedBuff.remaining - dt);
            if (state.timedBuff.remaining < 1e-9) state.timedBuff.remaining = 0;
        }
        if (state.focusTimer > 0) {
            state.focusTimer = Math.max(0, state.focusTimer - dt);
            if (state.focusTimer < 1e-9) state.focusTimer = 0;
            if (state.focusTimer === 0) state.focusStacks = 0;
        }
    }
}

function applyEffects(effects = [], target, hero) {
    (effects || []).forEach((effect) => CombatSystem.applyEffects([{ ...effect, secondaryEntity: true }], target, hero));
}

function spawnProjectile(hero, target, config, projectiles = []) {
    if (!target?.isAlive) return;
    // Extra shots keep their damage/profile, but never inherit a primary route token or item procs.
    const secondary = { ...config, secondaryEntity: true, energyToken: null,
        effects: (config.effects || []).map(effect => ({ ...effect, secondaryEntity: true })) };
    if (hero.game?.spawnProjectile) hero.game.spawnProjectile(hero.x, hero.y, target, secondary);
    else projectiles.push(new Projectile(hero.x, hero.y, target, secondary));
}

function getTargetsInRange(hero, range) {
    const stats = hero.getEffectiveStats?.() || {};
    const reach = range || hero.range || 0;
    return (hero.game?.enemies || []).filter((enemy) => enemy.isAlive
        && (!enemy.stealth || stats.canSeeStealth)
        && isPointInRangePattern(hero, enemy, reach, getHeroRangePattern(hero), stats.rangeGeometryScale));
}

function announce(hero, target, config) {
    hero.recordAbility?.();
    hero.game?.vfx?.addFloatingText?.(target.x, target.y - 38, config.label || 'SIGNATURE', {
        color: config.color || '#ffd166',
        size: 12,
        duration: 0.72,
        velocityY: -26
    });
}

function getEquippedItem(hero) {
    return hero?.items?.[0] || null;
}

function getState(hero, itemId) {
    hero.signatureState ||= {};
    hero.signatureState[itemId] ||= {};
    return hero.signatureState[itemId];
}

function getTargetId(target) {
    return target?.uid || target?.id || target?.name || '';
}

function distance(a, b) {
    return Math.hypot((a?.x || 0) - (b?.x || 0), (a?.y || 0) - (b?.y || 0));
}

function pulse(config) { return { ...config, type: 'pulse' }; }
function line(config) { return { ...config, line: true }; }
function multiStrike(config) { return { ...config, multiStrike: true }; }
function redwing(config) { return { ...config, redwing: true, multiStrike: true, maxTargets: 1 }; }
function extraShots(config) { return { ...config, extraShots: config.shots || 1 }; }
function timedBuff(config) { return { ...config, timedBuff: config }; }
function probability(config) { return { ...config, probability: true, requiresEvolution: true }; }
function markDangerous(config) { return { ...config, markDangerous: true, requiresEvolution: true }; }
function focusRamp(config) { return { ...config, focusRamp: true, requiresEvolution: true, interval: Infinity }; }
function huntMark(config) { return { ...config, huntMark: true, requiresEvolution: true, interval: Infinity }; }
function curseKill(config) { return { ...config, curseKill: true, requiresEvolution: true, interval: Infinity }; }
function rotatingElement(config) { return { ...config, rotatingElement: true }; }
function rotatingStrike(config) { return { ...config, rotatingStrike: true }; }
function rotatingArrows(config) { return { ...config, rotatingArrows: true }; }
function voidStrike(config) { return { ...config, voidStrike: true }; }
function slow(power, duration = 1.2) { return { type: 'slow', duration, power, chance: 1 }; }
function stun(duration = 0.2) { return { type: 'stun', duration, power: 1, chance: 1 }; }
function armorBreak(power, chance = 1) { return { type: 'armorBreak', duration: 3, power, chance }; }
function burnFromAttack(power, duration = 4) { return { type: 'burn', duration, power, damageBasis: 'attackDamage', chance: 1 }; }
function curse(power, duration = 4) { return { type: 'curse', duration, power, chance: 1 }; }
