import { isPointInRangePattern } from '../utils/RangePattern.js';

export class TargetFocusSystem {
    constructor(hero) {
        this.hero = hero;
        this.shockCooldown = 2;
        this.reset();
    }

    reset() {
        this.target = null;
        this.elapsed = 0;
        this.stacks = 0;
        this.idle = 0;
        this.x = this.hero.x;
        this.y = this.hero.y;
    }

    isEligible(target) {
        if (this.hero.id === 'angela' && !target) return false;
        if (this.hero.id === 'angela' && (this.hero.game.enemies || []).some(enemy => enemy !== target
            && enemy.isAlive && !enemy.hasReachedEnd && Math.hypot(enemy.x - target.x, enemy.y - target.y) <= 90)) return false;
        if (!['cable', 'drax', 'angela'].includes(this.hero.id)) return true;
        return Boolean(target?.isBoss || target?.isFinalBoss || target?.isMiniBoss
            || target?.config?.isBoss || target?.config?.isFinalBoss || target?.config?.isMiniBoss
            || (target?.threat || 0) >= 4);
    }

    matches(target) {
        if (!target?.isAlive || target !== this.target || this.hero.stunTimer > 0
            || this.x !== this.hero.x || this.y !== this.hero.y || !this.isEligible(target)) return false;
        const stats = this.hero.getEffectiveStats();
        return (!target.stealth || stats.canSeeStealth)
            && isPointInRangePattern(this.hero, target, stats.range, this.hero.rangePattern, stats.rangeGeometryScale);
    }

    update(dt, enemies = this.hero.game.enemies || []) {
        this.shockCooldown = Math.max(0, this.shockCooldown - dt);
        if (this.hero.stunTimer > 0 || this.x !== this.hero.x || this.y !== this.hero.y) {
            this.reset();
            return;
        }
        if (this.hero.id !== 'cable') {
            this.idle += dt;
            if (!this.matches(this.target) || this.idle >= 2.5) this.reset();
            return;
        }
        const target = this.hero.getBestTarget(enemies, this.hero.getEffectiveStats());
        if (!target || !this.isEligible(target)) { this.reset(); return; }
        if (target !== this.target) { this.reset(); this.target = target; return; }
        this.elapsed = Math.min(3, this.elapsed + dt);
    }

    damageMultiplier(target) {
        if (this.hero.id === 'angela') return this.matches(target) && this.stacks === 3 ? 1.9 : 1;
        if (this.hero.id === 'drax') return this.matches(target) ? 1 + Math.min(5, this.stacks) * 0.08 : 1;
        if (this.hero.id === 'echo') return this.matches(target) && this.stacks === 3 ? 1.6 : 1;
        if (this.hero.id === 'yelena_belova') return this.matches(target)
            && target.debuffs?.some(e => e.type === 'mark' && e.duration > 0) ? 1.2 : 1;
        if (this.hero.id === 'mockingbird') return this.matches(target) && this.stacks === 1 ? 1.4 : 1;
        return this.hero.id === 'cable' && this.matches(target) && this.elapsed >= 3 ? 1.9 : 1;
    }

    criticalMultiplier(target) {
        return this.hero.id === 'x_23' && this.matches(target) && this.stacks === 3
            && target.debuffs?.some(effect => effect.type === 'bleed' && effect.duration > 0) ? 3 : 0;
    }

    attackEffects(target) {
        if (this.hero.id === 'echo') return this.matches(target) && this.stacks === 3
            ? [{ type: 'mark', duration: 2.2, power: 0.12, chance: 1 }] : [];
        if (this.hero.id === 'okoye') return this.matches(target) && this.stacks === 2
            ? [{ type: 'armorBreak', duration: 3, power: 0.22, chance: 1 }] : [];
        return this.hero.id === 'mockingbird' && this.matches(target) && this.stacks === 1 && this.shockCooldown <= 0
            ? [{ type: 'stun', duration: 0.35, power: 1, chance: 1 }] : [];
    }

    penetration(target = this.target) {
        if (this.hero.id !== 'nebula' || !this.matches(target) || !this.stacks) return 0;
        const category = String(target.category || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        return this.stacks * 0.1 + (category === 'tecnologico' ? 0.1 : 0);
    }

    onAttack(target) {
        if (this.hero.id === 'angela') {
            if (!this.isEligible(target)) { this.reset(); return; }
            const prepared = this.matches(target) && this.stacks === 3;
            const stacks = prepared ? 0 : this.matches(target) ? Math.min(3, this.stacks + 1) : 1;
            if (prepared) this.hero.recordAbility();
            this.reset(); this.target = target; this.stacks = stacks;
            return;
        }
        if (this.hero.id === 'drax' && !this.isEligible(target)) { this.reset(); return; }
        if (this.hero.id === 'echo') {
            const prepared = this.matches(target) && this.stacks === 3;
            const stacks = prepared ? 0 : this.matches(target) ? Math.min(3, this.stacks + 1) : 1;
            if (prepared) this.hero.recordAbility();
            this.reset(); this.target = target; this.stacks = stacks;
            return;
        }
        if (this.hero.id === 'okoye') {
            const prepared = this.matches(target) && this.stacks === 2;
            const stacks = prepared ? 0 : this.matches(target) ? Math.min(2, this.stacks + 1) : 1;
            if (prepared) this.hero.recordAbility();
            this.reset(); this.target = target; this.stacks = stacks;
            return;
        }
        if (this.hero.id === 'x_23') {
            const finisher = this.criticalMultiplier(target) > 0;
            const stacks = finisher ? 0 : this.matches(target) ? Math.min(3, this.stacks + 1) : 1;
            if (finisher) this.hero.recordAbility();
            this.reset(); this.target = target; this.stacks = stacks;
            return;
        }
        if (this.hero.id === 'mockingbird') {
            const paired = this.matches(target) && this.stacks === 1;
            if (this.attackEffects(target).length) this.shockCooldown = 2;
            if (paired) this.hero.recordAbility();
            this.reset(); this.target = target; this.stacks = paired ? 0 : 1;
            return;
        }
        if (this.hero.id === 'cable') {
            if (this.damageMultiplier(target) > 1) { this.elapsed = 0; this.hero.recordAbility(); }
            return;
        }
        const stacks = this.matches(target) ? Math.min(5, this.stacks + 1) : 1;
        this.reset();
        this.target = target;
        this.stacks = stacks;
    }

    onKill(target) {
        if (this.hero.id !== 'yelena_belova' || target !== this.target || this.idle >= 2.5
            || this.hero.stunTimer > 0 || this.x !== this.hero.x || this.y !== this.hero.y
            || !this.hero.game.heroes?.includes(this.hero)
            || !target.debuffs?.some(e => e.type === 'mark' && e.duration > 0)) return;
        const stats = this.hero.getEffectiveStats();
        const next = (this.hero.game.enemies || []).filter(enemy => enemy !== target && enemy.isAlive
            && (!enemy.stealth || stats.canSeeStealth)
            && Math.hypot(enemy.x - target.x, enemy.y - target.y) <= 120
            && isPointInRangePattern(this.hero, enemy, stats.range, this.hero.rangePattern, stats.rangeGeometryScale))
            .sort((a, b) => Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y))[0];
        this.reset();
        if (!next) return;
        next.applyStatus?.({ type: 'mark', duration: 2, power: 0.06 }, this.hero);
        this.target = next;
        this.hero.recordAbility();
    }

    getDisplayState() {
        const valid = this.matches(this.target);
        if (this.hero.id === 'angela') return {
            label: `Caza aislada ${valid ? this.stacks : 0}/3`, progress: valid ? this.stacks / 3 : 0,
            ready: valid && this.stacks === 3
        };
        if (this.hero.id === 'drax') return {
            label: `Duelo elite +${valid ? this.stacks * 8 : 0}%`, progress: valid ? this.stacks / 5 : 0,
            ready: valid && this.stacks === 5
        };
        if (this.hero.id === 'echo') return {
            label: `Aprendizaje ${valid ? this.stacks : 0}/3`, progress: valid ? this.stacks / 3 : 0,
            ready: valid && this.stacks === 3
        };
        if (this.hero.id === 'okoye') return {
            label: `Estocadas ${valid ? this.stacks : 0}/2`, progress: valid ? this.stacks / 2 : 0,
            ready: valid && this.stacks === 2
        };
        if (this.hero.id === 'x_23') return {
            label: `Cortes ${valid ? this.stacks : 0}/3${valid && this.stacks === 3 ? ' | requiere sangrado' : ''}`,
            progress: valid ? this.stacks / 3 : 0, ready: this.criticalMultiplier(this.target) > 0
        };
        if (this.hero.id === 'yelena_belova') return {
            label: valid && this.damageMultiplier(this.target) > 1 ? 'Contrato: +20% dano' : 'Contrato sin marca',
            progress: null, ready: valid && this.damageMultiplier(this.target) > 1
        };
        if (this.hero.id === 'mockingbird') return {
            label: valid && this.stacks ? 'Segundo baston preparado' : 'Preparando doble baston',
            progress: valid ? this.stacks : 0, ready: valid && this.stacks === 1
        };
        if (this.hero.id === 'cable') return {
            label: valid && this.elapsed >= 3 ? 'Disparo temporal listo' : `Mira temporal ${valid ? this.elapsed.toFixed(1) : '0.0'}/3 s`,
            progress: valid ? this.elapsed / 3 : 0, ready: valid && this.elapsed >= 3
        };
        return { label: `Adaptacion: ${Math.round(this.penetration() * 100)}% penetracion`,
            progress: valid ? this.stacks / 5 : 0, ready: valid && this.stacks === 5 };
    }
}
