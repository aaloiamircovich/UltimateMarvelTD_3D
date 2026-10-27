import { isPointInRangePattern } from '../utils/RangePattern.js';
import { getLineTargetsToEndpoint } from '../utils/LineTargeting.js';
import { TERRAIN } from '../utils/TerrainRules.js';

const PERIOD = { namora: 3, triton: 6, jeff_the_land_shark: 6, luna_snow: 1.5 };
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export class CoastalKitSystem {
    constructor(hero) {
        this.hero = hero;
        this.attacked = new WeakSet();
        this.reset();
    }

    reset() {
        this.x = this.hero.x; this.y = this.hero.y;
        this.cooldown = PERIOD[this.hero.id];
        this.beat = 0; this.field = null;
    }

    active() {
        return !(this.hero.stunTimer > 0) && this.hero.game.heroes.includes(this.hero)
            && this.x === this.hero.x && this.y === this.hero.y;
    }

    inWater() {
        const { gridSize, terrainMap } = this.hero.game;
        return gridSize > 0 && terrainMap?.[Math.floor(this.hero.y / gridSize)]?.[Math.floor(this.hero.x / gridSize)] === TERRAIN.water;
    }

    covered(enemy, stats = this.hero.getEffectiveStats()) {
        return enemy?.isAlive && !enemy.hasReachedEnd && (!enemy.stealth || stats.canSeeStealth)
            && isPointInRangePattern(this.hero, enemy, stats.range, this.hero.rangePattern, stats.rangeGeometryScale);
    }

    ambush(target) {
        return this.hero.id === 'namora' && this.active() && this.inWater() && this.cooldown === 0
            && this.covered(target) && !this.attacked.has(target);
    }

    damageMultiplier(target) { return this.ambush(target) ? 1.65 : 1; }

    attackEffects(target) {
        return this.ambush(target) ? [{ type: 'armorBreak', power: 0.16, duration: 2.8, chance: 1 }] : [];
    }

    update(dt) {
        if (!this.active()) { this.reset(); return; }
        this.cooldown = Math.max(0, this.cooldown - dt);
        if (this.field) {
            this.field.remaining = Math.max(0, this.field.remaining - dt);
            if (this.field.remaining === 0) this.field = null;
            else this.applyCurrent();
        }
    }

    inside(enemy, field) {
        return enemy.isAlive && !enemy.hasReachedEnd && !enemy.flying
            && getLineTargetsToEndpoint(field.start, field.end, [enemy], 22).length > 0;
    }

    applyCurrent() {
        const field = this.field;
        for (const enemy of this.hero.game.enemies || []) {
            if (field.touched.has(enemy) || !this.inside(enemy, field)) continue;
            field.touched.add(enemy);
            enemy.applyFieldSlow(0.45, field.remaining, this.hero, () => this.active() && this.field === field
                && field.remaining > 0 && this.inside(enemy, field));
        }
    }

    onAttack(target, stats) {
        if (!this.active() || !this.covered(target, stats)) return;
        if (this.hero.id === 'namora') {
            const ready = this.ambush(target);
            this.attacked.add(target);
            if (ready) { this.cooldown = 3; this.hero.recordAbility(); }
            return;
        }
        if (this.cooldown > 0) return;
        const neighbors = (this.hero.game.enemies || []).filter(enemy => this.covered(enemy, stats))
            .sort((a, b) => distance(a, target) - distance(b, target));
        let color = '#67e8f9';
        if (this.hero.id === 'triton') {
            if (!this.inWater()) return;
            const hidden = neighbors.filter(enemy => enemy.nativeStealth && distance(enemy, target) <= 65).slice(0, 3);
            if (!hidden.length) return;
            for (const enemy of hidden) enemy.applyStatus({ type: 'reveal', power: 1, duration: 3 }, this.hero);
        } else if (this.hero.id === 'jeff_the_land_shark') {
            if (target.flying) return;
            const length = distance(this.hero, target);
            const dx = length ? (target.x - this.hero.x) / length : 1;
            const dy = length ? (target.y - this.hero.y) / length : 0;
            this.field = { start: { x: target.x - dx * 45, y: target.y - dy * 45 },
                end: { x: target.x + dx * 45, y: target.y + dy * 45 }, remaining: 2.5, touched: new Set() };
            this.applyCurrent();
        } else {
            const power = this.beat === 0 ? 0.25 : 0.5;
            for (const enemy of [target, ...neighbors.filter(enemy => enemy !== target && distance(enemy, target) <= 50).slice(0, 3)]) {
                enemy.applyStatus({ type: 'slow', power, duration: 0.9 }, this.hero);
            }
            color = this.beat === 0 ? '#93c5fd' : '#f0f9ff';
            this.beat = 1 - this.beat;
        }
        this.cooldown = PERIOD[this.hero.id];
        this.hero.recordAbility();
        this.hero.game.vfx?.addRing(target.x, target.y, { color, radius: this.hero.id === 'triton' ? 65 : 50, duration: 0.3 });
    }

    getDisplayState() {
        const labels = { namora: 'Emboscada: primera presa', triton: 'Sonar acuatico', jeff_the_land_shark: 'Corriente',
            luna_snow: this.beat === 0 ? 'Siguiente: pulso suave' : 'Siguiente: pulso fuerte' };
        const needsWater = ['namora', 'triton'].includes(this.hero.id) && !this.inWater();
        return { label: `${labels[this.hero.id]} | ${needsWater ? 'requiere agua' : `${this.cooldown.toFixed(1)}s`}`,
            progress: 1 - this.cooldown / PERIOD[this.hero.id], ready: this.cooldown === 0 && !needsWater };
    }

    render(ctx) {
        if (!this.field || !this.active()) return;
        ctx.save();
        ctx.strokeStyle = 'rgba(103,232,249,0.25)'; ctx.lineWidth = 44; ctx.lineCap = 'butt';
        ctx.beginPath(); ctx.moveTo(this.field.start.x, this.field.start.y); ctx.lineTo(this.field.end.x, this.field.end.y); ctx.stroke();
        ctx.restore();
    }
}
