import { CombatSystem } from './CombatSystem.js';
import { isPointInRangePattern } from '../utils/RangePattern.js';

const PERIOD = { human_torch: 7, the_hood: 3, psylocke: 5, venom: 6 };
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const status = (enemy, type) => enemy?.debuffs?.some(effect => effect.type === type && effect.duration > 0
    && (!effect.fieldActive || effect.fieldActive()));

export class DarkfireKitSystem {
    constructor(hero) { this.hero = hero; this.reset(); }

    reset() {
        this.x = this.hero.x; this.y = this.hero.y;
        this.cooldown = PERIOD[this.hero.id]; this.zone = null; this.pact = null;
        this.focus = null; this.concentration = 0; this.idle = 0;
    }

    active() {
        return this.hero.game.heroes.includes(this.hero) && !(this.hero.stunTimer > 0)
            && this.x === this.hero.x && this.y === this.hero.y;
    }

    covered(enemy, stats = this.hero.getEffectiveStats()) {
        return enemy?.isAlive && !enemy.hasReachedEnd && (!enemy.stealth || stats.canSeeStealth)
            && isPointInRangePattern(this.hero, enemy, stats.range, this.hero.rangePattern, stats.rangeGeometryScale);
    }

    ready(target) { return this.active() && this.cooldown === 0 && this.covered(target); }

    cashPact(target) {
        return this.active() && this.pact?.target === target && this.pact.age >= 1.5 && this.pact.age < 4
            && this.covered(target) && status(target, 'curse');
    }

    precise(target) {
        return this.hero.id === 'psylocke' && this.ready(target) && this.focus === target
            && this.concentration >= 1.5 && this.idle < 3 && status(target, 'mark');
    }

    criticalMultiplier(target) { return this.precise(target) ? 2.75 : 0; }

    damageMultiplier(target) {
        return this.hero.id === 'the_hood' && this.pact ? this.cashPact(target) ? 1.8 : 0.75 : 1;
    }

    attackEffects(target) {
        if (this.precise(target)) return [{ type: 'armorBreak', power: 0.28, duration: 2, chance: 1 }];
        if (this.hero.id === 'the_hood' && !this.pact && this.ready(target)) return [
            { type: 'curse', power: 0.0038, duration: 3.6, chance: 1 },
            { type: 'mark', power: 0.16, duration: 2.4, chance: 1 }
        ];
        return [];
    }

    update(dt) {
        if (!this.active()) { this.reset(); return; }
        this.cooldown = Math.max(0, this.cooldown - dt);
        if (this.pact) {
            this.pact.age += dt;
            if (!this.covered(this.pact.target) || this.pact.age >= 4) { this.pact = null; this.cooldown = 4; }
        }
        if (this.focus) {
            this.idle += dt;
            if (!this.covered(this.focus) || !status(this.focus, 'mark') || this.idle >= 3) {
                this.focus = null; this.concentration = 0;
            } else this.concentration = Math.min(1.5, this.concentration + dt);
        }
        if (!this.zone) return;
        const zone = this.zone, elapsed = Math.min(dt, zone.remaining);
        zone.remaining = Math.max(0, zone.remaining - dt);
        for (const enemy of zone.heat.keys()) {
            if (!this.covered(enemy) || distance(enemy, zone) > 55) zone.heat.delete(enemy);
        }
        const candidates = this.hero.game.enemies.filter(enemy => this.covered(enemy) && distance(enemy, zone) <= 55)
            .sort((a, b) => distance(a, zone) - distance(b, zone));
        for (const enemy of candidates) {
            if (!zone.heat.has(enemy) && zone.heat.size >= 4) continue;
            zone.heat.set(enemy, zone.heat.has(enemy) ? zone.heat.get(enemy) + elapsed : 0);
        }
        if (zone.remaining > 0) return;
        this.zone = null;
        for (const [enemy, heat] of zone.heat) {
            if (heat >= 2) this.deal(enemy, zone.damage, '#ff7b3d');
        }
        this.hero.game.vfx?.addRing(zone.x, zone.y, { color: '#ff7b3d', radius: 55, duration: 0.3 });
    }

    deal(target, damage, color, damageCap) {
        CombatSystem.applyDamage({ damage, damageCap, attackerType: this.hero.category, secondaryEntity: true },
            target, this.hero, this.hero.game.resourceManager, 1);
        this.hero.game.vfx?.addBurst(target.x, target.y, { color, radius: 20, duration: 0.25 });
    }

    onAttack(target, stats) {
        if (!this.active() || !this.covered(target, stats)) return;
        if (this.hero.id === 'the_hood') {
            if (this.pact) {
                if (!this.cashPact(target)) return;
                this.pact = null; this.cooldown = 4; this.hero.recordAbility(); return;
            }
            if (this.cooldown > 0) return;
            this.pact = { target, age: 0 }; this.hero.recordAbility(); return;
        }
        if (this.hero.id === 'psylocke') {
            if (this.precise(target)) {
                this.cooldown = 5; this.concentration = 0; this.hero.recordAbility();
            } else if (this.focus !== target) this.concentration = 0;
            this.focus = status(target, 'mark') ? target : null; this.idle = 0;
            return;
        }
        if (this.cooldown > 0) return;
        if (this.hero.id === 'human_torch') {
            this.zone = { x: target.x, y: target.y, remaining: 3, damage: stats.damage * 0.9, heat: new Map() };
            this.update(0);
        } else if (this.hero.id === 'venom') {
            if (target.consumePoison(this.hero, 3) !== 3) return;
            if (target.isAlive) {
                const damage = Math.min(stats.damage * 4, stats.damage * 1.5 + target.maxHp * 0.01);
                this.deal(target, damage, '#a3e635', target.isBoss ? target.maxHp * 0.02 : undefined);
            }
        }
        this.cooldown = PERIOD[this.hero.id]; this.hero.recordAbility();
    }

    getDisplayState() {
        const label = { human_torch: this.zone ? `Ignicion ${this.zone.remaining.toFixed(1)}s` : 'Zona caliente',
            the_hood: this.pact ? this.pact.age < 1.5 ? 'Pacto: preparando (-25% dano)' : 'Pacto: cobrar a la presa' : 'Pacto: maldicion',
            psylocke: `Concentracion ${this.concentration.toFixed(1)}/1.5s`, venom: 'Devorar: 3 venenos propios' }[this.hero.id];
        return { label: `${label} | ${this.cooldown.toFixed(1)}s`, progress: Math.max(0, 1 - this.cooldown / PERIOD[this.hero.id]), ready: this.cooldown === 0 };
    }

    render(ctx) {
        if (!this.active() || !this.zone) return;
        ctx.save(); ctx.strokeStyle = '#ff7b3d'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(this.zone.x, this.zone.y, 55, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
}
