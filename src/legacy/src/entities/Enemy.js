import { EnemyBehaviorSystem, SABOTAGE_SECONDS } from '../systems/EnemyBehaviorSystem.js';
import { SpriteAnimator } from '../rendering/SpriteAnimator.js';
import { DOT_TYPES, resolveStatusDamage } from '../utils/StatusDamage.js';
import { addPoisonStacks, updatePoisonStacks, consumePoisonStacks } from '../systems/PoisonStatus.js';

let enemyUid = 0;
const imageCache = new Map();

const STATUS_VISUALS = {
    stun: { color: '#ffd166', symbol: '!' },
    sleep: { color: '#b6ff9d', symbol: 'Z' },
    slow: { color: '#40c9ff', symbol: '~' },
    burn: { color: '#ff6b35', symbol: 'F' },
    poison: { color: '#69e58c', symbol: 'P' },
    curse: { color: '#b865ff', symbol: 'C' },
    bleed: { color: '#e63946', symbol: 'B' },
    armorBreak: { color: '#b8b8b8', symbol: '-' },
    mark: { color: '#d86cff', symbol: '+' },
    sabotage: { color: '#73e9ff', symbol: 'X' },
    barrierScan: { color: '#9c7cff', symbol: 'B' },
    reveal: { color: '#ff5d5d', symbol: 'R' },
    web: { color: '#f4f7ff', symbol: 'W' },
    haste: { color: '#46d369', symbol: '>' }
};

const TELEGRAPH_THEMES = {
    Tecnologico: { color: '#40c9ff', accent: '#dff6ff', dash: [12, 7], label: 'PROTOCOLO' },
    Tecnológico: { color: '#40c9ff', accent: '#dff6ff', dash: [12, 7], label: 'PROTOCOLO' },
    Mistico: { color: '#b865ff', accent: '#ffe8ff', dash: [4, 5], label: 'RITUAL' },
    Místico: { color: '#b865ff', accent: '#ffe8ff', dash: [4, 5], label: 'RITUAL' },
    Urbano: { color: '#e63946', accent: '#ffd166', dash: [9, 5], label: 'EMBOSCADA' },
    Cosmico: { color: '#ff8bd1', accent: '#ffe66d', dash: [14, 8], label: 'ANOMALIA' },
    Cósmico: { color: '#ff8bd1', accent: '#ffe66d', dash: [14, 8], label: 'ANOMALIA' },
    Mutante: { color: '#c7f464', accent: '#69e58c', dash: [7, 7], label: 'MUTACION' }
};

function buildEnemyTravelPath(path, level, renderedSize = 30) {
    if (!Array.isArray(path) || path.length < 2 || level?.rendering?.pathMode !== 'exact') return path;

    const previous = path[path.length - 2];
    const end = path[path.length - 1];
    const dx = Number(end.x) - Number(previous.x);
    const dy = Number(end.y) - Number(previous.y);
    const length = Math.hypot(dx, dy);
    if (!length) return path;

    const tileSize = Number(level?.rendering?.tileSize || 32);
    const configuredPadding = Number(level?.rendering?.goalOvershoot);
    const padding = Number.isFinite(configuredPadding) && configuredPadding >= 0
        ? configuredPadding
        : Math.max(12, Math.round(tileSize * 0.75), Math.round(Number(renderedSize || 30) * 0.22));

    if (padding <= 0) return path;

    return [
        ...path,
        {
            x: end.x + (dx / length) * padding,
            y: end.y + (dy / length) * padding
        }
    ];
}

export function buildBossTelegraphTheme(enemy = {}, phase = {}) {
    const category = phase.category || enemy.category || enemy.config?.category || 'Urbano';
    const base = TELEGRAPH_THEMES[category] || TELEGRAPH_THEMES.Urbano;
    const finalBoss = Boolean(enemy.isFinalBoss || enemy.config?.isFinalBoss);
    const color = phase.color || phase.telegraphColor || (finalBoss ? '#ff3b74' : base.color);
    return {
        ...base,
        color,
        accent: phase.accent || (finalBoss ? '#ffd166' : base.accent),
        dash: phase.dash || base.dash,
        label: phase.telegraphLabel || base.label,
        finalBoss
    };
}

export function shouldRenderEnemyStatusDetails(enemy = {}) {
    return Boolean(
        enemy.isBoss
        || enemy.isFinalBoss
        || enemy.game?.selectedUnit === enemy
        || enemy.game?.hoveredEnemy === enemy
        || (enemy.uid && enemy.game?.hoveredEnemyUid === enemy.uid)
    );
}

export function buildEnemyStatusPips(debuffs = [], limit = 4) {
    const active = (debuffs || [])
        .filter((debuff) => debuff?.duration > 0)
        .reduce((map, debuff) => {
            const current = map.get(debuff.type);
            if (!current) {
                map.set(debuff.type, {
                    type: debuff.type,
                    duration: Number(debuff.duration || 0),
                    stacks: Number(debuff.stacks || 1),
                    power: Number(debuff.power || 0)
                });
                return map;
            }
            current.duration = Math.max(current.duration, Number(debuff.duration || 0));
            current.stacks += Number(debuff.stacks || 1);
            current.power = Math.max(current.power, Number(debuff.power || 0));
            return map;
        }, new Map());

    const priority = { stun: 9, sleep: 9, web: 8, slow: 7, burn: 6, poison: 6, curse: 6, bleed: 6, armorBreak: 5, mark: 4, haste: 3 };
    const entries = [...active.values()]
        .sort((a, b) => (priority[b.type] || 1) - (priority[a.type] || 1) || b.duration - a.duration)
        .map((status) => {
            const visual = STATUS_VISUALS[status.type] || { color: '#ffffff', symbol: status.type.charAt(0).toUpperCase() || '?' };
            return {
                ...status,
                color: visual.color,
                symbol: visual.symbol,
                durationLabel: `${Math.ceil(status.duration)}s`,
                stackLabel: status.stacks > 1 ? `x${status.stacks}` : ''
            };
        });

    return {
        visible: entries.slice(0, limit),
        overflow: Math.max(0, entries.length - limit),
        total: entries.length
    };
}

export class Enemy {
    constructor(config, path, game = null) {
        this.uid = `enemy-${enemyUid++}`;
        this.config = config;
        this.game = game;
        this.name = config.name || 'Enemigo';
        this.hp = config.hp || 50;
        this.maxHp = this.hp;
        this.baseSpeed = config.speed || 50;
        this.speed = this.baseSpeed;
        this.reward = config.reward ?? 10;
        this.armor = config.armor || 0;
        this.category = config.category || 'Urbano';
        this.faction = config.faction || 'Independiente';
        this.archetype = config.archetype || 'soldier';
        this.threat = config.threat || 1;
        this.resistances = { ...(config.resistances || {}) };
        this.statusResistance = config.statusResistance || 0;
        this.stealth = Boolean(config.stealth);
        this.flying = Boolean(config.flying || this.archetype === 'flying');
        this.isBoss = Boolean(config.isBoss);
        this.isFinalBoss = Boolean(config.isFinalBoss);
        this.sprite = config.sprite;
        this.visual = config.visual || null;
        this.animator = this.visual ? new SpriteAnimator(this.visual) : null;
        this.debuffs = [];
        this.webBindCooldown = 0;
        this.sleepRecovery = 0;
        this.hellChainRecovery = 0;
        this.frost = { stacks: 0, remaining: 0, cooldown: 0 };

        const renderedSize = Number(config.visual?.size || config.visualSize || (this.isFinalBoss ? 96 : this.isBoss ? 96 : 30));
        this.path = buildEnemyTravelPath(path, game?.currentLevel, renderedSize);
        this.pathIndex = 0;
        this.x = this.path?.[0]?.x || 0;
        this.y = this.path?.[0]?.y || 0;
        this.size = config.visualSize || (this.isFinalBoss ? 62 : this.isBoss ? 54 : 30);
        this.isAlive = true;
        this.hasReachedEnd = false;
        this.distanceTravelled = 0;
        this.processed = false;
        this.rewarded = false;
        this.telegraph = null;
        this.currentPhase = config.phaseLabel || (this.isBoss ? 'Fase inicial' : null);
        this.behavior = new EnemyBehaviorSystem(this, game);

        if (this.sprite && typeof Image !== 'undefined' && !imageCache.has(this.sprite)) {
            const img = new Image();
            img.src = this.sprite;
            imageCache.set(this.sprite, img);
        }
    }

    takeDamage(amount, options = {}) {
        const baseArmor = this.armor > 1 ? this.armor / 100 : this.armor;
        const armorBreak = this.debuffs
            .filter((debuff) => debuff.type === 'armorBreak')
            .reduce((total, debuff) => total + debuff.power, 0);
        const penetration = Math.max(0, Math.min(1, options.armorPenetration || 0));
        const armorRatio = options.ignoreArmor
            ? 0
            : Math.max(0, Math.min(baseArmor - armorBreak, 0.85)) * (1 - penetration);
        const resistance = Math.max(0, Math.min(0.8, this.resistances[options.attackerType] || 0));
        const finalDamage = Math.max(options.fractional ? 0 : 1, amount * (1 - resistance) * (1 - armorRatio));
        const barrierBonus = options.direct ? this.debuffs
            .filter((status) => status.type === 'barrierScan' && status.duration > 0)
            .reduce((strongest, status) => Math.max(strongest, status.power), 0) : 0;
        const barrierResult = this.behavior.absorbDamage(finalDamage, 1 + barrierBonus);
        if (options.direct && (barrierResult.absorbed > 0 || barrierResult.remaining > 0)) {
            this.debuffs = this.debuffs.filter(effect => effect.type !== 'sleep');
        }
        const appliedDamage = Math.min(this.hp, barrierResult.remaining);
        this.hp -= appliedDamage;

        if (this.hp <= 0) {
            this.hp = 0;
            this.isAlive = false;
        }

        return { damage: appliedDamage + barrierResult.absorbed, killed: !this.isAlive };
    }

    get stealth() {
        return this.nativeStealth && !this.debuffs?.some((effect) => effect.type === 'reveal' && effect.duration > 0
            && (!effect.fieldActive || effect.fieldActive()));
    }

    set stealth(value) {
        this.nativeStealth = Boolean(value);
    }

    applyDebuff(type, duration = 1, power = 0.5) {
        return this.applyStatus({ type, duration, power });
    }

    getStatusDuration(type, duration) {
        const specificResistance = this.config.statusResistances?.[type] || 0;
        return duration * Math.max(0.2, 1 - this.statusResistance - specificResistance);
    }

    applyStatus(effect, source = null) {
        const { type, duration = 1, power = 0.5 } = effect;
        const dot = DOT_TYPES.has(type) ? resolveStatusDamage(effect, this, source) : null;
        if (DOT_TYPES.has(type) && !dot) return false;
        if (type === 'slow' && this.config.immuneToSlow) return false;
        if (type === 'stun' && this.config.immuneToStun) return false;
        if (type === 'sleep') {
            if (this.config.immuneToStun || this.sleepRecovery > 0 || !this.isAlive) return false;
            const time = this.getStatusDuration('stun', Math.min(2, duration));
            this.sleepRecovery = time + 4;
            this.debuffs.push({ type, duration: time, power: 1, source });
            source?.recordStatusApplied?.({ type, duration: time, power: 1 }, this);
            return true;
        }
        if (type === 'knockback') {
            if (this.flying || this.config.immuneToKnockback) return false;
            this.moveBackward(power);
            source?.recordStatusApplied?.(effect, this);
            return true;
        }

        const adjustedDuration = this.getStatusDuration(type, type === 'sabotage' ? Math.min(SABOTAGE_SECONDS, duration) : duration);
        if (type === 'sabotage' && !this.behavior.applySabotage(adjustedDuration)) return false;
        if (type === 'barrierScan' && (!this.isAlive || this.behavior.barrier <= 0)) return false;

        if (type === 'poison') {
            if (!this.isAlive) return false;
            const existing = this.debuffs.find((debuff) => debuff.type === 'poison');
            const status = existing || { type: 'poison', applications: [], stacks: 0, duration: 0 };
            const accepted = addPoisonStacks(status, effect, dot, source, adjustedDuration, (layer, elapsed) => this.applyDotTick(layer, elapsed));
            if (accepted) {
                if (!existing) this.debuffs.push(status);
                source?.recordStatusApplied?.({ ...effect, duration: adjustedDuration }, this);
            }
            return accepted;
        }

        if (type === 'web') {
            const web = this.debuffs.find((debuff) => debuff.type === 'web');
            if (web) {
                web.duration = Math.max(web.duration, adjustedDuration);
                web.stacks = (web.stacks || 0) + 1;
                web.source = source || web.source;
                const webThreshold = source?.game?.progression?.getHeroEvolution?.(source.id)?.id === 'iron_spider' ? 2 : 3;
                if (web.stacks >= webThreshold) {
                    if (this.webBindCooldown <= 0) {
                        web.stacks = 0;
                        const applied = this.applyStatus({ type: 'stun', duration: 0.7, power: 1 }, source);
                        this.webBindCooldown = (applied ? this.getStatusDuration('stun', 0.7) : 0) + 2;
                        if (applied) source?.recordAbility?.();
                    } else web.stacks = webThreshold - 1;
                }
            } else {
                this.debuffs.push({ type, duration: adjustedDuration, power, source, stacks: 1, tickTimer: 0 });
            }
            source?.recordStatusApplied?.({ ...effect, duration: adjustedDuration }, this);
            return true;
        }

        const existing = this.debuffs.find((debuff) => debuff.type === type && !debuff.fieldActive);
        if (existing) {
            existing.duration = Math.max(existing.duration, adjustedDuration);
            if (dot) {
                // Compare resolved DPS, not coefficients from different damage bases.
                if (dot.damagePerSecond >= existing.damagePerSecond) {
                    Object.assign(existing, dot, { power, source, explicitDamageBasis: Boolean(effect.damageBasis), secondaryEntity: Boolean(effect.secondaryEntity) });
                }
            } else {
                existing.power = Math.max(existing.power, power);
                existing.source = source || existing.source;
            }
        } else {
            this.debuffs.push({ type, duration: adjustedDuration, power, source, tickTimer: 0, stacks: 1, ...dot, explicitDamageBasis: Boolean(effect.damageBasis), secondaryEntity: Boolean(effect.secondaryEntity) });
        }
        source?.recordStatusApplied?.({ ...effect, duration: adjustedDuration }, this);
        return true;
    }

    applyFieldSlow(power, duration, source, fieldActive) {
        return this.applyFieldStatus('slow', power, duration, source, fieldActive);
    }

    applyFieldMark(power, duration, source, fieldActive) {
        return this.applyFieldStatus('mark', power, duration, source, fieldActive);
    }

    applyFieldStatus(type, power, duration, source, fieldActive) {
        // Keep field contributions separate so leaving a zone preserves allied slows.
        if ((type === 'slow' && this.config.immuneToSlow) || !this.isAlive) return false;
        const adjustedDuration = this.getStatusDuration(type, duration);
        this.debuffs.push({ type, power, duration: adjustedDuration, source, fieldActive });
        source?.recordStatusApplied?.({ type, power, duration: adjustedDuration }, this);
        return true;
    }

    applyFrost(source) {
        if (!this.isAlive || this.hasReachedEnd) return;
        this.applyStatus({ type: 'slow', power: 0.3, duration: 1.2 }, source);
        // The victim owns the recovery window, shared by all sources of native frost.
        if (this.frost.cooldown > 0) return;
        this.frost.remaining = 3;
        this.frost.stacks++;
        if (this.frost.stacks < 3) return;
        const frozen = this.applyStatus({ type: 'stun', duration: 0.6, power: 1 }, source);
        this.frost.stacks = 0;
        this.frost.cooldown = 4 + (frozen ? this.getStatusDuration('stun', 0.6) : 0);
    }

    applyDotTick(debuff, elapsed) {
        const stackCount = Math.max(1, Number(debuff.stacks || 1));
        const damage = debuff.damagePerSecond * stackCount * elapsed;
        const result = this.takeDamage(damage, { ignoreArmor: true, fractional: debuff.explicitDamageBasis });
        debuff.source?.recordDamage?.(result.damage);
        if (result.killed && !this.killCredited) {
            this.killCredited = true;
            debuff.source?.recordKill?.(debuff.source?.game?.resourceManager, this, Boolean(debuff.secondaryEntity));
        }
        return this.isAlive;
    }

    consumePoison(source, count) {
        const poison = this.debuffs.find(effect => effect.type === 'poison');
        if (!this.isAlive || !poison) return 0;
        const consumed = consumePoisonStacks(poison, source, count, (layer, elapsed) => this.applyDotTick(layer, elapsed));
        if (poison.stacks === 0) this.debuffs = this.debuffs.filter(effect => effect !== poison);
        return consumed;
    }

    updateDebuffs(dt) {
        this.hellChainRecovery = Math.max(0, this.hellChainRecovery - dt);
        this.sleepRecovery = Math.max(0, this.sleepRecovery - dt);
        this.frost.cooldown = Math.max(0, this.frost.cooldown - dt);
        this.frost.remaining = Math.max(0, this.frost.remaining - dt);
        if (this.frost.remaining === 0) this.frost.stacks = 0;
        this.webBindCooldown = Math.max(0, this.webBindCooldown - dt);
        this.debuffs.forEach((debuff) => {
            if (debuff.type === 'poison' && this.isAlive) {
                updatePoisonStacks(debuff, dt, (layer, elapsed) => this.applyDotTick(layer, elapsed));
                return;
            }
            if ((debuff.type === 'burn' || debuff.type === 'bleed' || debuff.type === 'curse') && this.isAlive) {
                const interval = debuff.type === 'bleed' ? 0.4 : 0.5;
                debuff.tickTimer += Math.min(dt, Math.max(0, debuff.duration));
                while (debuff.tickTimer >= interval && this.isAlive) {
                    this.applyDotTick(debuff, interval);
                    debuff.tickTimer -= interval;
                }
                // Explicit DPS must include the remaining time, even when resistance makes it shorter than a tick.
                if (debuff.explicitDamageBasis && debuff.duration <= dt && debuff.tickTimer > 0 && this.isAlive) {
                    this.applyDotTick(debuff, debuff.tickTimer);
                    debuff.tickTimer = 0;
                }
            }
            debuff.duration -= dt;
        });
        this.debuffs = this.debuffs.filter((debuff) => debuff.duration > 0 && (!debuff.fieldActive || debuff.fieldActive()));

        const slow = this.debuffs.filter((debuff) => debuff.type === 'slow')
            .reduce((best, effect) => !best || effect.power > best.power ? effect : best, null);
        const web = this.debuffs.find((debuff) => debuff.type === 'web' && debuff.stacks > 0);
        const stunned = this.debuffs.some((debuff) => debuff.type === 'stun' || debuff.type === 'sleep');
        const haste = this.debuffs.find((debuff) => debuff.type === 'haste');

        if (stunned) {
            this.speed = 0;
        } else if (slow || web) {
            const slowPower = Math.max(slow?.power || 0, (web?.power || 0) * (web?.stacks || 0));
            this.speed = this.baseSpeed * Math.max(0.2, 1 - slowPower);
        } else {
            this.speed = this.baseSpeed;
        }
        if (haste && !stunned) this.speed *= 1 + haste.power;
    }

    getDamageTakenMultiplier() {
        const mark = this.debuffs
            .filter((debuff) => debuff.type === 'mark' && debuff.duration > 0 && (!debuff.fieldActive || debuff.fieldActive()))
            .reduce((strongest, debuff) => Math.max(strongest, debuff.power), 0);
        return 1 + mark;
    }

    update(dt) {
        if (!this.isAlive || this.hasReachedEnd) return;
        this.enforcePathIntegrity();
        this.updateDebuffs(dt);
        this.animator?.update(dt);
        if (!this.isAlive) return;
        this.behavior.update(dt);
        this.speed *= this.behavior.getSpeedMultiplier();
        if (this.speed <= 0) {
            this.animator?.setMoving(false);
            return;
        }

        this.animator?.setMoving(true);
        this.moveForward(this.speed * dt);
    }

    moveForward(distance) {
        let remaining = Math.max(0, distance);

        while (remaining > 0) {
            const target = this.path[this.pathIndex + 1];
            if (!target) {
                this.hasReachedEnd = true;
                return;
            }

            const dx = target.x - this.x;
            const dy = target.y - this.y;
            const segmentRemaining = Math.hypot(dx, dy);
            this.animator?.faceVector(dx, dy);
            if (segmentRemaining <= remaining) {
                this.x = target.x;
                this.y = target.y;
                this.pathIndex++;
                this.distanceTravelled += segmentRemaining;
                remaining -= segmentRemaining;
            } else {
                this.x += (dx / segmentRemaining) * remaining;
                this.y += (dy / segmentRemaining) * remaining;
                this.snapToPathSegment(target);
                this.distanceTravelled += remaining;
                remaining = 0;
            }
        }
    }

    playPhaseAnimation() {
        this.animator?.playAttack();
    }

    moveBackward(distance) {
        let remaining = Math.max(0, distance);
        let moved = 0;

        while (remaining > 0) {
            const segmentStart = this.path[this.pathIndex];
            if (!segmentStart) break;

            const dx = segmentStart.x - this.x;
            const dy = segmentStart.y - this.y;
            const distanceToStart = Math.hypot(dx, dy);
            if (distanceToStart > remaining) {
                this.x += (dx / distanceToStart) * remaining;
                this.y += (dy / distanceToStart) * remaining;
                moved += remaining;
                remaining = 0;
            } else {
                this.x = segmentStart.x;
                this.y = segmentStart.y;
                moved += distanceToStart;
                remaining -= distanceToStart;
                if (this.pathIndex === 0) break;
                this.pathIndex--;
            }
        }

        this.hasReachedEnd = false;
        this.distanceTravelled = Math.max(0, this.distanceTravelled - moved);
        const target = this.path[this.pathIndex + 1];
        if (target) this.snapToPathSegment(target);
        return moved;
    }

    copyPathPosition(source, backwardOffset = 0) {
        this.pathIndex = source.pathIndex;
        this.x = source.x;
        this.y = source.y;
        this.distanceTravelled = source.distanceTravelled;
        if (backwardOffset > 0) this.moveBackward(backwardOffset);
    }

    enforcePathIntegrity(tolerance = 1) {
        const closest = this.getClosestPathPoint();
        if (!closest || closest.distance <= tolerance) return false;

        this.x = closest.x;
        this.y = closest.y;
        this.pathIndex = closest.segmentIndex;
        this.distanceTravelled = closest.distanceTravelled;
        this.hasReachedEnd = false;
        return true;
    }

    getClosestPathPoint() {
        if (!Array.isArray(this.path) || this.path.length < 2) return null;

        let best = null;
        let travelledBeforeSegment = 0;
        for (let index = 0; index < this.path.length - 1; index++) {
            const start = this.path[index];
            const end = this.path[index + 1];
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const segmentLength = Math.hypot(dx, dy);
            const lengthSquared = dx * dx + dy * dy || 1;
            const projection = ((this.x - start.x) * dx + (this.y - start.y) * dy) / lengthSquared;
            const t = Math.max(0, Math.min(1, projection));
            const x = start.x + dx * t;
            const y = start.y + dy * t;
            const distance = Math.hypot(this.x - x, this.y - y);
            if (!best || distance < best.distance) {
                best = {
                    x,
                    y,
                    distance,
                    segmentIndex: index,
                    distanceTravelled: travelledBeforeSegment + segmentLength * t
                };
            }
            travelledBeforeSegment += segmentLength;
        }
        return best;
    }

    snapToPathSegment(target) {
        const current = this.path[this.pathIndex];
        if (!current || !target) return;

        if (current.y === target.y) this.y = current.y;
        if (current.x === target.x) this.x = current.x;
    }

    render(ctx) {
        if (!this.isAlive) return;

        ctx.save();
        if (this.stealth) ctx.globalAlpha = 0.72;
        if (this.flying) this.renderFlyingMarker(ctx);

        const animated = this.animator?.render(ctx, this.x, this.y) || false;
        const img = this.sprite ? imageCache.get(this.sprite) : null;
        if (!animated && img?.complete && img.naturalWidth > 0) {
            const previousSmoothing = ctx.imageSmoothingEnabled;
            const previousQuality = ctx.imageSmoothingQuality;
            ctx.imageSmoothingEnabled = !ctx.__pixelArtCrisp;
            ctx.imageSmoothingQuality = ctx.__pixelArtCrisp ? 'low' : 'high';
            ctx.drawImage(img, this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
            ctx.imageSmoothingEnabled = previousSmoothing;
            ctx.imageSmoothingQuality = previousQuality;
        } else if (!animated) {
            this.renderFallback(ctx);
        }

        this.renderBarrier(ctx);
        this.renderDebuffPips(ctx);
        this.renderTelegraph(ctx);
        this.renderHealthBar(ctx);
        ctx.restore();
    }

    getVisualBounds() {
        const visualSize = this.animator?.config?.size || this.visual?.size || this.size;
        const anchor = this.animator?.config?.anchor || this.visual?.anchor || { x: 0.5, y: 0.5 };
        const left = this.x - visualSize * (Number(anchor.x) || 0.5);
        const top = this.y - visualSize * (Number(anchor.y) || 0.5);
        return {
            left,
            top,
            right: left + visualSize,
            bottom: top + visualSize,
            width: visualSize,
            height: visualSize
        };
    }

    renderFlyingMarker(ctx) {
        const pulse = 0.5 + Math.sin(this.behavior.elapsed * 5) * 0.5;
        const radius = this.size / 2 + 5 + pulse * 2;

        ctx.save();
        ctx.strokeStyle = 'rgba(123, 224, 255, 0.65)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(7, 16, 24, 0.42)';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y + this.size / 2 + 3, this.size * 0.36, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    renderFallback(ctx) {
        const colors = {
            Tecnologico: '#40c9ff',
            Tecnológico: '#40c9ff',
            Mistico: '#b865ff',
            Místico: '#b865ff',
            Urbano: '#e63946',
            Cosmico: '#ff8bd1',
            Cósmico: '#ff8bd1',
            Mutante: '#c7f464'
        };

        ctx.fillStyle = colors[this.category] || '#e63946';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = this.isBoss ? '#ffd166' : 'rgba(255, 255, 255, 0.55)';
        ctx.lineWidth = this.isBoss ? 3 : 1.5;
        ctx.stroke();

        if (this.archetype === 'runner') {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fillRect(this.x - this.size / 2 - 6, this.y - 5, 6, 2);
            ctx.fillRect(this.x - this.size / 2 - 9, this.y + 3, 9, 2);
        } else if (this.archetype === 'shield') {
            ctx.strokeStyle = '#7be0ff';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size / 2 + 4, -Math.PI * 0.7, Math.PI * 0.7);
            ctx.stroke();
        } else if (this.archetype === 'support') {
            ctx.fillStyle = '#69e58c';
            ctx.fillRect(this.x - 2, this.y - 8, 4, 16);
            ctx.fillRect(this.x - 8, this.y - 2, 16, 4);
        } else if (this.archetype === 'summoner') {
            ctx.strokeStyle = '#d86cff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size / 2 + 5, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.fillStyle = '#071018';
        ctx.font = `bold ${this.isBoss ? 14 : 11}px Segoe UI`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.name.charAt(0), this.x, this.y + 1);
    }

    renderHealthBar(ctx) {
        const bounds = this.getVisualBounds();
        const width = this.isFinalBoss ? 64 : this.isBoss ? 56 : Math.max(34, Math.min(48, bounds.width * 0.52));
        const y = bounds.top - (this.isBoss ? 13 : 9);
        const hpPercent = Math.max(0, this.hp / this.maxHp);

        ctx.fillStyle = 'rgba(10, 12, 16, 0.9)';
        ctx.fillRect(this.x - width / 2, y, width, 5);
        ctx.fillStyle = hpPercent > 0.45 ? '#46d369' : hpPercent > 0.2 ? '#fca311' : '#e63946';
        ctx.fillRect(this.x - width / 2, y, width * hpPercent, 5);
    }

    renderBarrier(ctx) {
        if (this.behavior.barrier <= 0 || this.behavior.barrierMax <= 0) return;
        const percent = Math.min(1, this.behavior.barrier / this.behavior.barrierMax);
        ctx.strokeStyle = 'rgba(123, 224, 255, 0.9)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size / 2 + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * percent);
        ctx.stroke();
    }

    renderTelegraph(ctx) {
        if (!this.telegraph) return;
        const progress = 1 - this.telegraph.duration / this.telegraph.maxDuration;
        const theme = this.telegraph.theme || buildBossTelegraphTheme(this);
        const radius = this.size / 2 + 12 + progress * (theme.finalBoss ? 28 : 20);
        ctx.strokeStyle = this.telegraph.color || theme.color;
        ctx.lineWidth = theme.finalBoss ? 5 : 4;
        ctx.setLineDash(theme.dash || []);
        ctx.beginPath();
        ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = theme.accent || this.telegraph.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(this.x, this.y, Math.max(6, radius - 9), 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = this.telegraph.color || theme.color;
        ctx.font = 'bold 9px Segoe UI';
        ctx.textAlign = 'center';
        ctx.fillText(`${theme.label}: ${this.telegraph.label}`.toUpperCase(), this.x, this.y - this.size / 2 - 20);
    }

    renderDebuffPips(ctx) {
        const detailed = shouldRenderEnemyStatusDetails(this);
        const state = buildEnemyStatusPips(this.debuffs, detailed ? 4 : 1);
        if (!state.total) return;
        if (!detailed) {
            this.renderCompactStatusBadge(ctx, state);
            return;
        }

        ctx.save();
        ctx.font = '800 7px Segoe UI';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        state.visible.forEach((status, index) => {
            const x = this.x - 12 + index * 8;
            const y = this.y + this.size / 2 + 8;
            ctx.fillStyle = 'rgba(5, 7, 11, 0.82)';
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = status.color;
            ctx.lineWidth = 1.4;
            ctx.stroke();
            ctx.fillStyle = status.color;
            ctx.fillText(status.symbol, x, y + 0.2);
        });
        if (state.overflow > 0) {
            ctx.fillStyle = '#ffffff';
            ctx.fillText(`+${state.overflow}`, this.x + 24, this.y + this.size / 2 + 8);
        }
        ctx.restore();
    }

    renderCompactStatusBadge(ctx, state) {
        const status = state.visible[0];
        if (!status) return;
        const bounds = this.getVisualBounds();
        const x = Math.min(bounds.right - 6, this.x + this.size / 2 + 6);
        const y = bounds.top + 7;

        ctx.save();
        ctx.fillStyle = 'rgba(5, 7, 11, 0.78)';
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = status.color;
        ctx.lineWidth = state.total > 1 ? 2 : 1.4;
        ctx.stroke();
        ctx.restore();
    }
}
