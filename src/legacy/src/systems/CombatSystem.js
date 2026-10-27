import { TypeChart } from '../../data/TypeChart.js';
import { getRouteProgress } from '../utils/PathUtils.js';
import { isPointInRangePattern } from '../utils/RangePattern.js';

import { aggregateItemEffects } from './ItemEffectSystem.js';
import { getPriorityOrderDamageMultiplier } from './SupportAuraSystem.js';

export class CombatSystem {
    static applyImpact(projectile, target, attacker, resourceManager) {
        if (!target?.isAlive || target.hasReachedEnd) return { damage: 0, killed: false, hits: 0 };

        const primary = CombatSystem.applyDamage(projectile, target, attacker, resourceManager, 1);
        let hits = 1;

        const impactItems = projectile.impactItems ?? attacker?.items;
        if (!projectile.secondaryEntity && impactItems?.length) {
            CombatSystem.applyItemEffects(attacker, target, resourceManager, impactItems);
        }

        if (target.isAlive) {
            CombatSystem.applyEffects(projectile.effects, target, attacker);
        }

        const enemies = attacker?.game?.enemies || [];
        if (projectile.beaconRadius > 0) {
            const radius = projectile.beaconRadius;
            projectile.beaconRadius = 0;
            enemies.filter(enemy => enemy.isAlive && !enemy.hasReachedEnd && CombatSystem.distance(enemy, target) <= radius)
                .sort((a, b) => CombatSystem.distance(a, target) - CombatSystem.distance(b, target))
                .slice(0, 6).forEach(enemy => enemy.applyStatus?.({ type: 'reveal', duration: 3, power: 1 }, attacker));
            attacker?.game?.vfx?.addBurst(target.x, target.y, { radius, color: '#a78bfa' });
        }
        if (projectile.splashRadius > 0) {
            attacker?.game?.vfx?.addBurst(target.x, target.y, {
                color: projectile.color,
                radius: projectile.splashRadius,
                duration: 0.32
            });
            enemies
                .filter((enemy) => enemy !== target && enemy.isAlive && !enemy.hasReachedEnd && CombatSystem.distance(enemy, target) <= projectile.splashRadius)
                .forEach((enemy) => {
                    CombatSystem.applyDamage(projectile, enemy, attacker, resourceManager, projectile.splashFactor);
                    hits++;
                });
        }

        if (projectile.chainCount > 0) {
            let current = target;
            const visited = new Set([target]);
            for (let jump = 0; jump < projectile.chainCount; jump++) {
                const intercept = jump === 0 && projectile.interceptBounce && attacker?.id === 'red_guardian';
                const stats = intercept ? attacker.getEffectiveStats() : null;
                const next = enemies
                    .filter((enemy) => enemy.isAlive && !enemy.hasReachedEnd && !visited.has(enemy) && CombatSystem.distance(enemy, current) <= projectile.chainRange)
                    .filter(enemy => !intercept || (!enemy.hasReachedEnd && (!enemy.stealth || stats.canSeeStealth)
                        && isPointInRangePattern(attacker, enemy, stats.range, attacker.rangePattern, stats.rangeGeometryScale)))
                    .sort((a, b) => (intercept ? getRouteProgress(b) - getRouteProgress(a) : 0)
                        || CombatSystem.distance(a, current) - CombatSystem.distance(b, current))[0];
                if (!next) break;
                CombatSystem.applyDamage(projectile, next, attacker, resourceManager, projectile.chainFactor ** (jump + 1));
                if (intercept && getRouteProgress(next) > getRouteProgress(target) && next.isAlive) {
                    next.applyStatus?.({ type: 'stun', duration: 0.3, power: 1 }, attacker);
                    attacker.recordAbility?.();
                }
                attacker?.game?.vfx?.addBeam(current, next, {
                    color: projectile.color,
                    width: 3,
                    duration: 0.16
                });
                visited.add(next);
                current = next;
                hits++;
            }
        }

        if (projectile.propagationCount > 0) {
            const propagated = CombatSystem.propagateImpact(projectile, target, attacker, resourceManager, enemies);
            hits += propagated;
        }

        attacker?.abilitySystem?.energyReserveKit?.onImpact(projectile, target);
        return { ...primary, hits };
    }

    static propagateImpact(projectile, target, attacker, resourceManager, enemies = []) {
        const candidates = enemies
            .filter((enemy) => enemy !== target && enemy.isAlive && !enemy.hasReachedEnd && CombatSystem.distance(enemy, target) <= projectile.propagationRadius)
            .sort((a, b) => CombatSystem.distance(a, target) - CombatSystem.distance(b, target))
            .slice(0, projectile.propagationCount);

        candidates.forEach((enemy) => {
            CombatSystem.applyDamage(projectile, enemy, attacker, resourceManager, projectile.propagationFactor);
            if (enemy.isAlive) CombatSystem.applyEffects(projectile.effects, enemy, attacker);
            attacker?.game?.vfx?.addBeam?.(target, enemy, {
                color: projectile.color,
                width: 2,
                duration: 0.22
            });
        });

        return candidates.length;
    }

    static applyDamage(projectile, target, attacker, resourceManager, factor) {
        if (!target?.isAlive || target.hasReachedEnd) return { damage: 0, killed: false };

        const typeMultiplier = TypeChart[projectile.attackerType]?.[target.category] || 1;
        const markMultiplier = target.getDamageTakenMultiplier?.() || 1;
        const orderMultiplier = getPriorityOrderDamageMultiplier(attacker, target);
        const modifiedDamage = projectile.damage * factor * typeMultiplier * markMultiplier * orderMultiplier;
        const damage = Number.isFinite(projectile.damageCap) ? Math.min(modifiedDamage, Math.max(0, projectile.damageCap)) : modifiedDamage;
        const barrierBefore = target.behavior?.barrier || 0;
        const result = target.takeDamage(damage, {
            armorPenetration: projectile.armorPenetration || 0,
            attackerType: projectile.attackerType,
            fractional: Number.isFinite(projectile.damageCap),
            direct: true
        });

        if (barrierBefore > 0 && target.behavior.barrier === 0)
            attacker?.abilitySystem?.energyReserveKit?.onBarrierBroken(projectile);
        CombatSystem.recordDamageResult(projectile, target, attacker, resourceManager, result, factor);
        return result;
    }

    static executeNonBoss(target, attacker, resourceManager, color, secondaryEntity = false) {
        if (!target?.isAlive || target.hasReachedEnd || !Number.isFinite(target.hp) || target.hp <= 0
            || target.isBoss || target.isFinalBoss || target.isMiniBoss
            || target.config?.isBoss || target.config?.isFinalBoss || target.config?.isMiniBoss) {
            return { damage: 0, killed: false };
        }

        // Execution bypasses defenses; only remaining health counts as damage.
        const result = { damage: target.hp, killed: true };
        target.hp = 0;
        target.isAlive = false;
        CombatSystem.recordDamageResult({ attackerType: attacker?.category, color, secondaryEntity }, target, attacker, resourceManager, result);
        return result;
    }

    static recordDamageResult(projectile, target, attacker, resourceManager, result, factor = 1) {
        CombatSystem.addDamageText(projectile, target, attacker, result);
        CombatSystem.addImpactVfx(projectile, target, attacker, result, factor);
        attacker?.recordDamage?.(result.damage);
        if (result.killed) CombatSystem.creditKill(target, attacker, resourceManager, Boolean(projectile.secondaryEntity));
    }

    static buildImpactVfxState(projectile = {}, result = {}, factor = 1) {
        if (!result?.damage) return null;
        const typeColors = {
            Tecnologico: '#40c9ff',
            'TecnolÃ³gico': '#40c9ff',
            Tecnológico: '#40c9ff',
            Mistico: '#b865ff',
            'MÃ­stico': '#b865ff',
            Místico: '#b865ff',
            Urbano: '#e63946',
            Cosmico: '#ff8bd1',
            'CÃ³smico': '#ff8bd1',
            Cósmico: '#ff8bd1',
            Mutante: '#c7f464'
        };
        const killed = Boolean(result.killed);
        const critical = Boolean(projectile.critical || projectile.isCrit);
        const baseColor = projectile.color || typeColors[projectile.attackerType] || '#ffffff';
        const radius = killed ? 34 : critical ? 28 : Math.max(12, 18 * Math.max(0.45, Math.min(1, factor)));

        return {
            color: killed ? '#ffdf6f' : critical ? '#ff6b6b' : baseColor,
            radius,
            duration: killed ? 0.34 : critical ? 0.28 : 0.18,
            kind: killed ? 'ko' : critical ? 'critical' : 'hit'
        };
    }

    static addImpactVfx(projectile, target, attacker, result, factor = 1) {
        const state = CombatSystem.buildImpactVfxState(projectile, result, factor);
        if (!state || !target || !attacker?.game?.vfx?.addBurst) return;
        if (attacker.game.reduceMotion === true) return;
        attacker.game.vfx.addBurst(target.x, target.y, state);
    }

    static addDamageText(projectile, target, attacker, result) {
        if (!result?.damage || !attacker?.game?.vfx?.addFloatingText || !target) return;
        if (attacker.game.showCombatText === false) return;
        const critical = projectile.critical || projectile.isCrit;
        const killed = result.killed;
        const color = killed ? '#ffdf6f' : critical ? '#ff6b6b' : projectile.color || '#ffffff';
        const prefix = killed ? 'KO ' : critical ? 'CRIT ' : '';
        attacker.game.vfx.addFloatingText(
            target.x,
            target.y - 18,
            `${prefix}${Math.round(result.damage)}`,
            {
                color,
                size: killed || critical ? 17 : 13,
                duration: killed ? 0.9 : 0.68,
                velocityY: killed ? -42 : -30
            }
        );
    }

    static applyEffects(effects = [], target, attacker) {
        effects.forEach((effect) => {
            if (CombatSystem.random(attacker) >= (effect.chance ?? 1)) return;
            if (effect.type === 'heal') return;

            if (target.applyStatus) {
                target.applyStatus(effect, attacker);
            } else {
                target.applyDebuff?.(effect.type, effect.duration, effect.power);
            }
        });
    }

    static creditKill(target, attacker, resourceManager, secondaryEntity = false) {
        if (!attacker || target.killCredited) return;
        target.killCredited = true;

        if (attacker.recordKill) {
            attacker.recordKill(resourceManager, target, secondaryEntity);
            return;
        }

        attacker.killCount = (attacker.killCount || 0) + 1;
    }

    static applyItemEffects(attacker, target, resourceManager, items = attacker.items) {
        const itemEffects = aggregateItemEffects(items);
        if (itemEffects.onHitCredit) {
            resourceManager?.addCredits(itemEffects.onHitCredit);
            attacker.recordGold?.(itemEffects.onHitCredit);
        }
        if (itemEffects.onHitCreditPct) {
            const reward = Number(target?.reward ?? target?.config?.reward ?? 0);
            const credits = Math.max(1, Math.ceil(reward * itemEffects.onHitCreditPct));
            if (Number.isFinite(reward) && reward > 0) {
                resourceManager?.addCredits(credits);
                attacker.recordGold?.(credits);
            }
        }
        items.forEach((item) => {
            if (item.flags?.includes('slow_on_armor') && target.armor > 0) {
                target.applyStatus?.({ type: 'slow', duration: 1, power: 0.5 }, attacker)
                    ?? target.applyDebuff?.('slow', 1, 0.5);
            }
        });
    }

    static random(attacker) {
        return attacker?.game?.random?.next?.() ?? Math.random();
    }

    static distance(a, b) {
        return Math.hypot(a.x - b.x, a.y - b.y);
    }
}
