import { getScaledSupportAura } from '../utils/HeroLevel.js';
import { getEvolutionForHero } from './EvolutionSystem.js';

export const VIBRANIUM_NETWORK = Object.freeze({ attacks: 6, duration: 3, cooldown: 9, powerMultiplier: 1.5 });
export const PYM_LINK = Object.freeze({ rest: 6, duration: 3, powerMultiplier: 2 });
export const SANCTUARY_PULSE = Object.freeze({ rest: 4, duration: 4 });
export const MENTAL_LINK = Object.freeze({ budgetMultiplier: 10 / 3, perAllyMultiplier: 2 });
export const PRIORITY_ORDER = Object.freeze({ powerMultiplier: 2 });

export function resetSupportAura(hero) {
    if (hero) {
        hero.supportNetworkState = null;
        hero.supportPulseState = null;
    }
}

function auraConfig(hero) {
    const config = hero.config || hero;
    return config.special?.supportAura || config.supportAura;
}

function isCadenceSupport(hero, id) {
    return (hero.id || hero.config?.id) === id && auraConfig(hero)?.type === 'fireRate';
}

function isRangeSupport(hero, id) {
    return (hero.id || hero.config?.id) === id && auraConfig(hero)?.type === 'range';
}

function hasPriorityOrder(hero) {
    return (hero.id || hero.config?.id) === 'maria_hill' && auraConfig(hero)?.type === 'damage';
}

function timedPulse(hero) {
    if (isCadenceSupport(hero, 'wasp')) return PYM_LINK;
    if (isRangeSupport(hero, 'wong')) return SANCTUARY_PULSE;
    return null;
}

function pulseState(hero) {
    let state = hero.supportPulseState;
    if (!state || !hero.game?.heroes?.includes(hero) || state.x !== hero.x || state.y !== hero.y) {
        state = { x: hero.x, y: hero.y, elapsed: 0 };
        hero.supportPulseState = state;
    }
    return state;
}

export function getEvolvedSupportAura(hero, level = hero.level || hero.config?.level || 1) {
    const aura = getScaledSupportAura(auraConfig(hero), level, hero.config?.rarity || hero.rarity);
    if (aura) {
        // Resolve the requested level directly so previews do not use the saved current evolution.
        const evolution = getEvolutionForHero(hero.config || hero, {}, { level });
        aura.power *= 1 + (evolution?.supportAuraPower || 0);
    }
    return aura;
}

export function getMentalLinks(hero, level = hero.level || hero.config?.level || 1, recipient = null, origin = recipient) {
    if (!isCadenceSupport(hero, 'profesor_x') || hero.stunTimer > 0 || !hero.game?.heroes?.includes(hero)) return [];
    const radius = getEvolvedSupportAura(hero, level).range;
    // Count deployed attackers, not their effective stats: aura evaluation must not recurse.
    return hero.game.heroes.filter((ally) => {
        // Placement previews substitute one position without changing the deployed formation.
        const point = ally === recipient ? origin : ally;
        return ally !== hero && !auraConfig(ally)?.type && !(ally.stunTimer > 0)
            && Math.hypot(hero.x - point.x, hero.y - point.y) <= radius;
    });
}

function hasNetwork(hero) {
    return hero?.id === 'black_panther' && hero.config?.special?.supportAura?.type === 'damage';
}

function networkState(hero) {
    const deployed = Boolean(hero.game?.heroes?.includes(hero));
    let state = hero.supportNetworkState;
    // Moving or redeploying must not carry an active burst to a different formation.
    if (!state || !deployed || state.x !== hero.x || state.y !== hero.y) {
        state = { x: hero.x, y: hero.y, charge: 0, remaining: 0, cooldown: VIBRANIUM_NETWORK.cooldown };
        hero.supportNetworkState = state;
    }
    return state;
}

export function getEffectiveSupportAura(hero, { level = hero.level || hero.config?.level || 1, recipient = null, origin = recipient } = {}) {
    const aura = getEvolvedSupportAura(hero, level);
    if (recipient && isCadenceSupport(hero, 'profesor_x') && !getMentalLinks(hero, level, recipient, origin).includes(recipient)) return null;
    if (aura) aura.power *= getSupportAuraPowerMultiplier(hero, level, recipient, origin);
    if (aura && hasPriorityOrder(hero)) aura.targetCondition = 'mark';
    if (aura && isRangeSupport(hero, 'mister_fantastic')) aura.outerRangeOnly = true;
    if (aura && isRangeSupport(hero, 'wong')) {
        aura.detectStealth = !(hero.stunTimer > 0) && (!hero.game?.heroes?.includes(hero)
            || pulseState(hero).elapsed >= SANCTUARY_PULSE.rest);
    }
    return aura;
}

export function getSupportAuraPowerMultiplier(hero, level = hero.level || hero.config?.level || 1, recipient = null, origin = recipient) {
    if (hasPriorityOrder(hero)) return PRIORITY_ORDER.powerMultiplier;
    if (isCadenceSupport(hero, 'wasp')) {
        if (!hero.game?.heroes?.includes(hero)) return PYM_LINK.powerMultiplier;
        return !(hero.stunTimer > 0) && pulseState(hero).elapsed >= PYM_LINK.rest ? PYM_LINK.powerMultiplier : 0;
    }
    if (isCadenceSupport(hero, 'profesor_x')) {
        if (!hero.game?.heroes?.includes(hero)) return MENTAL_LINK.perAllyMultiplier;
        const count = getMentalLinks(hero, level, recipient, origin).length;
        return count ? Math.min(MENTAL_LINK.perAllyMultiplier, MENTAL_LINK.budgetMultiplier / count) : 0;
    }
    return hasNetwork(hero) && networkState(hero).remaining > 0 && !(hero.stunTimer > 0)
        ? VIBRANIUM_NETWORK.powerMultiplier : 1;
}

export function applySupportAurasToStats(stats, recipient, origin = recipient) {
    const bonuses = { damage: 0, fireRate: 0, range: 0 };
    let outerRange = 0;
    for (const source of recipient.game?.heroes || []) {
        if (source === recipient || source.stunTimer > 0) continue;
        const aura = getEffectiveSupportAura(source, { recipient, origin });
        if (!aura?.type || Math.hypot(source.x - origin.x, source.y - origin.y) > aura.range) continue;
        const power = Math.max(0, Number(aura.power || 0));
        if (!aura.targetCondition && Object.hasOwn(bonuses, aura.type)) bonuses[aura.type] += power;
        if (aura.type === 'range' && aura.outerRangeOnly) outerRange += power;
        if (aura.detectStealth) stats.canSeeStealth = true;
    }
    // Same-stat auras add; items, evolutions and target-conditional damage keep their own layer.
    for (const key of Object.keys(bonuses)) {
        if (typeof stats[key] === 'number') stats[key] *= 1 + bonuses[key];
    }
    if (outerRange > 0) {
        // Reed changes only the outer boundary, even when other range auras also contribute.
        stats.rangeGeometryScale = (stats.rangeGeometryScale || 1)
            * (1 + bonuses.range - outerRange) / (1 + bonuses.range);
    }
    return stats;
}

export function getPriorityOrderDamageMultiplier(attacker, target) {
    const allies = attacker?.game?.heroes || [];
    if (!target?.isAlive || target.hasReachedEnd
        || !target.debuffs?.some((effect) => effect.type === 'mark' && effect.duration > 0
            && (!effect.fieldActive || effect.fieldActive()))
        || !allies.includes(attacker) || auraConfig(attacker)?.type || attacker.stunTimer > 0) return 1;
    let multiplier = 1;
    for (const source of allies) {
        if (source === attacker || !hasPriorityOrder(source) || source.stunTimer > 0) continue;
        const aura = getEffectiveSupportAura(source);
        if (Math.hypot(source.x - attacker.x, source.y - attacker.y) <= aura.range) multiplier *= 1 + aura.power;
    }
    return multiplier;
}

export function updateSupportAura(hero, dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    const pulse = timedPulse(hero);
    if (pulse) {
        const state = pulseState(hero);
        const cycle = pulse.rest + pulse.duration;
        const elapsed = state.elapsed + dt;
        const pulses = Math.floor((elapsed + pulse.duration) / cycle)
            - Math.floor((state.elapsed + pulse.duration) / cycle);
        state.elapsed = elapsed % cycle;
        if (pulses > 0 && !(hero.stunTimer > 0) && hero.combatStats) {
            const radius = getEvolvedSupportAura(hero).range;
            const hasRecipient = hero.game?.heroes?.some((ally) => ally !== hero && !auraConfig(ally)?.type
                && !(ally.stunTimer > 0) && Math.hypot(hero.x - ally.x, hero.y - ally.y) <= radius);
            if (hasRecipient) hero.combatStats.abilityActivations += pulses;
        }
        return;
    }
    if (!hasNetwork(hero)) return;
    const state = networkState(hero);
    state.remaining = Math.max(0, state.remaining - dt);
    state.cooldown = Math.max(0, state.cooldown - dt);
}

export function recordSupportAttack(attacker) {
    const allies = attacker.game?.heroes || [];
    if (!allies.includes(attacker) || attacker.isSupportAuraOnly?.() || attacker.stunTimer > 0) return;
    for (const source of allies) {
        if (source === attacker || !hasNetwork(source) || source.stunTimer > 0) continue;
        const state = networkState(source);
        if (state.cooldown > 0) continue;
        const aura = getEffectiveSupportAura(source);
        if (Math.hypot(source.x - attacker.x, source.y - attacker.y) > aura.range) continue;
        state.charge++;
        if (state.charge < VIBRANIUM_NETWORK.attacks) continue;
        state.charge = 0;
        state.remaining = VIBRANIUM_NETWORK.duration;
        state.cooldown = VIBRANIUM_NETWORK.cooldown;
        source.recordAbility?.();
    }
}

export function getSupportAuraDisplayState(hero) {
    if (hasPriorityOrder(hero)) {
        return { label: hero.stunTimer > 0 ? 'Orden suspendida' : 'Orden: requiere marca', progress: null, ready: !(hero.stunTimer > 0) };
    }
    if (isRangeSupport(hero, 'invisible_woman') || isRangeSupport(hero, 'mister_fantastic')) {
        const name = isRangeSupport(hero, 'mister_fantastic') ? 'Extension exterior' : 'Cobertura y deteccion';
        return { label: hero.stunTimer > 0 ? 'Campo suspendido' : name, progress: null, ready: !(hero.stunTimer > 0) };
    }
    if (isRangeSupport(hero, 'wong')) {
        const state = pulseState(hero);
        if (hero.stunTimer > 0) return { label: 'Sello suspendido', progress: 0, ready: false };
        const active = state.elapsed >= SANCTUARY_PULSE.rest;
        const remaining = (active ? SANCTUARY_PULSE.rest + SANCTUARY_PULSE.duration : SANCTUARY_PULSE.rest) - state.elapsed;
        return { label: `${active ? 'Deteccion' : 'Sello'}: ${remaining.toFixed(1)} s`,
            progress: active ? remaining / SANCTUARY_PULSE.duration : state.elapsed / SANCTUARY_PULSE.rest, ready: active };
    }
    if (isCadenceSupport(hero, 'nick_fury')) {
        const power = Math.round(getEffectiveSupportAura(hero).power * 100);
        return { label: hero.stunTimer > 0 ? 'Orden suspendida' : `Orden sostenida +${power}%`, progress: null, ready: !(hero.stunTimer > 0) };
    }
    if (isCadenceSupport(hero, 'wasp')) {
        const state = pulseState(hero);
        if (hero.stunTimer > 0) return { label: 'Enlace suspendido', progress: 0, ready: false };
        const active = state.elapsed >= PYM_LINK.rest;
        const remaining = (active ? PYM_LINK.rest + PYM_LINK.duration : PYM_LINK.rest) - state.elapsed;
        const power = Math.round(getEffectiveSupportAura(hero).power * 100);
        return active
            ? { label: `Pym +${power}% (${remaining.toFixed(1)} s)`, progress: remaining / PYM_LINK.duration, ready: true }
            : { label: `Pym: ${remaining.toFixed(1)} s`, progress: state.elapsed / PYM_LINK.rest, ready: false };
    }
    if (isCadenceSupport(hero, 'profesor_x')) {
        const count = getMentalLinks(hero).length;
        const power = Math.round(getEffectiveSupportAura(hero).power * 100);
        return { label: hero.stunTimer > 0 ? 'Enlace suspendido' : `Enlaces ${count}: +${power}% c/u`, progress: null, ready: count > 0 };
    }
    if (!hasNetwork(hero)) return null;
    const state = networkState(hero);
    const power = Math.round(getEffectiveSupportAura(hero).power * 100);
    if (hero.stunTimer > 0) return { label: 'Red suspendida', progress: 0, ready: false };
    if (state.remaining > 0) return { label: `Sobrecarga +${power}% (${state.remaining.toFixed(1)} s)`, progress: state.remaining / VIBRANIUM_NETWORK.duration, ready: true };
    if (state.cooldown > 0) return { label: `Red: ${state.cooldown.toFixed(1)} s`, progress: 1 - state.cooldown / VIBRANIUM_NETWORK.cooldown, ready: false };
    return { label: `Red ${state.charge}/${VIBRANIUM_NETWORK.attacks}`, progress: state.charge / VIBRANIUM_NETWORK.attacks, ready: false };
}
