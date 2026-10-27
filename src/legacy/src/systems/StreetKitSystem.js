import { CombatSystem } from './CombatSystem.js';
import { applyCooldownReductions } from '../utils/AbilityModifiers.js';
import { isPointInRangePattern } from '../utils/RangePattern.js';
import { getRouteProgress } from '../utils/PathUtils.js';

const STREET_CONTROLS = {
    shang_chi: {
        label: 'Patron de los Diez Anillos',
        defaultMode: 'orbit',
        options: [
            { id: 'orbit', label: 'Orbita' },
            { id: 'volley', label: 'Rafaga' },
            { id: 'guard', label: 'Guardia' }
        ]
    }
};

const MOON_PHASES = [
    { id: 'crescent', label: 'Creciente', color: '#9bdcff' },
    { id: 'full', label: 'Luna llena', color: '#fff4c7' },
    { id: 'waning', label: 'Menguante', color: '#b69cff' }
];

export class StreetKitSystem {
    constructor(hero) {
        this.hero = hero;
        this.mode = STREET_CONTROLS[hero.id]?.defaultMode || null;
        this.attackCount = 0;
        this.cooldownRemaining = hero.id === 'jessica_jones' ? 3 : hero.id === 'iron_fist' ? 5 : ['she_hulk', 'elektra', 'shang_chi'].includes(hero.id) ? 4 : 0;
        this.ringCharge = 0;
        if (hero.id === 'mbaku') this.cooldownRemaining = 4;
        if (hero.id === 'korg') this.cooldownRemaining = 5;
        if (hero.id === 'red_guardian') this.cooldownRemaining = 3;
        this.radarTimer = 0;
        this.radarPulseTimer = 8;
        this.moonTimer = 0;
        this.moonPhase = 0;
        this.hunterX = hero.x;
        this.hunterY = hero.y;
        if (hero.id === 'blade') this.cooldownRemaining = 6;
        if (hero.id === 'ghost_rider') this.cooldownRemaining = 11;
        this.ringAngle = 0;
        this.suppression = null;
    }

    update(dt, enemies, stats) {
        this.cooldownRemaining = Math.max(0, this.cooldownRemaining - dt);
        this.radarTimer = Math.max(0, this.radarTimer - dt);
        this.ringAngle = (this.ringAngle + dt * 2.8) % (Math.PI * 2);
        if (this.hero.id === 'punisher' && !this.hasSuppressionTarget(this.suppression?.target)) this.suppression = null;

        if (this.hero.id === 'daredevil') this.updateDaredevil(dt, enemies);
        if (this.hero.id === 'moon_knight') this.updateMoonCycle(dt);
        if (this.hero.id === 'ghost_rider') this.updatePenance(enemies, stats);
        if (this.hero.id === 'korg') this.stompKorg(enemies, stats);
    }

    onAttack(target, stats) {
        this.attackCount++;
        if (this.hero.id === 'blade' && this.isDaywalkerPrepared(target)) {
            this.cooldownRemaining = 6;
            this.hero.recordAbility();
            this.hero.game.audio?.play('blood');
        }
        if (this.hero.id === 'mbaku' && this.cooldownRemaining === 0 && this.isCovered(target, stats)
            && target.behavior?.barrier > 0) {
            const amount = Math.min(target.behavior.barrier * 0.2, stats.damage * 1.2);
            const result = target.behavior.absorbDamage(amount);
            this.hero.recordDamage(result.absorbed);
            this.cooldownRemaining = 4;
            this.hero.recordAbility();
            this.hero.game.vfx?.addBurst(target.x, target.y, { color: '#f7c873', radius: 30 });
        }
        if (this.hero.id === 'red_guardian' && this.cooldownRemaining === 0) this.cooldownRemaining = 3;
        if (this.hero.id === 'jessica_jones' && this.isLastLineTarget(target)) {
            this.cooldownRemaining = 3;
            this.hero.recordAbility();
        }
        if (this.isChiPrepared()) {
            this.cooldownRemaining = 5;
            this.hero.recordAbility();
        }
        if (this.hero.id === 'shang_chi') {
            if (this.isRingFinisher()) {
                this.ringCharge = 0;
                this.cooldownRemaining = 4;
                this.hero.recordAbility();
            } else this.ringCharge = Math.min(3, this.ringCharge + 1);
        }
        if (this.hero.id === 'elektra' && this.isSaiPrepared(target)) {
            this.cooldownRemaining = 4;
            this.hero.recordAbility();
        }
        if (this.hero.id === 'punisher') {
            const stacks = this.hasSuppressionTarget(target) ? Math.min(4, this.suppression.stacks + 1) : 1;
            this.suppression = { target, stacks, time: this.hero.visualTime, x: this.hero.x, y: this.hero.y };
        }
        if (this.hero.id === 'daredevil' && this.attackCount % 4 === 0) this.counterDaredevil(target, stats);
        if (this.hero.id === 'ghost_rider' && this.attackCount % 5 === 0) this.pullWithChain(target);
        if (this.hero.id === 'she_hulk') {
            this.attackCount = Math.min(3, this.attackCount);
            if (this.attackCount === 3 && this.cooldownRemaining === 0) this.impactSheHulk(target, stats);
        }
    }

    hasSuppressionTarget(target) {
        const state = this.suppression;
        if (!state || !target?.isAlive || state.target !== target || this.hero.stunTimer > 0
            || this.hero.visualTime - state.time >= 2
            || state.x !== this.hero.x || state.y !== this.hero.y) return false;
        const stats = this.hero.getEffectiveStats();
        return (!target.stealth || stats.canSeeStealth)
            && isPointInRangePattern(this.hero, target, stats.range, this.hero.rangePattern, stats.rangeGeometryScale);
    }

    getAttackDamageMultiplier(target) {
        if (this.hero.id === 'blade') return this.isDaywalkerPrepared(target) ? 2 : 1;
        if (this.hero.id === 'jessica_jones') return this.isLastLineTarget(target) ? 1.45 : 1;
        if (this.hero.id === 'iron_fist') return this.isChiPrepared() ? 1.9 : 1;
        if (this.hero.id === 'elektra') return this.isSaiPrepared(target) ? 1.75 : 1;
        return this.hero.id === 'punisher' && this.hasSuppressionTarget(target)
            ? 1 + this.suppression.stacks * 0.08 : 1;
    }

    isSaiPrepared(target) {
        if (this.cooldownRemaining > 0 || this.hero.stunTimer > 0 || !target?.isAlive
            || target.hp / target.maxHp > 0.5
            || !target.debuffs?.some(effect => effect.type === 'bleed' && effect.duration > 0)) return false;
        const stats = this.hero.getEffectiveStats();
        return (!target.stealth || stats.canSeeStealth)
            && isPointInRangePattern(this.hero, target, stats.range, this.hero.rangePattern, stats.rangeGeometryScale);
    }

    isChiPrepared() {
        return this.hero.id === 'iron_fist' && this.cooldownRemaining === 0 && !(this.hero.stunTimer > 0);
    }

    isLastLineTarget(target) {
        if (this.cooldownRemaining > 0 || this.hero.stunTimer > 0 || !target?.isAlive || target.hasReachedEnd) return false;
        const progress = getRouteProgress(target);
        if (progress < 0.75) return false;
        const stats = this.hero.getEffectiveStats();
        const candidates = this.hero.abilitySystem.getTargetsInRange(this.hero.game.enemies || [], stats.range, stats)
            .filter(enemy => !enemy.hasReachedEnd);
        return candidates.includes(target) && !candidates.some(enemy => getRouteProgress(enemy) > progress);
    }

    onKill() {}

    isDaywalkerPrepared(target) {
        return this.cooldownRemaining === 0 && this.hero.game.heroes.includes(this.hero)
            && this.hunterX === this.hero.x && this.hunterY === this.hero.y
            && this.isCovered(target, this.hero.getEffectiveStats())
            && (target.isBoss || target.threat >= 4) && target.hp <= target.maxHp * 0.5
            && target.debuffs?.some(effect => effect.type === 'bleed' && effect.duration > 0);
    }

    resetHunter() {
        if (!['blade', 'ghost_rider'].includes(this.hero.id)) return;
        this.hunterX = this.hero.x; this.hunterY = this.hero.y;
        this.cooldownRemaining = this.hero.id === 'blade' ? 6 : 11;
        this.attackCount = 0;
    }

    checkHunterPosition() {
        if (!['blade', 'ghost_rider'].includes(this.hero.id)) return;
        if (this.hero.stunTimer > 0 || !this.hero.game.heroes.includes(this.hero)
            || this.hunterX !== this.hero.x || this.hunterY !== this.hero.y) this.resetHunter();
    }

    applyStatModifiers(stats) {
        if (this.hero.id === 'moon_knight') {
            if (this.moonPhase === 0) { stats.range *= 1.22; stats.damage *= 0.9; }
            if (this.moonPhase === 1) { stats.damage *= 1.3; stats.fireRate *= 0.85; }
            if (this.moonPhase === 2) { stats.fireRate *= 1.16; stats.damage *= 0.9; }
        }
        if (this.hero.id === 'blade') {
            stats.damage *= 1.08;
        }
        if (this.hero.id === 'shang_chi') {
            if (this.mode === 'orbit') stats.range *= 1.15;
            if (this.mode === 'volley') {
                stats.damage *= 1.2;
                stats.fireRate *= 0.88;
            }
            if (this.mode === 'guard') {
                stats.damage *= 0.9;
                stats.fireRate *= 1.22;
            }
        }
        return stats;
    }

    getAttackEffects(target) {
        if (this.hero.id === 'jessica_jones' && this.isLastLineTarget(target)) return [{ type: 'stun', duration: 0.5, power: 1, chance: 1 }];
        if (this.isChiPrepared()) return [{ type: 'stun', duration: 0.45, power: 1, chance: 1 }];
        if (this.hero.id === 'shang_chi' && this.mode === 'guard' && this.isRingFinisher()) {
            return [{ type: 'slow', duration: 1.5, power: 0.45, chance: 1 }];
        }
        if (this.hero.id === 'moon_knight' && this.moonPhase === 2) {
            return [{ type: 'slow', duration: 2.2, power: 0.46, chance: 1 }];
        }
        if (this.hero.id === 'blade') {
            const elite = target?.isBoss || (target?.threat || 0) >= 4;
            return [{ type: 'bleed', duration: elite ? 5 : 3.6, power: elite ? 0.3 : 0.21, damageBasis: 'attackDamage', chance: 1 }];
        }
        if (this.hero.id === 'ghost_rider') {
            return [{ type: 'burn', duration: 4, power: 0.135, damageBasis: 'attackDamage', chance: 1 }];
        }
        if (this.hero.id === 'luke_cage') {
            return [{ type: 'armorBreak', duration: 3.5, power: 0.28, chance: 0.7 }];
        }
        return [];
    }

    getProjectileProfile() {
        if (this.hero.id === 'red_guardian') return { interceptBounce: this.cooldownRemaining === 0 && !(this.hero.stunTimer > 0) };
        if (this.hero.id === 'moon_knight') {
            if (this.moonPhase === 0) return { returning: true, chainCount: 1, chainRange: 105, chainFactor: 0.58 };
            if (this.moonPhase === 1) return { returning: true, armorPenetration: 0.35 };
            return { returning: true, splashRadius: 44, splashFactor: 0.42 };
        }
        if (this.hero.id === 'shang_chi') {
            const finisher = this.isRingFinisher();
            if (this.mode === 'orbit') return { chainCount: finisher ? 4 : 3, chainRange: finisher ? 110 : 92, chainFactor: 0.7, returning: true };
            if (this.mode === 'volley') return { splashRadius: finisher ? 82 : 62, splashFactor: 0.54, armorPenetration: finisher ? 0.5 : 0.3 };
            return { chainCount: 1, chainRange: 115, chainFactor: 0.82, returning: true };
        }
        return {};
    }

    isRingFinisher() {
        return this.hero.id === 'shang_chi' && this.ringCharge === 3 && this.cooldownRemaining === 0;
    }

    getProjectileColor() {
        if (this.hero.id === 'daredevil') return '#e84545';
        if (this.hero.id === 'moon_knight') return MOON_PHASES[this.moonPhase].color;
        if (this.hero.id === 'blade') return '#ff4d68';
        if (this.hero.id === 'ghost_rider') return '#ff7a1a';
        if (this.hero.id === 'luke_cage') return '#f2c94c';
        if (this.hero.id === 'shang_chi') return '#ffd447';
        if (this.hero.id === 'she_hulk') return '#91ed55';
        return null;
    }

    getProjectileVisualStyle() {
        if (this.hero.id === 'moon_knight') return 'crescent';
        if (this.hero.id === 'ghost_rider') return 'hellfire';
        if (this.hero.id === 'shang_chi') return 'ring';
        if (this.hero.id === 'blade') return 'blade';
        return null;
    }

    getDisplayState() {
        if (['mbaku', 'korg', 'red_guardian'].includes(this.hero.id)) {
            const [label, seconds] = { mbaku: ['Desafio: requiere barrera', 4], korg: ['Pisoton: 3 cercanos', 5], red_guardian: ['Intercepcion', 3] }[this.hero.id];
            return timerState(`${label} | ${this.cooldownRemaining.toFixed(1)}s`, 1 - this.cooldownRemaining / seconds, this.cooldownRemaining === 0);
        }
        if (this.hero.id === 'jessica_jones') return timerState(this.cooldownRemaining > 0 ? `Ultima linea ${this.cooldownRemaining.toFixed(1)}s` : 'Ultima linea: ruta >=75%', 1 - this.cooldownRemaining / 3, this.cooldownRemaining === 0);
        if (this.hero.id === 'iron_fist') return timerState(this.isChiPrepared() ? 'Chi preparado' : `Chi ${this.cooldownRemaining.toFixed(1)}s`, 1 - this.cooldownRemaining / 5, this.isChiPrepared());
        if (this.hero.id === 'elektra') return timerState(this.cooldownRemaining > 0
            ? `Sai ${this.cooldownRemaining.toFixed(1)}s` : 'Sai preparado: sangrado y vida <=50%',
        1 - this.cooldownRemaining / 4, this.cooldownRemaining === 0);
        if (this.hero.id === 'punisher') {
            const stacks = this.hasSuppressionTarget(this.suppression?.target) ? this.suppression.stacks : 0;
            return { label: `Fuego sostenido +${stacks * 8}%`, progress: stacks / 4, ready: stacks === 4 };
        }
        if (this.hero.id === 'daredevil') return timerState(this.radarTimer > 0 ? 'Pulso local: 190px / 2s' : `Radar ${Math.max(0, this.radarPulseTimer).toFixed(1)}s`, this.radarTimer > 0 ? this.radarTimer / 2 : 1 - this.radarPulseTimer / 8, this.radarTimer > 0);
        if (this.hero.id === 'moon_knight') return timerState(`${MOON_PHASES[this.moonPhase].label} ${(10 - this.moonTimer).toFixed(1)}s > ${MOON_PHASES[(this.moonPhase + 1) % 3].label}`, this.moonTimer / 10, this.moonPhase === 1);
        if (this.hero.id === 'blade') return timerState(`Daywalker: elite sangrante <=50% | ${this.cooldownRemaining.toFixed(1)}s`, 1 - this.cooldownRemaining / 6, this.cooldownRemaining === 0);
        if (this.hero.id === 'ghost_rider') return timerState(this.cooldownRemaining <= 0 ? 'Penitencia lista' : `Penitencia ${this.cooldownRemaining.toFixed(1)} s`, this.cooldownRemaining <= 0 ? 1 : 1 - this.cooldownRemaining / 11, this.cooldownRemaining <= 0);
        if (this.hero.id === 'luke_cage') return { label: `Tenacidad: -${Math.round(this.hero.getStunResistance() * 100)}% aturdimiento`, progress: null, ready: true };
        if (this.hero.id === 'shang_chi') return timerState(`${this.getModeLabel()} | Combo ${this.ringCharge}/3 | ${this.cooldownRemaining.toFixed(1)}s`, this.ringCharge / 3, this.isRingFinisher());
        if (this.hero.id === 'she_hulk') return timerState(`Objecion ${Math.min(3, this.attackCount)}/3 | ${this.cooldownRemaining.toFixed(1)}s`, Math.min(3, this.attackCount) / 3, this.attackCount >= 3 && this.cooldownRemaining === 0);
        return null;
    }

    getControlState() {
        const config = STREET_CONTROLS[this.hero.id];
        return config ? { ...config, value: this.mode } : null;
    }

    setMode(mode) {
        const config = STREET_CONTROLS[this.hero.id];
        if (!config?.options.some((option) => option.id === mode)) return false;
        this.mode = mode;
        return true;
    }

    getMode() {
        return this.mode;
    }

    render(ctx) {
        if (this.hero.id === 'daredevil' && this.radarTimer > 0) {
            ctx.save();
            ctx.strokeStyle = 'rgba(232, 69, 69, 0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.hero.x, this.hero.y, 34 + (2 - this.radarTimer) * 78, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
        if (this.hero.id === 'moon_knight') {
            ctx.save();
            ctx.fillStyle = MOON_PHASES[this.moonPhase].color;
            ctx.globalAlpha = 0.75;
            ctx.beginPath();
            ctx.arc(this.hero.x + 20, this.hero.y - 22, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        if (this.hero.id === 'shang_chi') {
            const count = this.mode === 'volley' ? 5 : this.mode === 'guard' ? 8 : 10;
            ctx.save();
            ctx.strokeStyle = '#ffd447';
            ctx.lineWidth = 2;
            for (let index = 0; index < count; index++) {
                const angle = this.ringAngle + index / count * Math.PI * 2;
                const radius = this.mode === 'guard' ? 24 : 31;
                ctx.beginPath();
                ctx.arc(this.hero.x + Math.cos(angle) * radius, this.hero.y + Math.sin(angle) * radius * 0.55, 3, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.restore();
        }
    }

    updateDaredevil(dt, enemies) {
        this.radarPulseTimer = Math.max(0, this.radarPulseTimer - dt);
        if (this.radarPulseTimer > 0) return;
        const targets = enemies.filter(enemy => enemy.isAlive && !enemy.hasReachedEnd && enemy.nativeStealth && distance(enemy, this.hero) <= 190);
        if (!targets.length) return;
        targets.forEach(enemy => enemy.applyStatus({ type: 'reveal', duration: 2, power: 1 }, this.hero));
        this.radarTimer = 2;
        this.radarPulseTimer = 8;
        this.hero.game.vfx?.addRing(this.hero.x, this.hero.y, { color: '#e84545', radius: 190, duration: 0.7 });
        this.hero.game.audio?.play('radar');
        this.hero.recordAbility();
    }

    updateMoonCycle(dt) {
        this.moonTimer += dt;
        if (this.moonTimer < 10) return;
        const phases = Math.floor(this.moonTimer / 10);
        this.moonTimer %= 10;
        this.moonPhase = (this.moonPhase + phases) % MOON_PHASES.length;
        this.hero.game.audio?.play('moon');
    }

    updatePenance(enemies, stats) {
        if (this.cooldownRemaining > 0 || this.hero.stunTimer > 0 || !this.hero.game.heroes.includes(this.hero)) return;
        const boss = this.hero.abilitySystem.getTargetsInRange(enemies, stats.range * 1.3, stats)
            .filter((enemy) => enemy.isBoss && !enemy.hasReachedEnd)
            .sort((a, b) => getRouteProgress(b) - getRouteProgress(a))[0];
        if (!boss) return;
        const missingHealth = 1 - boss.hp / boss.maxHp;
        const damage = Math.min(boss.maxHp * 0.12, stats.damage * (1.4 + missingHealth * 2.2) * this.getPowerScale());
        CombatSystem.applyDamage({ attackerType: this.hero.category, damage, damageCap: boss.maxHp * 0.12, armorPenetration: 0.55 }, boss, this.hero, this.hero.game.resourceManager, 1);
        this.hero.game.vfx?.addBeam(this.hero, boss, { color: '#ff7a1a', width: 10, duration: 0.35 });
        this.hero.game.audio?.play('penance');
        this.hero.recordAbility();
        this.cooldownRemaining = 11;
    }

    counterDaredevil(target, stats) {
        if (!target?.isAlive) return;
        CombatSystem.applyDamage({ attackerType: this.hero.category, damage: stats.damage * 0.72 * this.getPowerScale(), armorPenetration: 0.2 }, target, this.hero, this.hero.game.resourceManager, 1);
        this.hero.game.vfx?.addBurst(target.x, target.y, { color: '#e84545', radius: 28, duration: 0.2 });
        this.hero.game.audio?.play('counter');
        this.hero.recordAbility();
    }

    pullWithChain(target) {
        if (!this.isCovered(target, this.hero.getEffectiveStats()) || target.flying || target.hellChainRecovery > 0
            || !this.hero.game.heroes.includes(this.hero)) return;
        const moved = target.moveBackward?.(target.isBoss ? 24 : 58) || 0;
        if (moved <= 0) return;
        target.hellChainRecovery = 6;
        this.hero.game.vfx?.addBeam(this.hero, target, { color: '#ff7a1a', width: 5, duration: 0.25 });
        this.hero.game.audio?.play('chain');
        this.hero.recordAbility();
    }

    impactSheHulk(target, stats) {
        if (!target?.isAlive || (target.stealth && !stats.canSeeStealth)
            || !isPointInRangePattern(this.hero, target, stats.range, this.hero.rangePattern, stats.rangeGeometryScale)) return;
        const victims = [target, ...(this.hero.game.enemies || [])
            .filter((enemy) => enemy !== target && enemy.isAlive && (!enemy.stealth || stats.canSeeStealth) && distance(enemy, target) <= 58)
            .sort((a, b) => b.distanceTravelled - a.distanceTravelled).slice(0, 3)];
        this.attackCount = 0;
        this.cooldownRemaining = 4;
        victims.forEach((enemy) => {
            CombatSystem.applyDamage({ attackerType: this.hero.category, damage: stats.damage * 0.55 * this.getPowerScale(), armorPenetration: 0.15 }, enemy, this.hero, this.hero.game.resourceManager, 1);
            if (enemy.isAlive) {
                enemy.applyStatus?.({ type: 'knockback', duration: 0, power: enemy.isBoss ? 18 : 38 }, this.hero);
                enemy.applyStatus?.({ type: 'mark', duration: 2.4, power: 0.14 }, this.hero);
                if (enemy === target) enemy.applyStatus?.({ type: 'stun', duration: 0.7, power: 1 }, this.hero);
            }
        });
        this.hero.game.vfx?.addRing(target.x, target.y, { color: '#91ed55', radius: 62, duration: 0.32 });
        this.hero.game.audio?.play('impact');
        this.hero.recordAbility();
    }

    getPowerScale() {
        const progression = this.hero.game.progression?.getHeroBonuses(this.hero.id);
        const synergy = this.hero.game.teamSynergy?.getAbilityModifiers(this.hero);
        return 1 + Math.min(0.35, Math.max(0, this.hero.level - 1) * 0.035) + (progression?.abilityPower || 0) + (synergy?.abilityPower || 0);
    }

    isCovered(target, stats) {
        return target?.isAlive && !target.hasReachedEnd && !(this.hero.stunTimer > 0)
            && (!target.stealth || stats.canSeeStealth)
            && isPointInRangePattern(this.hero, target, stats.range, this.hero.rangePattern, stats.rangeGeometryScale);
    }

    stompKorg(enemies, stats) {
        if (this.cooldownRemaining > 0 || this.hero.stunTimer > 0) return;
        const victims = enemies.filter(enemy => this.isCovered(enemy, stats) && !enemy.flying && distance(enemy, this.hero) <= 65)
            .sort((a, b) => getRouteProgress(b) - getRouteProgress(a)).slice(0, 5);
        if (victims.length < 3) return;
        this.cooldownRemaining = 5;
        for (const enemy of victims) {
            CombatSystem.applyDamage({ attackerType: this.hero.category, damage: stats.damage * 0.5 }, enemy, this.hero, this.hero.game.resourceManager, 1);
            if (enemy.isAlive) enemy.applyStatus?.({ type: 'slow', duration: 1.5, power: 0.35 }, this.hero);
        }
        this.hero.recordAbility();
        this.hero.game.vfx?.addRing(this.hero.x, this.hero.y, { color: '#a3a3a3', radius: 65, duration: 0.35 });
    }

    getCooldown(base) {
        return applyCooldownReductions(this.hero, base);
    }

    getModeLabel() {
        const config = STREET_CONTROLS[this.hero.id];
        return config?.options.find((option) => option.id === this.mode)?.label || '';
    }
}

function timerState(label, progress, ready) {
    return { label, progress: Math.max(0, Math.min(1, progress)), ready };
}

function staticState(label) {
    return { label, progress: null, ready: true };
}

function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

export { MOON_PHASES, STREET_CONTROLS };
