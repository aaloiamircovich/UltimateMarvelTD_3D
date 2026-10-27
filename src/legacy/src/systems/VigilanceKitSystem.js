import { CombatSystem } from './CombatSystem.js';
import { isPointInRangePattern } from '../utils/RangePattern.js';
import { getRouteProgress } from '../utils/PathUtils.js';

const PERIOD = { heimdall: 5, squirrel_girl: 6 };

export class VigilanceKitSystem {
    constructor(hero) { this.hero = hero; this.reset(); }

    reset() {
        this.x = this.hero.x; this.y = this.hero.y;
        this.cooldown = PERIOD[this.hero.id];
        this.harassment = null;
    }

    active() {
        return this.hero.game.heroes.includes(this.hero) && !(this.hero.stunTimer > 0)
            && this.hero.x === this.x && this.hero.y === this.y;
    }

    covered(enemy, stats) {
        return enemy?.isAlive && !enemy.hasReachedEnd && (!enemy.stealth || stats.canSeeStealth)
            && isPointInRangePattern(this.hero, enemy, stats.range, this.hero.rangePattern, stats.rangeGeometryScale);
    }

    update(dt) {
        if (!this.active()) { this.reset(); return; }
        this.cooldown = Math.max(0, this.cooldown - dt);
        const stats = this.hero.getEffectiveStats();
        if (this.hero.id === 'heimdall') {
            if (this.cooldown > 0) return;
            const targets = this.hero.game.enemies.filter(enemy => this.covered(enemy, stats))
                .sort((a, b) => getRouteProgress(b) - getRouteProgress(a)).slice(0, 3);
            if (!targets.length) return;
            for (const target of targets) {
                target.applyStatus({ type: 'reveal', duration: 2.5, power: 1 }, this.hero);
                target.applyStatus({ type: 'mark', duration: 2.5, power: 0.11 }, this.hero);
                this.hero.game.vfx?.addBeam(this.hero, target, { color: '#facc15', width: 2, duration: 0.25 });
            }
            this.cooldown = 5;
            this.hero.recordAbility();
            return;
        }
        const state = this.harassment;
        if (!state) return;
        if (!this.covered(state.target, stats) || state.target.flying) { this.harassment = null; return; }
        state.elapsed += dt;
        // Four scheduled impacts, independent of frame rate or attack speed.
        while (state.hits < 4 && state.elapsed >= (state.hits + 1) * 0.75) {
            state.hits++;
            CombatSystem.applyDamage({ damage: state.damage, attackerType: this.hero.category, secondaryEntity: true },
                state.target, this.hero, this.hero.game.resourceManager, 1);
            if (!state.target.isAlive) break;
            if (state.hits === 1) state.target.applyStatus({ type: 'slow', power: 0.28, duration: 1.4 }, this.hero);
            this.hero.game.vfx?.addBurst(state.target.x, state.target.y, { color: '#f59e0b', radius: 14, duration: 0.15 });
        }
        if (state.hits === 4 || !state.target.isAlive) this.harassment = null;
    }

    onAttack(target, stats) {
        if (this.hero.id !== 'squirrel_girl' || !this.active() || this.cooldown > 0 || this.harassment
            || !this.covered(target, stats)) return;
        const candidate = this.hero.game.enemies.filter(enemy => !enemy.flying && this.covered(enemy, stats))
            .sort((a, b) => getRouteProgress(b) - getRouteProgress(a))[0];
        if (!candidate) return;
        this.harassment = { target: candidate, elapsed: 0, hits: 0, damage: stats.damage * 0.3 };
        this.cooldown = 6;
        this.hero.recordAbility();
    }

    getDisplayState() {
        return { label: this.harassment ? `Hostigamiento ${this.harassment.hits}/4`
            : `${this.hero.id === 'heimdall' ? 'Vigilancia: 3 amenazas' : 'Hostigamiento'} | ${this.cooldown.toFixed(1)}s`,
        progress: 1 - this.cooldown / PERIOD[this.hero.id], ready: this.cooldown === 0 };
    }

    render(ctx) {
        const state = this.harassment;
        if (!state || !this.active()) return;
        ctx.save(); ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(state.target.x, state.target.y, 13, state.elapsed * 4, state.elapsed * 4 + Math.PI * 1.5);
        ctx.stroke(); ctx.restore();
    }
}
