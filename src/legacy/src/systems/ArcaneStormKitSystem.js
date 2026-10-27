import { CombatSystem } from './CombatSystem.js';
import { isPointInRangePattern } from '../utils/RangePattern.js';

const PERIOD = { jubilee: 6, loki: 5, thor: 11, doctor_strange: 9 };
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export class ArcaneStormKitSystem {
    constructor(hero) { this.hero = hero; this.reset(); }

    reset() {
        this.x = this.hero.x; this.y = this.hero.y;
        this.cooldown = PERIOD[this.hero.id];
        this.echo = null; this.network = null; this.portal = null;
    }

    active() {
        return this.hero.game.heroes.includes(this.hero) && !(this.hero.stunTimer > 0)
            && this.x === this.hero.x && this.y === this.hero.y;
    }

    covered(enemy, stats = this.hero.getEffectiveStats()) {
        return enemy?.isAlive && !enemy.hasReachedEnd && (!enemy.stealth || stats.canSeeStealth)
            && isPointInRangePattern(this.hero, enemy, stats.range, this.hero.rangePattern, stats.rangeGeometryScale);
    }

    connected(anchor, candidates) {
        if (!this.covered(anchor)) return [];
        const result = [anchor];
        for (let i = 0; i < result.length && result.length < 5; i++) {
            const neighbors = candidates.filter(enemy => !result.includes(enemy) && this.covered(enemy)
                && distance(enemy, result[i]) <= 80).sort((a, b) => distance(a, result[i]) - distance(b, result[i]));
            for (const enemy of neighbors) {
                if (result.length >= 5) break;
                result.push(enemy);
            }
        }
        return result;
    }

    insidePortal(enemy, portal) { return this.covered(enemy) && distance(enemy, portal) <= 65; }

    applyPortal() {
        const portal = this.portal;
        for (const enemy of this.hero.game.enemies.filter(enemy => this.insidePortal(enemy, portal))
            .sort((a, b) => distance(a, portal) - distance(b, portal))) {
            if (portal.touched.has(enemy)) continue;
            if (portal.touched.size >= 4) break;
            portal.touched.add(enemy);
            enemy.applyFieldSlow(0.45, portal.remaining, this.hero, () => this.active()
                && this.portal === portal && portal.remaining > 0 && this.insidePortal(enemy, portal));
        }
    }

    deal(target, damage, origin, color) {
        CombatSystem.applyDamage({ damage, attackerType: this.hero.category, secondaryEntity: true },
            target, this.hero, this.hero.game.resourceManager, 1);
        this.hero.game.vfx?.addBeam(origin, target, { color, width: 3, duration: 0.2 });
    }

    update(dt) {
        if (!this.active()) { this.reset(); return; }
        this.cooldown = Math.max(0, this.cooldown - dt);
        if (this.portal) {
            this.portal.remaining = Math.max(0, this.portal.remaining - dt);
            if (!this.portal.remaining) this.portal = null;
            else this.applyPortal();
        }
        if (this.echo) {
            const echo = this.echo;
            echo.remaining = Math.max(0, echo.remaining - dt);
            if (!this.covered(echo.target) || (echo.portal && !this.insidePortal(echo.target, echo.portal))) this.echo = null;
            else if (echo.remaining === 0) {
                this.echo = null;
                this.deal(echo.target, echo.damage, echo, echo.portal ? '#f5a623' : '#7ee081');
                if (!echo.portal && echo.target.isAlive) {
                    echo.target.applyStatus({ type: 'slow', power: 0.42, duration: 1.2 }, this.hero);
                }
            }
        }
        if (this.network) {
            const network = this.network;
            network.remaining = Math.max(0, network.remaining - dt);
            network.targets = this.connected(network.anchor, network.targets);
            if (network.targets.length < 3) this.network = null;
            else if (network.remaining === 0) {
                this.network = null;
                for (const enemy of network.targets) {
                    this.deal(enemy, network.damage, this.hero, '#a5eaff');
                    if (enemy.isAlive) enemy.applyStatus({ type: 'stun', power: 1, duration: 0.3 }, this.hero);
                }
            }
        }
    }

    onAttack(target, stats) {
        if (!this.active() || this.cooldown > 0 || !this.covered(target, stats)) return;
        if (this.hero.id === 'jubilee') {
            if (!target.behavior?.interruptAction()) return;
            this.hero.game.vfx?.addBurst(target.x, target.y, { color: '#f472b6', radius: 30, duration: 0.3 });
        } else if (this.hero.id === 'loki') {
            this.echo = { target, remaining: 0.6, damage: stats.damage * 0.55, x: this.hero.x + 24, y: this.hero.y - 18 };
        } else if (this.hero.id === 'thor') {
            const targets = this.connected(target, this.hero.game.enemies);
            if (targets.length < 3) return;
            this.network = { anchor: target, targets, remaining: 1, damage: stats.damage * 1.45 };
        } else if (this.hero.id === 'doctor_strange') {
            this.portal = { x: target.x, y: target.y, remaining: 3, touched: new Set() };
            const secondary = this.hero.game.enemies.filter(enemy => enemy !== target && this.insidePortal(enemy, this.portal))
                .sort((a, b) => distance(a, this.portal) - distance(b, this.portal))[0] || target;
            this.echo = { target: secondary, portal: this.portal, x: target.x, y: target.y, remaining: 0.65, damage: stats.damage * 0.65 };
            this.applyPortal();
        }
        this.cooldown = PERIOD[this.hero.id];
        this.hero.recordAbility();
    }

    getDisplayState() {
        const label = { jubilee: 'Destello: interrumpir apoyo', loki: this.echo ? 'Ilusion preparada' : 'Ilusion',
            thor: this.network ? `Conductividad ${this.network.targets.length}/5` : 'Tormenta: requiere 3 conectados',
            doctor_strange: this.portal ? 'Portal 65px activo' : 'Portal localizado' }[this.hero.id];
        return { label: `${label} | ${this.cooldown.toFixed(1)}s`, progress: 1 - this.cooldown / PERIOD[this.hero.id], ready: this.cooldown === 0 };
    }

    render(ctx) {
        if (!this.active()) return;
        ctx.save(); ctx.lineWidth = 2;
        if (this.hero.id === 'loki' && this.echo) {
            ctx.globalAlpha = 0.45;
            this.hero.animator?.render(ctx, this.echo.x, this.echo.y);
            ctx.globalAlpha = 1;
        }
        if (this.portal) {
            ctx.strokeStyle = '#f5a623';
            ctx.beginPath(); ctx.arc(this.portal.x, this.portal.y, 65, 0, Math.PI * 2); ctx.stroke();
        }
        if (this.network) {
            ctx.strokeStyle = '#a5eaff';
            for (let i = 0; i < this.network.targets.length; i++) {
                for (const other of this.network.targets.slice(i + 1)) {
                    const enemy = this.network.targets[i];
                    if (distance(enemy, other) > 80) continue;
                    ctx.beginPath(); ctx.moveTo(enemy.x, enemy.y); ctx.lineTo(other.x, other.y); ctx.stroke();
                }
            }
        }
        ctx.restore();
    }
}
