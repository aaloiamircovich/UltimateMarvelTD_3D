import { Projectile } from './Projectile.js';
import { getCachedImage } from '../rendering/ImageCache.js';
import { SpriteAnimator } from '../rendering/SpriteAnimator.js';
import { HeroAbilitySystem } from '../systems/HeroAbilitySystem.js';
import { aggregateItemEffects } from '../systems/ItemEffectSystem.js';
import { applyEvolutionStats } from '../systems/EvolutionSystem.js';
import { applySignatureStats, buildSignatureAttackContext, renderSignatureVisuals, resolveSignatureAfterAttack, resolveSignatureOnKill, updateSignatureTimers } from '../systems/ItemSignatureSystem.js';
import { getHeroRangePattern, isPointInRangePattern } from '../utils/RangePattern.js';
import { getScaledSupportAura, normalizeHeroLevel } from '../utils/HeroLevel.js';
import { TERRAIN } from '../utils/TerrainRules.js';
import { resolveHeroVisual } from '../utils/HeroVisuals.js';
import { applySupportAurasToStats, recordSupportAttack, updateSupportAura } from '../systems/SupportAuraSystem.js';

export const SUPPORT_AURA_VISUALS = {
    damage: { color: '#fca311' },
    fireRate: { color: '#40c9ff' },
    range: { color: '#b865ff' }
};

export function getSupportAuraVisual(type = 'damage') {
    return SUPPORT_AURA_VISUALS[type] || { color: '#46d369' };
}

export function buildHeroTargetIntent(hero, enemies = [], stats = null) {
    if (!hero?.getBestTarget) return null;
    const effectiveStats = stats || hero.getEffectiveStats?.();
    if (!effectiveStats) return null;
    const target = hero.getBestTarget(enemies, effectiveStats);
    if (!target) return null;

    const distance = Math.hypot((target.x || 0) - (hero.x || 0), (target.y || 0) - (hero.y || 0));
    const threat = Math.max(1, Number(target.threat || 1));
    return {
        target,
        targetId: target.uid || target.id || target.name || 'target',
        targetName: target.name || target.config?.name || 'Enemigo',
        priority: hero.targetingPriority || hero.config?.targetingPriority || 'Primero',
        distance: Math.round(distance),
        inRange: isPointInRangePattern(hero, target, Number(effectiveStats.range || hero.range || 0), getHeroRangePattern(hero), effectiveStats.rangeGeometryScale),
        danger: target.isBoss || threat >= 5 ? 'critical' : threat >= 4 ? 'high' : threat >= 3 ? 'guarded' : 'low',
        color: target.isBoss ? '#ffdf6f' : threat >= 4 ? '#ff7b3d' : '#40c9ff'
    };
}

export class Hero {
    constructor(config, x, y, game) {
        this.game = game;
        this.config = { ...config };
        this.id = config.id;
        this.name = config.name;
        this.category = config.category || 'Urbano';
        this.x = x;
        this.y = y;
        this.level = normalizeHeroLevel(config.level || 1);
        this.damage = config.damage || 10;
        this.range = config.range || 120;
        this.rangePattern = config.rangePattern || config.special?.rangePattern || 'circle';
        this.fireRate = config.fireRate || 1;
        this.critChance = config.critChance || 5;
        this.attackType = config.attackType || this.category;
        this.baseAllowedTerrains = [...(config.allowedTerrains || [1])];
        this.allowedTerrains = [...this.baseAllowedTerrains];
        this.targetingPriority = config.targetingPriority || 'Primero';
        this.deployedCost = 0;
        this.lastRepositionWave = -1;
        this.timer = 0;
        this.items = [];
        this.consecutiveHits = 0;
        this.lastTargetId = null;
        this.signatureState = {};
        this.killCount = 0;
        this.combatStats = {
            damageDealt: 0,
            kills: 0,
            shots: 0,
            crits: 0,
            goldGenerated: 0,
            abilityActivations: 0,
            controlSeconds: 0,
            armorBreaks: 0,
            marks: 0,
            detectionReveals: 0
        };
        this.size = 36;
        this.flashTimer = 0;
        this.stunTimer = 0;
        this.visualTime = 0;
        this.activeVisualId = null;
        this.animator = null;
        this.legacyImage = null;
        this.syncVisual();
        this.abilitySystem = new HeroAbilitySystem(this);
    }

    syncVisual() {
        const resolved = resolveHeroVisual(this.config, this.game);
        const visualId = `${resolved.id}:${resolved.sprite || ''}`;
        if (this.activeVisualId === visualId) return;

        const previousFacing = this.animator?.facing || resolved.visual?.defaultDirection || 'south';
        this.activeVisualId = visualId;
        this.animator = resolved.visual ? new SpriteAnimator(resolved.visual) : null;
        if (this.animator) this.animator.facing = previousFacing;
        this.legacyImage = getCachedImage(resolved.sprite);
    }

    getEffectiveStats(auraOrigin = this) {
        this.allowedTerrains = [...this.baseAllowedTerrains];
        const stats = {
            damage: this.damage,
            fireRate: this.fireRate,
            range: this.range,
            critChance: this.critChance,
            critDamage: 2,
            canSeeStealth: this.config.canSeeStealth || false
        };

        const progression = this.game.progression?.getHeroBonuses?.(this.id);
        if (progression) {
            stats.damage *= 1 + progression.damage;
            stats.fireRate *= 1 + progression.fireRate;
            stats.range *= 1 + progression.range;
            stats.critChance += progression.critChance;
        }
        applyEvolutionStats(stats, this.game.progression?.getHeroEvolution?.(this.id));

        const itemEffects = aggregateItemEffects(this.items);
        stats.damage *= 1 + (itemEffects.damagePct || 0);
        stats.fireRate *= 1 + (itemEffects.fireRatePct || 0);
        stats.range *= 1 + (itemEffects.rangePct || 0);
        stats.critChance += itemEffects.critChance || 0;
        stats.critDamage += itemEffects.critDamageBonus || 0;
        if (itemEffects.detectStealth) stats.canSeeStealth = true;
        if (itemEffects.allowWater && !this.allowedTerrains.includes(0)) this.allowedTerrains.push(0);
        if (itemEffects.allowGrass && !this.allowedTerrains.includes(TERRAIN.grass)) this.allowedTerrains.push(TERRAIN.grass);
        if (itemEffects.allowMountain && !this.allowedTerrains.includes(TERRAIN.mountain)) this.allowedTerrains.push(TERRAIN.mountain);

        const specialStats = this.config.special?.statModifiers || {};
        stats.damage *= 1 + (specialStats.damagePct || 0);
        stats.fireRate *= 1 + (specialStats.fireRatePct || 0);
        stats.range *= 1 + (specialStats.rangePct || 0);
        stats.critChance += specialStats.critChance || 0;
        if (specialStats.detectStealth) stats.canSeeStealth = true;
        if (specialStats.allowWater && !this.allowedTerrains.includes(0)) this.allowedTerrains.push(0);

        if (this.game.resourceManager.lives <= 10) {
            stats.damage *= 1 + (itemEffects.lowLifeDamagePct || 0);
            stats.fireRate *= 1 + (itemEffects.lowLifeFireRatePct || 0);
        }

        this.abilitySystem.applyStatModifiers(stats);
        this.applySupportAuras(stats, auraOrigin);
        const finalStats = applySignatureStats(this.game.teamSynergy?.applyHeroStats(this, stats) || stats, this);
        if (this.id === 'deadpool' && this.abilitySystem.martialKit.weapon === 1) finalStats.range = Math.min(finalStats.range, 90);
        return finalStats;
    }

    update(dt, enemies, projectiles) {
        this.syncVisual();
        this.abilitySystem.energyReserveKit?.update(dt);
        this.abilitySystem.mutantKit.checkOpticPosition();
        this.abilitySystem.cosmicKit.checkTrajectoryPosition();
        this.abilitySystem.cosmicKit.checkEnergyPosition();
        this.abilitySystem.avengerKit.checkDensityPosition();
        this.abilitySystem.mutantKit.checkPhoenixPosition();
        this.abilitySystem.mutantKit.updatePursuit(dt);
        this.abilitySystem.focusKit?.update(dt, enemies);
        this.abilitySystem.martialKit?.update(dt);
        this.abilitySystem.cosmicKit.checkRoots();
        this.abilitySystem.controlKit?.update(dt);
        this.abilitySystem.elementalKit?.update(dt);
        this.abilitySystem.coastalKit?.update(dt);
        this.abilitySystem.psychicKit?.update(dt);
        this.abilitySystem.vigilanceKit?.update(dt);
        this.abilitySystem.mysticKit?.update(dt);
        this.abilitySystem.fateKit?.update(dt);
        this.abilitySystem.darkfireKit?.update(dt);
        this.abilitySystem.arcaneStormKit?.update(dt);
        this.abilitySystem.streetKit.checkHunterPosition();
        this.abilitySystem.mutantKit.checkWeather();
        this.abilitySystem.fieldDevice?.update(dt, enemies);
        if (this.stunTimer > 0 && this.id === 'punisher') this.abilitySystem.streetKit.suppression = null;
        if (this.stunTimer > 0 && this.id === 'war_machine') this.abilitySystem.avengerKit.salvo = null;
        updateSignatureTimers(this, dt);
        updateSupportAura(this, dt);
        this.timer += dt;
        this.flashTimer = Math.max(0, this.flashTimer - dt);
        this.stunTimer = Math.max(0, this.stunTimer - dt);
        this.visualTime += dt;
        this.animator?.update(dt);
        if (this.stunTimer > 0) return;
        if (this.isSupportAuraOnly()) return;

        let stats = this.getEffectiveStats();
        this.abilitySystem.update(dt, enemies, stats, projectiles);
        if (['moon_knight', 'captain_marvel', 'jean_grey'].includes(this.id)) stats = this.getEffectiveStats();

        if (this.timer >= 1 / stats.fireRate && (this.abilitySystem.martialKit?.canAttack() ?? true)
            && (this.abilitySystem.energyReserveKit?.canAttack() ?? true)
            && this.abilitySystem.cosmicKit.canAttack() && this.abilitySystem.avengerKit.canAttack() && this.abilitySystem.mutantKit.canAttack()
            && (this.abilitySystem.psychicKit?.canAttack() ?? true)) {
            const target = this.getBestTarget(enemies, stats);
            if (target) {
                this.shoot(target, stats, projectiles);
                this.timer = 0;
                this.flashTimer = 0.08;
            }
        }
    }

    getBestTarget(enemies, stats) {
        const inRange = enemies.filter((enemy) => {
            if (!enemy.isAlive) return false;
            if (this.id === 'mantis' && enemy.debuffs?.some(effect => effect.type === 'sleep' && effect.duration > 0)) return false;
            if (enemy.stealth && !stats.canSeeStealth) return false;
            return isPointInRangePattern(this, enemy, stats.range, this.rangePattern, stats.rangeGeometryScale);
        });

        if (inRange.length === 0) return null;

        switch (this.targetingPriority) {
            case 'Primero':
                return inRange.sort((a, b) => b.distanceTravelled - a.distanceTravelled)[0];
            case 'Último':
                return inRange.sort((a, b) => a.distanceTravelled - b.distanceTravelled)[0];
            case 'Fuerte':
                return inRange.sort((a, b) => b.hp - a.hp)[0];
            case 'Débil':
                return inRange.sort((a, b) => a.hp - b.hp)[0];
            case 'Rápido':
                return inRange.sort((a, b) => b.speed - a.speed || b.distanceTravelled - a.distanceTravelled)[0];
            case 'Sigilo':
                return inRange.sort((a, b) => Number(b.stealth) - Number(a.stealth) || b.distanceTravelled - a.distanceTravelled)[0];
            case 'Jefe':
                return inRange.sort((a, b) => Number(b.isBoss) - Number(a.isBoss) || (b.threat || 1) - (a.threat || 1) || b.distanceTravelled - a.distanceTravelled)[0];
            default:
                return inRange[0];
        }
    }

    shoot(target, stats, projectiles) {
        if (this.isSupportAuraOnly()) return;
        if (this.abilitySystem.martialKit?.canAttack() === false) return;
        if (this.abilitySystem.energyReserveKit?.canAttack() === false) return;
        if (!this.abilitySystem.cosmicKit.canAttack() || !this.abilitySystem.avengerKit.canAttack() || !this.abilitySystem.mutantKit.canAttack()) return;
        if (this.abilitySystem.psychicKit?.canAttack() === false) return;
        if (this.id === 'mantis' && target?.debuffs?.some(effect => effect.type === 'sleep' && effect.duration > 0)) return;
        this.animator?.faceVector(target.x - this.x, target.y - this.y);
        this.animator?.playAttack();

        const signatureContext = buildSignatureAttackContext(this, target, stats);
        const attackStats = signatureContext.stats || stats;
        const roll = this.game?.random?.next?.() ?? Math.random();
        const preparedCrit = Math.max(this.abilitySystem.focusKit?.criticalMultiplier(target) || 0,
            this.abilitySystem.fateKit?.criticalMultiplier(target) || 0,
            this.abilitySystem.darkfireKit?.criticalMultiplier(target) || 0,
            this.abilitySystem.martialKit?.criticalMultiplier(target) || 0);
        const isCrit = preparedCrit > 0 || roll * 100 < attackStats.critChance;
        let finalDamage = isCrit ? attackStats.damage * Math.max(1, preparedCrit, attackStats.critDamage || 2) : attackStats.damage;
        finalDamage *= this.abilitySystem.getAttackDamageMultiplier(target);
        this.combatStats.shots++;
        if (isCrit) this.combatStats.crits++;
        // Native income belongs to this primary shot, never to secondary impacts or DoT.
        this.generateEconomyOnHit(target);

        const itemEffects = aggregateItemEffects(this.items);
        finalDamage *= this.getConditionalItemDamageMultiplier(target, itemEffects);
        if (itemEffects.consecutiveDamagePct) {
            if (this.lastTargetId === target.uid) {
                this.consecutiveHits++;
                finalDamage *= 1 + this.consecutiveHits * itemEffects.consecutiveDamagePct;
            } else {
                this.consecutiveHits = 0;
                this.lastTargetId = target.uid;
            }
        }

        const projectileConfig = {
            attacker: this,
            damage: finalDamage,
            critical: isCrit,
            attackerType: this.category,
            effects: this.getProjectileEffects(target),
            ...this.getProjectileProfile(attackStats, target),
            color: this.getProjectileColor(),
            radius: isCrit ? 7 : 5,
            visualStyle: this.getProjectileVisualStyle()
        };
        this.abilitySystem.energyReserveKit?.prepareProjectile(projectileConfig, target, attackStats);
        if (this.game?.spawnProjectile) this.game.spawnProjectile(this.x, this.y, target, projectileConfig);
        else projectiles.push(new Projectile(this.x, this.y, target, projectileConfig));
        this.abilitySystem.onAttack(target, attackStats, projectileConfig, projectiles);
        resolveSignatureAfterAttack(this, target, attackStats, projectileConfig, projectiles, { ...signatureContext, isCrit });
        recordSupportAttack(this);
    }

    getProjectileEffects(target = null) {
        const effects = [];

        effects.push(...this.abilitySystem.getAttackEffects(target));
        effects.push(...(this.config.special?.attackEffects || [])
            .filter((effect) => effect.type !== 'heal' && !this.abilitySystem.martialKit?.suppressesNativeEffect(effect, target))
            .map((effect) => this.abilitySystem.avengerKit.prepareNativeEffect(effect)));
        const itemEffects = aggregateItemEffects(this.items);
        if (itemEffects.slowChance) effects.push({ type: 'slow', duration: 1.2, power: itemEffects.slowPower || 0.2, chance: itemEffects.slowChance });
        if (itemEffects.armorBreakChance) effects.push({ type: 'armorBreak', duration: 3, power: itemEffects.armorBreakPower || 0.15, chance: itemEffects.armorBreakChance });
        if (itemEffects.burnChance) {
            const scalesWithAttack = itemEffects.burnAttackDamagePct !== undefined;
            effects.push({
                type: 'burn', duration: itemEffects.burnDuration ?? 4, chance: itemEffects.burnChance,
                power: scalesWithAttack ? itemEffects.burnAttackDamagePct : (itemEffects.burnPower ?? 0.018),
                ...(scalesWithAttack ? { damageBasis: 'attackDamage' } : {})
            });
        }
        if (itemEffects.poisonChance) effects.push({ type: 'poison', duration: itemEffects.poisonDuration || 4, power: itemEffects.poisonPower || 0.01, stacks: itemEffects.poisonStacks || 1, chance: itemEffects.poisonChance });
        if (itemEffects.curseChance) effects.push({ type: 'curse', duration: itemEffects.curseDuration || 4, power: itemEffects.cursePower || 0.01, chance: itemEffects.curseChance });
        if (itemEffects.stunChance) effects.push({ type: 'stun', duration: itemEffects.stunDuration || 0.25, power: 1, chance: itemEffects.stunChance });

        return effects;
    }

    getConditionalItemDamageMultiplier(target, itemEffects = {}) {
        let multiplier = 1;
        const statuses = target?.debuffs || [];
        const hasStatus = (types) => statuses.some((status) => types.includes(status.type));
        if (itemEffects.bossDamagePct && target?.isBoss) multiplier *= 1 + itemEffects.bossDamagePct;
        if (itemEffects.armorDamagePct && ((target?.armor || 0) > 0 || (target?.barrier || 0) > 0)) multiplier *= 1 + itemEffects.armorDamagePct;
        if (itemEffects.damageToControlledPct && hasStatus(['slow', 'stun', 'web'])) multiplier *= 1 + itemEffects.damageToControlledPct;
        if (itemEffects.damageToBurnedPct && hasStatus(['burn'])) multiplier *= 1 + itemEffects.damageToBurnedPct;
        if (itemEffects.damageToCursedPct && hasStatus(['curse'])) multiplier *= 1 + itemEffects.damageToCursedPct;
        if (itemEffects.statusDamagePct && statuses.length) {
            const cap = Number.isFinite(itemEffects.statusDamageCap) ? itemEffects.statusDamageCap : 0.5;
            multiplier *= 1 + Math.min(cap, itemEffects.statusDamagePct * statuses.length);
        }

        const distance = Math.hypot((target?.x || 0) - this.x, (target?.y || 0) - this.y);
        if (itemEffects.longRangeDamagePct && distance >= (itemEffects.longRangeThreshold || 150)) multiplier *= 1 + itemEffects.longRangeDamagePct;
        if (itemEffects.closeRangeDamagePenaltyPct && distance < (itemEffects.closeRangeThreshold || 120)) multiplier *= 1 - itemEffects.closeRangeDamagePenaltyPct;
        return Math.max(0.1, multiplier);
    }

    getProjectileProfile(stats = this.getEffectiveStats(), target) {
        const profiles = {
            capitan_america: { chainCount: 2, chainRange: 115, chainFactor: 0.6, returning: true },
            thor: { chainCount: 3, chainRange: 130, chainFactor: 0.7 },
            moon_knight: { returning: true }
        };
        const base = { ...(profiles[this.id] || {}), ...(this.config.special?.projectileProfile || {}), ...this.abilitySystem.getProjectileProfile() };
        const itemEffects = aggregateItemEffects(this.items);
        return {
            ...base,
            chainCount: (base.chainCount || 0) + Math.round(itemEffects.chainCount || 0),
            chainRange: Math.max(base.chainRange || 0, itemEffects.chainRange || 0),
            chainFactor: Math.max(base.chainFactor || 0, itemEffects.chainFactor || 0),
            splashRadius: Math.max(base.splashRadius || 0, itemEffects.splashRadius || 0),
            splashFactor: Math.max(base.splashFactor || 0, itemEffects.splashFactor || 0),
            propagationCount: base.propagationCount || 0,
            propagationRadius: base.propagationRadius || 90,
            propagationFactor: base.propagationFactor || 0.35,
            armorPenetration: Math.min(0.85, (base.armorPenetration || 0) + (itemEffects.armorPenetration || 0) + (stats.armorPenetration || 0)
                + (this.abilitySystem.focusKit?.penetration(target) || 0))
        };
    }

    recordDamage(amount) {
        this.combatStats.damageDealt += Math.max(0, amount || 0);
    }

    recordKill(resourceManager, target = null, secondaryEntity = false) {
        this.combatStats.kills++;
        this.killCount++;
        if (secondaryEntity) return;
        this.abilitySystem.onKill(target);
        resolveSignatureOnKill(this, target);
    }

    isSupportAuraOnly() {
        return Boolean(this.config.special?.supportAura?.type);
    }

    applySupportAuras(stats, origin = this) {
        applySupportAurasToStats(stats, this, origin);
    }

    generateEconomyOnHit(target) {
        const config = this.config.special?.economyOnHit;
        const reward = Number(target?.reward ?? target?.config?.reward ?? 0);
        const rewardPct = Number(config?.rewardPct || 0);
        if (!Number.isFinite(reward) || reward <= 0 || !Number.isFinite(rewardPct) || rewardPct <= 0) return;
        const credits = Math.max(1, Math.ceil(reward * rewardPct));
        this.game?.resourceManager?.addCredits?.(credits);
        this.recordGold(credits);
        this.game?.vfx?.addFloatingText?.(target.x, target.y - 34, `+$${credits}`, {
            color: '#f6d365',
            size: 12,
            duration: 0.7,
            velocityY: -24
        });
    }

    getStunResistance() {
        const diamond = this.id === 'emma_frost' && this.abilitySystem.psychicKit?.mode === 'diamond' ? 0.6 : 0;
        return Math.min(0.8, Math.max(diamond, Number(this.config.special?.stunResistance) || 0));
    }

    applyStun(duration = 1) {
        const effectiveDuration = Math.max(0, duration) * (1 - this.getStunResistance());
        this.stunTimer = Math.max(this.stunTimer, effectiveDuration);
        this.timer = 0;
    }

    recordGold(amount) {
        this.combatStats.goldGenerated += Math.max(0, amount || 0);
    }

    recordAbility() {
        this.combatStats.abilityActivations++;
    }

    recordStatusApplied(effect = {}, target = null) {
        const type = effect.type;
        const duration = Math.max(0, Number(effect.duration || 0));
        if (['slow', 'stun', 'sleep', 'web', 'knockback'].includes(type)) {
            this.combatStats.controlSeconds += duration || (type === 'knockback' ? 0.8 : 0);
        }
        if (type === 'armorBreak') this.combatStats.armorBreaks++;
        if (type === 'mark' || type === 'curse') this.combatStats.marks++;
        if (target?.stealth && (type === 'mark' || this.getEffectiveStats?.().canSeeStealth)) this.combatStats.detectionReveals++;
    }

    getProjectileVisualStyle() {
        const kitStyle = this.abilitySystem.getProjectileVisualStyle();
        if (kitStyle) return kitStyle;
        if (this.id === 'capitan_america') return 'shield';
        if (this.id === 'thor') return 'lightning';
        if (this.id === 'doctor_strange') return 'mystic';
        return this.config.special?.visualStyle || 'energy';
    }

    getProjectileColor() {
        const kitColor = this.abilitySystem.getProjectileColor();
        if (kitColor) return kitColor;
        const colors = {
            Tecnológico: '#40c9ff',
            Místico: '#b865ff',
            Urbano: '#ffffff',
            Cósmico: '#ff8bd1',
            Mutante: '#d7ff57'
        };
        return this.config.special?.projectileColor || colors[this.category] || '#ffd166';
    }

    render(ctx) {
        ctx.save();
        this.renderSupportAura(ctx);
        if (this.flashTimer > 0) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, 25, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(252, 163, 17, 0.25)';
            ctx.fill();
        }
        if (this.stunTimer > 0) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, 25, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 209, 102, 0.2)';
            ctx.fill();
            ctx.strokeStyle = '#ffd166';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        const offset = this.abilitySystem.psychicKit?.visualOffset() || this.abilitySystem.cosmicKit.visualOffset();
        ctx.save();
        if (offset && (offset.x || offset.y)) ctx.translate(offset.x, offset.y);
        const animated = this.animator?.render(ctx, this.x, this.y) || false;
        if (!animated && this.legacyImage?.complete && this.legacyImage.naturalWidth > 0) {
            const previousSmoothing = ctx.imageSmoothingEnabled;
            const previousQuality = ctx.imageSmoothingQuality;
            ctx.imageSmoothingEnabled = !ctx.__pixelArtCrisp;
            ctx.imageSmoothingQuality = ctx.__pixelArtCrisp ? 'low' : 'high';
            ctx.drawImage(this.legacyImage, this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
            ctx.imageSmoothingEnabled = previousSmoothing;
            ctx.imageSmoothingQuality = previousQuality;
        } else if (!animated) {
            this.renderFallback(ctx);
        }
        ctx.restore();
        this.abilitySystem.render(ctx);
        renderSignatureVisuals(this, ctx);

        ctx.fillStyle = '#ffd166';
        ctx.font = 'bold 10px Segoe UI';
        ctx.textAlign = 'center';
        ctx.fillText(`Lv.${this.level}`, this.x, this.y - 24);
        if (this.stunTimer > 0) {
            ctx.fillStyle = '#ffd166';
            ctx.font = '800 9px Segoe UI';
            ctx.fillText('STUN', this.x, this.y - 34);
        }
        this.renderAbilityIndicator(ctx);
        ctx.restore();
    }

    renderSupportAura(ctx) {
        const aura = getScaledSupportAura(this.config.special?.supportAura, this.level, this.config.rarity);
        if (!aura?.type) return;

        const radius = Math.max(28, Number(aura.range || this.range || 0));
        const visual = getSupportAuraVisual(aura.type);
        const reducedVfx = Boolean(this.game?.progression?.state?.settings?.reducedVfx
            || this.game?.progression?.state?.settings?.reduceMotion);
        const pulse = reducedVfx ? 0 : (Math.sin(this.visualTime * 2.4) + 1) / 2;
        const satelliteRadius = 19 + pulse * 5;
        const satelliteCount = aura.detectStealth ? 4 : 3;

        ctx.save();
        ctx.globalAlpha = reducedVfx ? 0.12 : 0.14 + pulse * 0.07;
        ctx.strokeStyle = visual.color;
        ctx.lineWidth = 2;
        ctx.setLineDash?.([8, 10]);
        ctx.beginPath();
        ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash?.([]);

        ctx.globalAlpha = reducedVfx ? 0.18 : 0.28 + pulse * 0.12;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(this.x, this.y, satelliteRadius, 0, Math.PI * 2);
        ctx.stroke();

        if (!reducedVfx) {
            ctx.fillStyle = visual.color;
            for (let index = 0; index < satelliteCount; index++) {
                const angle = this.visualTime * 1.35 + (Math.PI * 2 * index / satelliteCount);
                ctx.beginPath();
                ctx.arc(this.x + Math.cos(angle) * satelliteRadius, this.y + Math.sin(angle) * satelliteRadius, 2.8, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    }

    renderAbilityIndicator(ctx) {
        const state = this.abilitySystem.getDisplayState();
        if (!state || state.progress === null) return;

        const width = 30;
        const y = this.y + 23;
        ctx.fillStyle = 'rgba(5, 7, 11, 0.85)';
        ctx.fillRect(this.x - width / 2, y, width, 4);
        ctx.fillStyle = state.ready ? '#ffd166' : '#40c9ff';
        ctx.fillRect(this.x - width / 2, y, width * Math.max(0, Math.min(1, state.progress)), 4);
    }

    renderFallback(ctx) {
        ctx.fillStyle = this.getProjectileColor();
        ctx.beginPath();
        ctx.roundRect(this.x - 17, this.y - 17, 34, 34, 8);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#071018';
        ctx.font = 'bold 12px Segoe UI';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.name.charAt(0), this.x, this.y + 1);
    }
}
