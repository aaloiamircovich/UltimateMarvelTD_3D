export const SABOTAGE_SECONDS = 2;

export function isSabotageTarget(enemy) {
    if (!enemy || enemy.isBoss || enemy.isFinalBoss || enemy.isMiniBoss
        || enemy.config?.isBoss || enemy.config?.isFinalBoss || enemy.config?.isMiniBoss) return false;
    return ['support', 'summoner', 'commander'].includes(enemy.archetype)
        || enemy.config?.affix?.id === 'commander';
}

export class EnemyBehaviorSystem {
    constructor(enemy, game = null) {
        this.enemy = enemy;
        this.game = game;
        this.archetype = enemy.config.archetype || 'soldier';
        this.elapsed = 0;
        this.actionTimer = enemy.config.behaviorCooldown || 4;
        this.summonsRemaining = enemy.config.summonLimit || 0;
        this.barrierMax = Math.round(enemy.maxHp * (enemy.config.barrierRatio || 0));
        this.barrier = this.barrierMax;
        this.barrierRechargeDelay = 0;
        this.phaseSpeedMultiplier = 1;
        this.activatedPhases = new Set();
        this.pendingPhase = null;
        this.telegraphTimer = 0;
        this.temporaryStealth = 0;
        this.sabotageRemaining = 0;
        this.sabotageLockout = 0;
        this.interruptRecovery = 0;
    }

    update(dt) {
        this.elapsed += dt;
        // A phaser can carry the commander affix; suppress orders, not its phase shift.
        const blockedTime = this.archetype === 'phaser' ? 0 : Math.min(dt, this.sabotageRemaining);
        this.sabotageRemaining = Math.max(0, this.sabotageRemaining - dt);
        this.sabotageLockout = Math.max(0, this.sabotageLockout - dt);
        this.interruptRecovery = Math.max(0, this.interruptRecovery - dt);
        this.actionTimer -= dt - blockedTime;
        this.barrierRechargeDelay = Math.max(0, this.barrierRechargeDelay - dt);
        const affix = this.enemy.config.affix?.id;
        if (affix === 'regenerator' && this.enemy.hp < this.enemy.maxHp) {
            this.enemy.hp = Math.min(this.enemy.maxHp, this.enemy.hp + this.enemy.maxHp * 0.012 * dt);
        }

        if (this.temporaryStealth > 0) {
            this.temporaryStealth -= dt;
            if (this.temporaryStealth <= 0) this.enemy.stealth = Boolean(this.enemy.config.stealth);
        }

        if (this.archetype === 'shield' && this.barrier === 0 && this.barrierRechargeDelay === 0) {
            this.barrier = this.barrierMax;
            this.game?.vfx?.addRing(this.enemy.x, this.enemy.y, { color: '#7be0ff', radius: 28, duration: 0.4 });
        }

        if (this.sabotageRemaining <= 0) {
            if (this.archetype === 'support' && this.actionTimer <= 0) this.healAllies();
            if (this.archetype === 'summoner' && this.actionTimer <= 0) this.summonReinforcement();
            if ((this.archetype === 'commander' || affix === 'commander') && this.actionTimer <= 0) this.commandAllies();
        }
        if (this.archetype === 'phaser' && this.actionTimer <= 0) this.activatePhaseShift();
        if (this.enemy.isBoss || this.enemy.config.isMiniBoss) this.updateBossPhases(dt);
    }

    getSpeedMultiplier() {
        const runnerBurst = this.archetype === 'runner' && this.elapsed % 5 < 1.4 ? 1.45 : 1;
        const phaseBurst = this.archetype === 'phaser' && this.temporaryStealth > 0 ? 1.35 : 1;
        const unstableBurst = this.enemy.config.affix?.id === 'unstable' && this.enemy.hp / this.enemy.maxHp < 0.35 ? 1.45 : 1;
        return runnerBurst * phaseBurst * unstableBurst * this.phaseSpeedMultiplier;
    }

    applySabotage(duration) {
        if (!this.enemy.isAlive || !isSabotageTarget(this.enemy) || this.sabotageLockout > 1e-9
            || !Number.isFinite(duration) || duration <= 0) return false;
        this.sabotageRemaining = Math.min(SABOTAGE_SECONDS, duration);
        this.sabotageLockout = this.sabotageRemaining + 3;
        return true;
    }

    interruptAction() {
        // One skipped support action, not a movement stun or a cancelled boss phase.
        if (!this.enemy.isAlive || this.enemy.hasReachedEnd || !isSabotageTarget(this.enemy)
            || this.archetype === 'phaser' || this.enemy.config.immuneToInterrupt
            || this.interruptRecovery > 0 || this.sabotageRemaining > 0
            || !Number.isFinite(this.actionTimer) || this.actionTimer > 1 || this.actionTimer < 0
            || (this.archetype === 'summoner' && this.summonsRemaining <= 0)) return false;
        const base = this.enemy.config.behaviorCooldown || (this.archetype === 'summoner' ? 7
            : this.archetype === 'commander' || this.enemy.config.affix?.id === 'commander' ? 5 : 4);
        this.actionTimer += this.enemy.getStatusDuration('interrupt', base);
        this.interruptRecovery = 6;
        return true;
    }

    absorbDamage(amount, multiplier = 1) {
        if (this.barrier <= 0) return { absorbed: 0, remaining: amount };
        const absorbed = Math.min(this.barrier, amount * multiplier);
        this.barrier -= absorbed;
        this.barrierRechargeDelay = 5;
        if (this.barrier === 0) {
            this.enemy.debuffs = this.enemy.debuffs.filter((status) => status.type !== 'barrierScan');
            this.game?.vfx?.addBurst(this.enemy.x, this.enemy.y, { color: '#7be0ff', radius: 32, duration: 0.3 });
        }
        // Shield amplification never multiplies the damage overflowing into health.
        return { absorbed, remaining: Math.max(0, amount - absorbed / multiplier) };
    }

    healAllies() {
        const allies = (this.game?.enemies || []).filter((candidate) => (
            candidate.isAlive
            && candidate !== this.enemy
            && Math.hypot(candidate.x - this.enemy.x, candidate.y - this.enemy.y) <= 120
            && candidate.hp < candidate.maxHp
        ));
        allies.forEach((ally) => {
            ally.hp = Math.min(ally.maxHp, ally.hp + ally.maxHp * (this.enemy.config.healPower || 0.06));
        });
        if (allies.length > 0) {
            this.game?.vfx?.addRing(this.enemy.x, this.enemy.y, { color: '#69e58c', radius: 120, duration: 0.5 });
        }
        this.actionTimer = this.enemy.config.behaviorCooldown || 4;
    }

    summonReinforcement() {
        if (this.summonsRemaining <= 0) {
            this.actionTimer = Number.POSITIVE_INFINITY;
            return;
        }
        const config = this.game?.enemyDatabase?.normal?.[this.enemy.config.summonId];
        if (config) {
            this.game.spawnEnemy?.({ ...config, hp: Math.round(config.hp * 0.7), reward: 0 }, this.enemy);
            this.summonsRemaining--;
            this.game?.vfx?.addRing(this.enemy.x, this.enemy.y, { color: '#d86cff', radius: 42, duration: 0.5 });
        }
        this.actionTimer = this.enemy.config.behaviorCooldown || 7;
    }

    commandAllies() {
        const allies = (this.game?.enemies || []).filter((candidate) => candidate.isAlive
            && candidate !== this.enemy && Math.hypot(candidate.x - this.enemy.x, candidate.y - this.enemy.y) <= 145);
        allies.forEach((ally) => ally.applyStatus?.({ type: 'haste', duration: 2.5, power: this.enemy.config.commandPower || 0.2 }, this.enemy));
        if (allies.length) this.game?.vfx?.addRing(this.enemy.x, this.enemy.y, { color: '#5be7ff', radius: 145, duration: 0.5 });
        this.actionTimer = this.enemy.config.behaviorCooldown || 5;
    }

    activatePhaseShift() {
        this.enemy.stealth = true;
        this.temporaryStealth = 1.4;
        this.game?.vfx?.addBurst(this.enemy.x, this.enemy.y, { color: '#ff8bd1', radius: 28, duration: 0.25 });
        this.actionTimer = this.enemy.config.behaviorCooldown || 6;
    }

    updateBossPhases(dt) {
        if (this.pendingPhase) {
            this.telegraphTimer -= dt;
            this.enemy.telegraph.duration = Math.max(0, this.telegraphTimer);
            if (this.telegraphTimer <= 0) this.activateBossPhase(this.pendingPhase);
            return;
        }

        const hpRatio = this.enemy.hp / this.enemy.maxHp;
        const phase = (this.enemy.config.phases || []).find((candidate, index) => (
            hpRatio <= candidate.threshold && !this.activatedPhases.has(index)
        ));
        if (!phase) return;

        const index = this.enemy.config.phases.indexOf(phase);
        this.activatedPhases.add(index);
        this.pendingPhase = phase;
        this.telegraphTimer = phase.telegraph || 1.25;
        this.enemy.telegraph = {
            label: phase.name,
            duration: this.telegraphTimer,
            maxDuration: this.telegraphTimer,
            color: phase.color || phase.telegraphColor || null
        };
        this.game?.uiManager?.showToast(`${this.enemy.name} prepara ${phase.name}`, 'warning');
    }

    activateBossPhase(phase) {
        this.pendingPhase = null;
        this.enemy.telegraph = null;
        this.enemy.currentPhase = phase.name;
        this.enemy.playPhaseAnimation?.(phase.animation);

        if (phase.barrier) {
            const barrier = Math.round(this.enemy.maxHp * phase.barrier);
            this.barrierMax = Math.max(this.barrierMax, barrier);
            this.barrier += barrier;
        }
        if (phase.heal) this.enemy.hp = Math.min(this.enemy.maxHp, this.enemy.hp + this.enemy.maxHp * phase.heal);
        if (phase.armor) this.enemy.armor = Math.min(0.8, this.enemy.armor + phase.armor);
        if (phase.speed) this.phaseSpeedMultiplier = phase.speed;
        if (phase.stealth) {
            this.enemy.stealth = true;
            this.temporaryStealth = phase.stealth;
        }
        if (phase.summonId) {
            const config = this.game?.enemyDatabase?.normal?.[phase.summonId];
            for (let index = 0; config && index < (phase.summonCount || 1); index++) {
                this.game.spawnEnemy?.({ ...config, reward: 0 }, this.enemy);
            }
        }
        if (phase.stunHeroes) {
            const duration = phase.stunDuration || phase.heroStunDuration || 4;
            const stunnedHeroes = (this.game?.heroes || []).filter((hero) => hero?.applyStun);
            stunnedHeroes.forEach((hero) => hero.applyStun(duration));
            this.game?.vfx?.addRing(this.enemy.x, this.enemy.y, {
                color: phase.color || '#ffd166',
                radius: phase.stunRadius || 220,
                duration: Math.min(1.2, Math.max(0.6, duration * 0.25))
            });
            if (stunnedHeroes.length) {
                this.game?.uiManager?.showToast(`El Guantelete aturde a ${stunnedHeroes.length} hÃ©roes`, 'danger');
            }
        }

        this.game?.vfx?.addRing(this.enemy.x, this.enemy.y, {
            color: phase.color || phase.telegraphColor || getPhaseColor(this.enemy),
            radius: 72,
            duration: 0.7
        });
        this.game?.audio?.play('boss');
        this.game?.uiManager?.showToast(`${this.enemy.name}: ${phase.name}`, 'warning');
    }
}

function getPhaseColor(enemy = {}) {
    const category = enemy.category || enemy.config?.category || '';
    if (category.includes('Tecn')) return '#40c9ff';
    if (category.includes('Cos')) return '#ff8bd1';
    if (category.includes('Mutante')) return '#c7f464';
    if (category.includes('M')) return '#b865ff';
    return '#e63946';
}
