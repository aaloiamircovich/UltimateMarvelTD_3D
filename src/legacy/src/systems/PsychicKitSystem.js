import { CombatSystem } from './CombatSystem.js';
import { isPointInRangePattern } from '../utils/RangePattern.js';

const PERIOD = { mantis: 6, emma_frost: 3, nightcrawler: 6, cosmo: 5 };
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export class PsychicKitSystem {
    constructor(hero) { this.hero = hero; this.mode = 'psychic'; this.reset(); }

    reset() {
        this.x = this.hero.x; this.y = this.hero.y;
        this.cooldown = PERIOD[this.hero.id];
        this.links = []; this.remaining = 0; this.blinks = []; this.blinkTime = 0;
    }

    active() {
        return !(this.hero.stunTimer > 0) && this.hero.game.heroes.includes(this.hero)
            && this.x === this.hero.x && this.y === this.hero.y;
    }

    covered(enemy, stats = this.hero.getEffectiveStats()) {
        return enemy?.isAlive && !enemy.hasReachedEnd && (!enemy.stealth || stats.canSeeStealth)
            && isPointInRangePattern(this.hero, enemy, stats.range, this.hero.rangePattern, stats.rangeGeometryScale);
    }

    update(dt) {
        if (!this.active()) { this.reset(); return; }
        this.cooldown = Math.max(0, this.cooldown - dt);
        this.remaining = Math.max(0, this.remaining - dt);
        this.blinkTime = Math.max(0, this.blinkTime - dt);
        if (!this.remaining || !this.covered(this.links[0])) this.links = [];
        else this.links = this.links.filter(enemy => this.covered(enemy) && distance(enemy, this.links[0]) <= 90);
        if (!this.blinkTime) this.blinks = [];
    }

    canAttack() { return this.blinkTime === 0; }

    attackEffects(target) {
        if (!this.active() || this.cooldown > 0 || !this.covered(target)) return [];
        if (this.hero.id === 'mantis') return [{ type: 'sleep', power: 1, duration: 2, chance: 1 }];
        if (this.hero.id === 'emma_frost' && this.mode === 'psychic') return [
            { type: 'mark', power: 0.17, duration: 2.8, chance: 1 }, { type: 'slow', power: 0.28, duration: 1.6, chance: 1 }
        ];
        return [];
    }

    onAttack(target, stats) {
        if (!this.active() || this.cooldown > 0 || !this.covered(target, stats)) return;
        if (this.hero.id === 'emma_frost' && this.mode !== 'psychic') return;
        const candidates = (this.hero.game.enemies || []).filter(enemy => this.covered(enemy, stats));
        if (this.hero.id === 'nightcrawler') {
            const victims = [target];
            while (victims.length < 3) {
                const next = candidates.filter(enemy => !victims.includes(enemy) && distance(enemy, victims.at(-1)) <= 90)
                    .sort((a, b) => distance(a, victims.at(-1)) - distance(b, victims.at(-1)))[0];
                if (!next) break;
                victims.push(next);
            }
            this.blinks = victims.map(enemy => ({ x: enemy.x, y: enemy.y - 24 }));
            this.blinkTime = this.blinks.length * 0.18;
            for (const enemy of victims) {
                CombatSystem.applyDamage({ attackerType: this.hero.category, damage: stats.damage * 0.45 }, enemy, this.hero, this.hero.game.resourceManager, 1);
                this.hero.game.vfx?.addBurst(enemy.x, enemy.y, { color: '#7c5cff', radius: 24, duration: 0.3 });
            }
        }
        if (this.hero.id === 'cosmo') {
            this.links = [target, ...candidates.filter(enemy => enemy !== target && distance(enemy, target) <= 90)
                .sort((a, b) => distance(a, target) - distance(b, target)).slice(0, 3)];
            this.remaining = 2.5;
            const anchor = target;
            for (const enemy of this.links) {
                enemy.applyFieldMark(0.14, 2.5, this.hero, () => this.active() && this.remaining > 0 && this.links.includes(enemy)
                    && this.covered(anchor) && this.covered(enemy) && distance(enemy, anchor) <= 90);
            }
        }
        this.cooldown = PERIOD[this.hero.id];
        this.hero.recordAbility();
    }

    visualOffset() {
        if (!this.active() || !this.blinks.length || this.hero.game.reduceMotion
            || this.hero.game.progression?.state?.settings?.reduceMotion) return { x: 0, y: 0 };
        const index = Math.min(this.blinks.length - 1, Math.floor((this.blinks.length * 0.18 - this.blinkTime) / 0.18));
        return { x: this.blinks[index].x - this.hero.x, y: this.blinks[index].y - this.hero.y };
    }

    getControlState() {
        return this.hero.id === 'emma_frost' ? { label: 'Forma', value: this.mode, options: [
            { id: 'psychic', label: 'Psiquica' }, { id: 'diamond', label: 'Diamante' }
        ] } : null;
    }

    setMode(mode) {
        if (this.hero.id !== 'emma_frost' || !['psychic', 'diamond'].includes(mode)) return false;
        this.mode = mode; return true;
    }

    getDisplayState() {
        const label = { mantis: 'Sueno', emma_frost: this.mode === 'diamond' ? 'Diamante: resistencia60%' : 'Concentracion psiquica',
            nightcrawler: this.blinkTime ? 'BAMF' : 'Salto preparado', cosmo: `Red ${this.links.length}/4` }[this.hero.id];
        return { label: `${label} | ${this.cooldown.toFixed(1)}s`, progress: 1 - this.cooldown / PERIOD[this.hero.id], ready: this.cooldown === 0 };
    }

    render(ctx) {
        if (!this.active() || !this.links.length) return;
        ctx.save(); ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 2;
        for (const enemy of this.links) {
            ctx.beginPath(); ctx.moveTo(this.hero.x, this.hero.y); ctx.lineTo(enemy.x, enemy.y); ctx.stroke();
        }
        ctx.restore();
    }
}
