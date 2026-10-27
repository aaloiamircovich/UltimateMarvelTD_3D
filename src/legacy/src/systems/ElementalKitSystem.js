import { CombatSystem } from './CombatSystem.js';
import { isPointInRangePattern } from '../utils/RangePattern.js';
import { TERRAIN } from '../utils/TerrainRules.js';

const PERIOD = { iceman: 1, crystal: 2, namor: 6 };
const ELEMENTS = ['Fuego', 'Hielo', 'Rayos'];
const COLORS = ['#f97316', '#a7f3ff', '#fff19c'];
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export class ElementalKitSystem {
    constructor(hero) { this.hero = hero; this.reset(); }

    reset() {
        this.x = this.hero.x; this.y = this.hero.y;
        this.cooldown = PERIOD[this.hero.id];
        this.element = 0; this.charge = 0; this.idle = 0; this.lastTarget = null;
    }

    active() {
        return !(this.hero.stunTimer > 0) && this.hero.game.heroes.includes(this.hero)
            && this.x === this.hero.x && this.y === this.hero.y;
    }

    inWater() {
        const { gridSize, terrainMap } = this.hero.game;
        return gridSize > 0 && terrainMap?.[Math.floor(this.hero.y / gridSize)]?.[Math.floor(this.hero.x / gridSize)] === TERRAIN.water;
    }

    covered(enemy, stats) {
        return enemy?.isAlive && !enemy.hasReachedEnd && (!enemy.stealth || stats.canSeeStealth)
            && isPointInRangePattern(this.hero, enemy, stats.range, this.hero.rangePattern, stats.rangeGeometryScale);
    }

    update(dt) {
        if (!this.active()) { this.reset(); return; }
        this.cooldown = Math.max(0, this.cooldown - dt);
        this.idle += dt;
        if (this.hero.id === 'namor' && (!this.inWater() || this.idle >= 3)) this.charge = 0;
    }

    damageMultiplier() {
        return this.hero.id === 'namor' && this.active() && this.inWater() ? 1.2 : 1;
    }

    onAttack(target, stats) {
        if (!this.active() || !this.covered(target, stats)) return;
        this.idle = 0; this.lastTarget = target;
        if (this.hero.id === 'namor') {
            if (!this.inWater()) { this.charge = 0; return; }
            if (this.charge < 3 || this.cooldown > 0) { this.charge = Math.min(3, this.charge + 1); return; }
        } else if (this.cooldown > 0) return;
        const nearby = (radius, count) => [target, ...(this.hero.game.enemies || [])
            .filter(enemy => enemy !== target && this.covered(enemy, stats) && distance(enemy, target) <= radius)
            .sort((a, b) => distance(a, target) - distance(b, target)).slice(0, count - 1)];
        let color = '#40c9ff';
        if (this.hero.id === 'iceman') {
            for (const enemy of nearby(44, 4)) enemy.applyFrost(this.hero);
            color = '#a7f3ff';
        } else if (this.hero.id === 'crystal') {
            color = COLORS[this.element];
            if (this.element === 0) target.applyStatus({ type: 'burn', damageBasis: 'attackDamage', power: 0.15, duration: 2 }, this.hero);
            if (this.element === 1) target.applyStatus({ type: 'slow', power: 0.35, duration: 1.5 }, this.hero);
            if (this.element === 2) {
                for (const enemy of nearby(75, 3).slice(1)) this.damage(enemy, stats.damage * 0.5);
            }
            this.element = (this.element + 1) % ELEMENTS.length;
        } else {
            for (const enemy of nearby(55, 4).slice(1)) this.damage(enemy, stats.damage * 0.6);
            this.charge = 0;
        }
        this.cooldown = PERIOD[this.hero.id];
        this.hero.recordAbility();
        this.hero.game.vfx?.addRing(target.x, target.y, { color, radius: this.hero.id === 'iceman' ? 44 : 55, duration: 0.3 });
    }

    damage(enemy, damage) {
        CombatSystem.applyDamage({ attackerType: this.hero.category, damage }, enemy, this.hero, this.hero.game.resourceManager, 1);
    }

    getDisplayState() {
        let label;
        if (this.hero.id === 'iceman') label = `Escarcha ${this.lastTarget?.frost?.stacks || 0}/3`;
        if (this.hero.id === 'crystal') label = `Siguiente: ${ELEMENTS[this.element]}`;
        if (this.hero.id === 'namor') label = this.inWater() ? `Marea ${this.charge}/3 | Dano +20%` : 'Tierra: tridente';
        return { label: `${label} | ${this.cooldown.toFixed(1)}s`, progress: 1 - this.cooldown / PERIOD[this.hero.id], ready: this.cooldown === 0 };
    }
}
