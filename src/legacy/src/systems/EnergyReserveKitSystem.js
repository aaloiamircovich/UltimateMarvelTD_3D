import { CombatSystem } from './CombatSystem.js';
import { isPointInRangePattern } from '../utils/RangePattern.js';
import { getLineEndpoint, getLineTargets } from '../utils/LineTargeting.js';

export const ENERGY_PERIOD = { nova: 6, black_bolt: 10, magneto: 6, adam_warlock: 12,
    ms_marvel: 4, sentry: 10, beta_ray_bill: 4, yondu: 0 };
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export class EnergyReserveKitSystem {
    constructor(hero) { this.hero = hero; this.reset(); }

    reset() {
        this.x = this.hero.x; this.y = this.hero.y;
        this.cooldown = ENERGY_PERIOD[this.hero.id];
        this.charge = 0; this.idle = 0; this.burst = 0; this.exhaustion = 0;
        this.target = null; this.pending = null; this.flight = null; this.route = null;
    }

    active() {
        return this.hero.game.heroes.includes(this.hero) && !(this.hero.stunTimer > 0)
            && this.x === this.hero.x && this.y === this.hero.y;
    }

    covered(enemy, stats = this.hero.getEffectiveStats()) {
        return enemy?.isAlive && !enemy.hasReachedEnd && (!enemy.stealth || stats.canSeeStealth)
            && isPointInRangePattern(this.hero, enemy, stats.range, this.hero.rangePattern, stats.rangeGeometryScale);
    }

    canAttack() {
        return !this.pending && !(this.hero.id === 'yondu' && (this.flight || this.route));
    }

    damageMultiplier() {
        if (this.hero.id === 'adam_warlock' && this.burst > 0) return 1.45;
        return this.hero.id === 'sentry' && this.exhaustion > 0 ? 0.65 : 1;
    }

    getProjectileProfile() {
        return ['ms_marvel', 'yondu'].includes(this.hero.id) ? { chainCount: 0 }
            : this.hero.id === 'beta_ray_bill' ? { chainCount: 1 } : {};
    }

    prepareProjectile(config, target, stats) {
        if (!['ms_marvel', 'yondu', 'beta_ray_bill'].includes(this.hero.id)
            || !this.active() || this.cooldown > 0 || this.flight || this.route || !this.covered(target, stats)) return;
        // Token identity prevents stale, pooled or signature projectiles from starting another route.
        const token = {};
        config.energyToken = token;
        this.flight = { token, remaining: 2.5, damage: stats.damage, target };
        this.cooldown = ENERGY_PERIOD[this.hero.id];
    }

    onImpact(projectile, target) {
        if (!this.active() || target?.hasReachedEnd || projectile.secondaryEntity || !this.flight
            || target !== this.flight.target || projectile.energyToken !== this.flight.token) return;
        const flight = this.flight; this.flight = null;
        this.route = { remaining: this.hero.id === 'beta_ray_bill' ? 0.6 : 0.22, origin: { x: target.x, y: target.y }, primary: target,
            visited: new Set([target]), damage: flight.damage, steps: 0, returning: false };
        this.hero.recordAbility();
    }

    onBarrierBroken(projectile) {
        if (this.hero.id === 'magneto' && this.active() && !projectile.secondaryEntity)
            this.charge = Math.min(3, this.charge + 1);
    }

    deal(target, damage, origin = this.hero, penetration = 0) {
        if (!target?.isAlive || target.hasReachedEnd) return;
        CombatSystem.applyDamage({ damage, attackerType: this.hero.category, armorPenetration: penetration,
            secondaryEntity: true }, target, this.hero, this.hero.game.resourceManager, 1);
        this.hero.game.vfx?.addBeam?.(origin, target, { color: this.hero.config.special?.projectileColor || '#facc15', width: 4, duration: 0.22 });
    }

    updateRoute(dt) {
        const route = this.route;
        if (!route) return;
        route.remaining = Math.max(0, route.remaining - dt);
        if (route.remaining > 0) return;
        if (route.returning) { this.route = null; return; }
        if (this.hero.id === 'beta_ray_bill') {
            if (this.covered(route.primary)) this.deal(route.primary, route.damage * 1.2, this.hero, 0.25);
            this.route = null; return;
        }
        const limit = this.hero.id === 'yondu' ? 2 : 1;
        const next = this.hero.game.enemies.filter(e => !route.visited.has(e) && this.covered(e)
            && distance(route.origin, e) <= (this.hero.id === 'yondu' ? 95 : 105))
            .sort((a, b) => distance(route.origin, a) - distance(route.origin, b))[0];
        if (next && route.steps < limit) {
            this.deal(next, route.damage * (this.hero.id === 'yondu' ? 0.6 : 1.05), route.origin);
            route.segmentFrom = route.origin;
            route.visited.add(next); route.steps++; route.origin = { x: next.x, y: next.y };
            route.remaining = 0.22;
            return;
        }
        this.hero.game.vfx?.addBeam?.(route.origin, this.hero, { color: '#ef4444', width: 2, duration: 0.22 });
        route.segmentFrom = route.origin; route.origin = { x: this.hero.x, y: this.hero.y };
        route.returning = true; route.remaining = 0.22;
    }

    update(dt) {
        if (!this.active()) { this.reset(); return; }
        this.cooldown = Math.max(0, this.cooldown - dt);
        this.exhaustion = Math.max(0, this.exhaustion - dt);
        if (this.flight) {
            this.flight.remaining -= dt;
            if (this.flight.remaining <= 0 || !this.flight.target.isAlive || this.flight.target.hasReachedEnd) this.flight = null;
        }
        this.updateRoute(dt);
        const stats = this.hero.getEffectiveStats();
        if (this.target && !this.covered(this.target, stats)) { this.target = null; if (this.hero.id === 'black_bolt') this.charge = 0; }
        if (this.pending) {
            const pending = this.pending;
            if (pending.kind === 'voice' && (!this.covered(pending.target, stats)
                || !getLineTargets(this.hero, pending.endpoint, [pending.target], pending.length, 24).length)) {
                this.pending = null; return;
            }
            pending.remaining = Math.max(0, pending.remaining - dt);
            if (pending.remaining > 0) return;
            this.pending = null;
            if (pending.kind === 'cocoon') { this.burst = 3; return; }
            const victims = pending.kind === 'voice'
                ? getLineTargets(this.hero, pending.endpoint, this.hero.game.enemies.filter(e => !e.hasReachedEnd), pending.length, 24)
                : this.hero.game.enemies.filter(e => e.isAlive && !e.hasReachedEnd && distance(this.hero, e) <= pending.radius);
            victims.sort((a, b) => distance(this.hero, a) - distance(this.hero, b)).slice(0, 5)
                .forEach(e => this.deal(e, pending.damage, this.hero, pending.kind === 'voice' ? 0.45 : 0.15));
            if (pending.kind === 'solar') this.exhaustion = 2;
            return;
        }
        if (this.hero.id === 'adam_warlock' && !this.burst) {
            this.idle = this.hero.game.enemies.some(e => this.covered(e, stats)) ? 0 : this.idle + dt;
            if (this.idle >= 2 && this.cooldown === 0) {
                this.pending = { kind: 'cocoon', remaining: 2, total: 2 };
                this.cooldown = 12; this.idle = 0; this.hero.recordAbility();
            }
        }
    }

    onAttack(target, stats) {
        if (!this.active() || !this.canAttack() || !this.covered(target, stats)) return;
        const id = this.hero.id;
        if (id === 'adam_warlock') { this.burst = Math.max(0, this.burst - 1); this.idle = 0; return; }
        if (id === 'black_bolt') {
            this.charge = this.target === target ? Math.min(3, this.charge + 1) : 1; this.target = target;
        } else if (id === 'nova' || (id === 'sentry' && this.exhaustion === 0)) this.charge = Math.min(6, this.charge + 1);
        if (this.cooldown > 0 || this.exhaustion > 0) return;
        if (id === 'black_bolt' && this.charge >= 3) {
            const length = stats.range * 1.2;
            this.pending = { kind: 'voice', target, endpoint: getLineEndpoint(this.hero, target, length), length,
                remaining: 1, total: 1, damage: stats.damage * 2.5 };
        } else if (id === 'sentry' && this.charge >= 6) {
            this.pending = { kind: 'solar', radius: stats.range, remaining: 0.5, total: 0.5, damage: stats.damage * 1.3 };
        } else if ((id === 'nova' && this.charge >= 5) || (id === 'magneto' && this.charge >= 3)) {
            const radius = id === 'nova' ? 70 : 85;
            this.hero.game.enemies.filter(e => e.isAlive && !e.hasReachedEnd && distance(e, target) <= radius)
                .sort((a, b) => distance(a, target) - distance(b, target)).slice(0, 4)
                .forEach(e => this.deal(e, stats.damage * (id === 'nova' ? 1.1 : 1.2), target, id === 'magneto' ? 0.45 : 0.16));
            this.hero.game.vfx?.addBurst?.(target.x, target.y, { color: '#ffd447', radius, duration: 0.3 });
        } else return;
        this.charge = 0; this.cooldown = ENERGY_PERIOD[id]; this.hero.recordAbility();
    }

    getDisplayState() {
        const labels = { nova: `Pulso ${this.charge}/5`, black_bolt: `Voz ${this.charge}/3`,
            magneto: `Fragmentos ${this.charge}/3`, adam_warlock: `Capullo | Rafaga ${this.burst}/3`,
            ms_marvel: 'Remate fotonico', sentry: this.exhaustion ? 'Agotamiento solar' : `Solar ${this.charge}/6`,
            beta_ray_bill: 'Retorno de Stormbreaker', yondu: this.flight || this.route ? 'Yaka en vuelo' : 'Yaka lista' };
        return { label: `${labels[this.hero.id]} | ${this.pending ? 'Preparando' : `${this.cooldown.toFixed(1)}s`}`,
            progress: this.pending ? 1 - this.pending.remaining / this.pending.total : null,
            ready: !this.pending && this.cooldown === 0 && !this.exhaustion };
    }

    render(ctx) {
        if (!this.active()) return;
        if (this.route && this.hero.id === 'yondu') {
            const route = this.route, from = route.segmentFrom || route.origin;
            const t = this.hero.game.reduceMotion ? 1 : Math.max(0, Math.min(1, 1 - route.remaining / 0.22));
            ctx.save(); ctx.fillStyle = '#ef4444'; ctx.beginPath();
            ctx.arc(from.x + (route.origin.x - from.x) * t, from.y + (route.origin.y - from.y) * t, 4, 0, Math.PI * 2);
            ctx.fill(); ctx.restore();
        }
        if (!this.pending) return;
        ctx.save(); ctx.strokeStyle = this.pending.kind === 'cocoon' ? '#facc15' : '#38bdf8'; ctx.lineWidth = 2;
        ctx.beginPath();
        if (this.pending.endpoint) { ctx.moveTo(this.hero.x, this.hero.y); ctx.lineTo(this.pending.endpoint.x, this.pending.endpoint.y); }
        else ctx.arc(this.hero.x, this.hero.y, this.pending.radius || 26, 0, Math.PI * 2);
        ctx.stroke(); ctx.restore();
    }
}
