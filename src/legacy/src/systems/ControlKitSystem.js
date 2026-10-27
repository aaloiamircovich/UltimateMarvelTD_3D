import { CombatSystem } from './CombatSystem.js';
import { getLineEndpoint, getLineTargets } from '../utils/LineTargeting.js';
import { isPointInRangePattern } from '../utils/RangePattern.js';

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export class ControlKitSystem {
    constructor(hero) {
        this.hero = hero;
        this.reset();
    }

    reset() {
        this.x = this.hero.x;
        this.y = this.hero.y;
        this.cooldown = this.hero.id === 'quake' ? 4 : 5;
        this.links = [];
        this.remaining = 0;
    }

    active() {
        return this.x === this.hero.x && this.y === this.hero.y && !(this.hero.stunTimer > 0)
            && this.hero.game.heroes.includes(this.hero);
    }

    covered(enemy, stats = this.hero.getEffectiveStats()) {
        return enemy?.isAlive && !enemy.hasReachedEnd && (!enemy.stealth || stats.canSeeStealth)
            && isPointInRangePattern(this.hero, enemy, stats.range, this.hero.rangePattern, stats.rangeGeometryScale);
    }

    update(dt) {
        if (!this.active()) { this.reset(); return; }
        this.cooldown = Math.max(0, this.cooldown - dt);
        this.remaining = Math.max(0, this.remaining - dt);
        if (this.remaining === 0) this.links = [];
        else {
            const anchor = this.links[0];
            this.links = this.covered(anchor) ? this.links.filter(enemy => this.covered(enemy) && distance(enemy, anchor) <= 85) : [];
        }
    }

    onAttack(target, stats) {
        if (!this.active() || this.cooldown > 0 || !this.covered(target, stats)) return;
        const enemies = (this.hero.game.enemies || []).filter(enemy => this.covered(enemy, stats));
        if (this.hero.id === 'quake') {
            if (target.flying) return;
            const victims = getLineTargets(this.hero, target, enemies.filter(enemy => !enemy.flying), stats.range, 24)
                .sort((a, b) => distance(a, this.hero) - distance(b, this.hero)).slice(0, 5);
            for (const enemy of victims) {
                CombatSystem.applyDamage({ attackerType: this.hero.category, damage: stats.damage * 0.45 }, enemy, this.hero, this.hero.game.resourceManager, 1);
                if (enemy.isAlive) {
                    enemy.applyStatus({ type: 'armorBreak', power: 0.16, duration: 2 }, this.hero);
                    enemy.applyStatus({ type: 'slow', power: 0.3, duration: 1.2 }, this.hero);
                }
            }
            this.cooldown = 4;
            this.hero.game.vfx?.addBeam(this.hero, getLineEndpoint(this.hero, target, stats.range), { color: '#76e4f7', width: 10, duration: 0.3 });
        } else {
            this.links = [target, ...enemies.filter(enemy => enemy !== target && distance(enemy, target) <= 85)
                .sort((a, b) => distance(a, target) - distance(b, target)).slice(0, 2)];
            this.remaining = 2;
            const links = this.links;
            const anchor = target;
            for (const enemy of links) {
                enemy.applyFieldSlow(0.6 / links.length, 2, this.hero, () => this.active() && this.remaining > 0
                    && this.links.includes(enemy) && this.covered(anchor) && this.covered(enemy) && distance(enemy, anchor) <= 85);
            }
            this.cooldown = 5;
        }
        this.hero.recordAbility();
    }

    getDisplayState() {
        const label = this.hero.id === 'quake' ? 'Linea sismica' : `Sujecion ${this.links.length}/3`;
        const period = this.hero.id === 'quake' ? 4 : 5;
        return { label: `${label} | ${this.cooldown.toFixed(1)}s`, progress: 1 - this.cooldown / period, ready: this.cooldown === 0 };
    }

    render(ctx) {
        if (!this.active() || !this.links.length) return;
        ctx.save();
        ctx.strokeStyle = '#ff5d8f';
        ctx.lineWidth = 2;
        for (const enemy of this.links) {
            ctx.beginPath();
            ctx.moveTo(this.hero.x, this.hero.y);
            ctx.lineTo(enemy.x, enemy.y);
            ctx.stroke();
        }
        ctx.restore();
    }
}
