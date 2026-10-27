import { CombatSystem } from './CombatSystem.js';
import { isPointInRangePattern } from '../utils/RangePattern.js';

const PERIOD = { black_cat: 3, elsa_bloodstone: 4, gambit: 4, hela: 6 };
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const elite = target => target.isBoss || target.threat >= 4;

export class FateKitSystem {
    constructor(hero) { this.hero = hero; this.reset(); }

    reset() {
        this.x = this.hero.x; this.y = this.hero.y;
        this.cooldown = PERIOD[this.hero.id];
        this.charge = 0; this.target = null; this.idle = 0; this.spine = null;
    }

    active() {
        return this.hero.game.heroes.includes(this.hero) && !(this.hero.stunTimer > 0)
            && this.x === this.hero.x && this.y === this.hero.y;
    }

    inCoverage(target, stats = this.hero.getEffectiveStats()) {
        return target && !target.hasReachedEnd && (!target.stealth || stats.canSeeStealth)
            && isPointInRangePattern(this.hero, target, stats.range, this.hero.rangePattern, stats.rangeGeometryScale);
    }

    covered(target, stats) { return target?.isAlive && this.inCoverage(target, stats); }

    prepared(target) {
        return this.active() && this.cooldown === 0 && this.charge === 3 && this.covered(target)
            && (this.hero.id === 'black_cat' || (this.target === target && this.idle < 2.5))
            && (this.hero.id !== 'elsa_bloodstone' || elite(target));
    }

    criticalMultiplier(target) { return this.hero.id === 'black_cat' && this.prepared(target) ? 2 : 0; }

    damageMultiplier(target) { return this.hero.id === 'elsa_bloodstone' && this.prepared(target) ? 1.2 : 1; }

    attackEffects(target) {
        return this.hero.id === 'elsa_bloodstone' && this.prepared(target)
            ? [{ type: 'poison', power: 0.0054, duration: 4, stacks: 2, chance: 1 }] : [];
    }

    update(dt) {
        if (!this.active()) { this.reset(); return; }
        this.cooldown = Math.max(0, this.cooldown - dt);
        this.idle += dt;
        if (['elsa_bloodstone', 'gambit'].includes(this.hero.id)
            && (this.idle >= 2.5 || !this.covered(this.target))) { this.charge = 0; this.target = null; }
        if (!this.spine) return;
        this.spine.remaining = Math.max(0, this.spine.remaining - dt);
        if (this.spine.remaining > 0) return;
        const spine = this.spine;
        this.spine = null;
        const victims = this.hero.game.enemies.filter(enemy => this.covered(enemy) && distance(enemy, spine) <= 65)
            .sort((a, b) => distance(a, spine) - distance(b, spine)).slice(0, 3);
        for (const enemy of victims) this.deal(enemy, spine.damage, '#69e58c', spine);
    }

    deal(target, damage, color, origin = this.hero) {
        CombatSystem.applyDamage({ damage, attackerType: this.hero.category, secondaryEntity: true },
            target, this.hero, this.hero.game.resourceManager, 1);
        this.hero.game.vfx?.addBeam(origin, target, { color, width: 3, duration: 0.2 });
    }

    onAttack(target, stats, projectile) {
        if (!this.active() || !this.covered(target, stats)) return;
        if (this.hero.id === 'black_cat') {
            const ready = this.prepared(target);
            if (projectile?.critical) {
                this.charge = 0;
                if (ready) { this.cooldown = 3; this.hero.recordAbility(); }
            } else this.charge = Math.min(3, this.charge + 1);
            return;
        }
        if (!['elsa_bloodstone', 'gambit'].includes(this.hero.id)) return;
        if (this.hero.id === 'elsa_bloodstone' && !elite(target)) {
            this.charge = 0; this.target = null; return;
        }
        if (this.prepared(target)) {
            this.charge = 0; this.cooldown = 4;
            if (this.hero.id === 'gambit') {
                const victims = [target, ...this.hero.game.enemies.filter(enemy => enemy !== target && this.covered(enemy, stats)
                    && distance(enemy, target) <= 60).sort((a, b) => distance(a, target) - distance(b, target)).slice(0, 3)];
                for (const enemy of victims) this.deal(enemy, stats.damage * 0.65, '#d86cff', target);
                this.hero.game.vfx?.addRing(target.x, target.y, { color: '#d86cff', radius: 60, duration: 0.25 });
            }
            this.hero.recordAbility();
        } else this.charge = this.target === target && this.idle < 2.5 ? Math.min(3, this.charge + 1) : 1;
        this.target = target; this.idle = 0;
    }

    onKill(target) {
        if (this.hero.id !== 'hela' || !this.active() || this.cooldown > 0 || this.spine || target?.isAlive
            || !this.inCoverage(target) || !target.debuffs?.some(effect => effect.type === 'curse' && effect.duration > 0)) return;
        this.spine = { x: target.x, y: target.y, remaining: 0.6, damage: this.hero.getEffectiveStats().damage * 0.7 };
        this.cooldown = 6;
        this.hero.recordAbility();
    }

    getDisplayState() {
        const label = { black_cat: `Mala suerte ${this.charge}/3`, elsa_bloodstone: `Caceria elite ${this.charge}/3`,
            gambit: `Carga cinetica ${this.charge}/3`, hela: this.spine ? 'Necroespinas preparadas' : 'Necroespinas: baja maldita' }[this.hero.id];
        return { label: `${label} | ${this.cooldown.toFixed(1)}s`, progress: this.hero.id === 'hela'
            ? 1 - this.cooldown / 6 : this.charge / 3, ready: this.cooldown === 0 && (this.hero.id === 'hela' || this.charge === 3) };
    }

    render(ctx) {
        const center = this.spine || (this.charge === 3 && this.covered(this.target) ? this.target : null);
        if (!this.active() || !center) return;
        ctx.save(); ctx.strokeStyle = this.hero.id === 'hela' ? '#69e58c' : this.hero.id === 'gambit' ? '#d86cff' : '#ff3b5f';
        ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(center.x, center.y, this.spine ? 20 : 14, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
}
