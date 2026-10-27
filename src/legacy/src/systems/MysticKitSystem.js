import { CombatSystem } from './CombatSystem.js';
import { isPointInRangePattern } from '../utils/RangePattern.js';

const PERIOD = { scarlet_witch: 7, cloak: 6, dagger: 4, magik: 6 };
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const cursed = enemy => enemy.debuffs?.some(effect => effect.type === 'curse' && effect.duration > 0);

export class MysticKitSystem {
    constructor(hero) { this.hero = hero; this.reset(); }

    reset() {
        this.x = this.hero.x; this.y = this.hero.y;
        this.cooldown = PERIOD[this.hero.id];
        this.network = null; this.window = null; this.returnCut = null; this.marks = new Map();
    }

    active() {
        return !(this.hero.stunTimer > 0) && this.hero.game.heroes.includes(this.hero)
            && this.x === this.hero.x && this.y === this.hero.y;
    }

    covered(enemy, stats = this.hero.getEffectiveStats()) {
        return enemy?.isAlive && !enemy.hasReachedEnd && (!enemy.stealth || stats.canSeeStealth)
            && isPointInRangePattern(this.hero, enemy, stats.range, this.hero.rangePattern, stats.rangeGeometryScale);
    }

    cutPrepared(target) {
        return this.hero.id === 'magik' && this.active() && this.cooldown === 0
            && this.covered(target) && cursed(target);
    }

    damageMultiplier(target) { return this.cutPrepared(target) ? 1.5 : 1; }

    attackEffects(target) {
        return this.cutPrepared(target) ? [{ type: 'armorBreak', power: 0.2, duration: 3.5, chance: 1 }] : [];
    }

    deal(target, damage, color, armorPenetration = 0) {
        CombatSystem.applyDamage({ damage, attackerType: this.hero.category, armorPenetration, secondaryEntity: true },
            target, this.hero, this.hero.game.resourceManager, 1);
        this.hero.game.vfx?.addBeam(this.hero, target, { color, width: 3, duration: 0.2 });
    }

    update(dt) {
        if (!this.active()) { this.reset(); return; }
        this.cooldown = Math.max(0, this.cooldown - dt);
        for (const [enemy, mark] of this.marks) {
            mark.remaining = Math.max(0, mark.remaining - dt);
            if (!this.hasMark(enemy)) this.marks.delete(enemy);
        }
        if (this.network) {
            const network = this.network;
            network.remaining = Math.max(0, network.remaining - dt);
            const anchor = network.targets[0];
            if (!this.covered(anchor) || !cursed(anchor)) this.network = null;
            else {
                network.targets = network.targets.filter(enemy => this.covered(enemy) && cursed(enemy) && distance(enemy, anchor) <= 90);
                if (network.targets.length < 2) this.network = null;
                else if (network.remaining === 0) {
                    this.network = null;
                    for (const enemy of network.targets) this.deal(enemy, network.damage, '#ff3b73');
                }
            }
        }
        if (this.window) {
            this.window.remaining = Math.max(0, this.window.remaining - dt);
            if (!this.window.remaining) this.window = null;
            else this.applyWindow();
        }
        if (this.returnCut) {
            const cut = this.returnCut;
            cut.remaining = Math.max(0, cut.remaining - dt);
            if (!this.covered(cut.target) || !cursed(cut.target)) this.returnCut = null;
            else if (cut.remaining === 0) {
                this.returnCut = null;
                this.deal(cut.target, cut.damage, '#ff9cff', 0.55);
            }
        }
    }

    insideWindow(enemy, window) {
        return enemy.isAlive && !enemy.hasReachedEnd && distance(enemy, window) <= 65;
    }

    applyWindow() {
        const window = this.window;
        const candidates = this.hero.game.enemies.filter(enemy => this.insideWindow(enemy, window))
            .sort((a, b) => distance(a, window) - distance(b, window));
        for (const enemy of candidates) {
            if (window.touched.size >= 6) break;
            if (window.touched.has(enemy)) continue;
            window.touched.add(enemy);
            const valid = () => this.active() && this.window === window && window.remaining > 0 && this.insideWindow(enemy, window);
            enemy.applyFieldStatus('reveal', 1, window.remaining, this.hero, valid);
            enemy.applyFieldSlow(0.42, window.remaining, this.hero, valid);
        }
    }

    hasMark(enemy) {
        const mark = this.marks.get(enemy);
        return Boolean(mark && mark.remaining > 0 && mark.effect.duration > 0
            && enemy.debuffs.includes(mark.effect) && this.covered(enemy));
    }

    mark(target) {
        if (this.hasMark(target)) return;
        const mark = { remaining: 3, effect: null };
        this.marks.set(target, mark);
        target.applyFieldMark(0.12, 3, this.hero, () => this.active() && this.marks.get(target) === mark
            && mark.remaining > 0 && this.covered(target));
        mark.effect = target.debuffs.at(-1);
    }

    onAttack(target, stats) {
        if (!this.active() || !this.covered(target, stats)) return;
        if (this.hero.id === 'dagger') {
            if (this.cooldown > 0 || !this.hasMark(target)) { this.mark(target); return; }
            const victims = [target];
            while (victims.length < 3) {
                const next = [...this.marks.keys()].filter(enemy => this.hasMark(enemy) && !victims.includes(enemy)
                    && distance(enemy, victims.at(-1)) <= 95)
                    .sort((a, b) => distance(a, victims.at(-1)) - distance(b, victims.at(-1)))[0];
                if (!next) break;
                victims.push(next);
            }
            for (const enemy of victims) {
                const mark = this.marks.get(enemy);
                this.marks.delete(enemy);
                enemy.debuffs = enemy.debuffs.filter(effect => effect !== mark.effect);
                this.deal(enemy, stats.damage * 0.65, '#fff2a8');
            }
        } else {
            if (this.cooldown > 0) return;
            if (this.hero.id === 'scarlet_witch') {
                if (!cursed(target)) return;
                const targets = [target, ...this.hero.game.enemies.filter(enemy => enemy !== target && this.covered(enemy, stats)
                    && cursed(enemy) && distance(enemy, target) <= 90)
                    .sort((a, b) => distance(a, target) - distance(b, target)).slice(0, 3)];
                if (targets.length < 2) return;
                this.network = { targets, remaining: 2, damage: stats.damage * 0.7 };
            } else if (this.hero.id === 'cloak') {
                this.window = { x: target.x, y: target.y, remaining: 3, touched: new Set() };
                this.applyWindow();
            } else if (this.hero.id === 'magik') {
                if (!this.cutPrepared(target)) return;
                this.returnCut = { target, remaining: 0.4, damage: stats.damage * 0.6 };
            }
        }
        this.cooldown = PERIOD[this.hero.id];
        this.hero.recordAbility();
    }

    getDisplayState() {
        const label = { scarlet_witch: this.network ? `Red ${this.network.targets.length}/4: ${this.network.remaining.toFixed(1)}s` : 'Red de maldiciones',
            cloak: this.window ? 'Manto activo' : 'Manto oscuro', dagger: `Marcas propias ${this.marks.size}`, magik: this.returnCut ? 'Retorno dimensional' : 'Corte: requiere maldicion' }[this.hero.id];
        return { label: `${label} | ${this.cooldown.toFixed(1)}s`, progress: 1 - this.cooldown / PERIOD[this.hero.id], ready: this.cooldown === 0 };
    }

    render(ctx) {
        if (!this.active()) return;
        ctx.save(); ctx.lineWidth = 2;
        if (this.window) {
            ctx.strokeStyle = '#8975e8'; ctx.beginPath(); ctx.arc(this.window.x, this.window.y, 65, 0, Math.PI * 2); ctx.stroke();
        }
        if (this.network) {
            ctx.strokeStyle = '#ff3b73';
            const anchor = this.network.targets[0];
            for (const enemy of this.network.targets.slice(1)) {
                ctx.beginPath(); ctx.moveTo(anchor.x, anchor.y); ctx.lineTo(enemy.x, enemy.y); ctx.stroke();
            }
        }
        ctx.restore();
    }
}
