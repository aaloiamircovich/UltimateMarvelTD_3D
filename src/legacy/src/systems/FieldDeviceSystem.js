import { CombatSystem } from './CombatSystem.js';
import { isPointInRangePattern } from '../utils/RangePattern.js';

export class FieldDeviceSystem {
    constructor(hero) {
        this.hero = hero;
        this.interval = hero.id === 'rocket_raccoon' ? 6 : 8;
        this.clear();
    }

    clear() {
        this.device = null;
        this.cooldown = this.interval;
        this.x = this.hero.x;
        this.y = this.hero.y;
    }

    valid(enemy, stats) {
        return enemy.isAlive && !enemy.hasReachedEnd && (!enemy.stealth || stats.canSeeStealth)
            && isPointInRangePattern(this.hero, enemy, stats.range, this.hero.rangePattern, stats.rangeGeometryScale);
    }

    update(dt, enemies) {
        if (!this.hero.game.heroes?.includes(this.hero) || this.hero.stunTimer > 0
            || this.x !== this.hero.x || this.y !== this.hero.y) { this.clear(); return; }
        const stats = this.hero.getEffectiveStats();
        if (!this.device) {
            this.cooldown = Math.max(0, this.cooldown - dt);
            if (this.cooldown > 0) return;
            const target = this.hero.getBestTarget(enemies.filter(enemy => this.valid(enemy, stats)), stats);
            if (!target) return;
            this.device = { x: target.x, y: target.y, life: 5, arm: 1, fire: 0.5, budget: 0 };
            this.hero.recordAbility();
            return;
        }
        const device = this.device;
        device.life -= dt;
        if (device.life <= 0) { this.clear(); return; }
        if (this.hero.id === 'rocket_raccoon') {
            device.fire -= dt;
            if (device.fire > 0 || device.budget <= 0) return;
            const target = this.hero.getBestTarget(enemies.filter(enemy => this.valid(enemy, stats)), stats);
            if (!target) return;
            const damage = device.budget;
            device.budget = 0;
            device.fire = 0.5;
            CombatSystem.applyDamage({ damage, attackerType: this.hero.category, armorPenetration: 0.14,
                secondaryEntity: true }, target, this.hero, this.hero.game.resourceManager, 1);
            this.hero.game.vfx?.addBeam({ x: this.hero.x + 14, y: this.hero.y + 12 }, target,
                { color: '#f97316', width: 2, duration: 0.12 });
            return;
        }
        device.arm -= dt;
        if (device.arm > 0) return;
        const targets = enemies.filter(enemy => this.valid(enemy, stats))
            .filter(enemy => Math.hypot(enemy.x - device.x, enemy.y - device.y) <= 65)
            .sort((a, b) => Math.hypot(a.x - device.x, a.y - device.y) - Math.hypot(b.x - device.x, b.y - device.y));
        if (!targets.some(enemy => Math.hypot(enemy.x - device.x, enemy.y - device.y) <= 26)) return;
        for (const target of targets.slice(0, 5)) target.applyStatus({ type: 'web', duration: 2, power: 0.35 }, this.hero);
        this.hero.game.vfx?.addBurst(device.x, device.y, { radius: 65, color: '#40c9ff' });
        this.clear();
    }

    damageMultiplier() {
        return this.hero.id === 'rocket_raccoon' && this.device ? 0.8 : 1;
    }

    onAttack(projectile) {
        if (this.hero.id !== 'rocket_raccoon' || !this.device) return;
        // Primary damage already paid the 20% reserve; secondary fire cannot refill it.
        const available = Math.max(0, this.hero.getEffectiveStats().damage * 2 - this.device.budget);
        this.device.budget += Math.min(projectile.damage * 0.25, available);
    }

    getDisplayState() {
        return { label: this.device ? (this.hero.id === 'rocket_raccoon' ? 'Torreta activa' : this.device.arm > 0 ? 'Armando mina' : 'Mina preparada')
            : `Dispositivo ${this.cooldown.toFixed(1)} s`, progress: this.device ? this.device.life / 5 : 1 - this.cooldown / this.interval,
            ready: Boolean(this.device) };
    }

    render(ctx) {
        if (!this.device) return;
        ctx.save();
        ctx.strokeStyle = this.hero.id === 'rocket_raccoon' ? '#f97316' : '#40c9ff';
        ctx.lineWidth = 2;
        if (this.hero.id === 'rocket_raccoon') {
            ctx.strokeRect(this.hero.x + 8, this.hero.y + 8, 12, 8);
            ctx.beginPath(); ctx.moveTo(this.hero.x + 14, this.hero.y + 8); ctx.lineTo(this.hero.x + 20, this.hero.y + 3); ctx.stroke();
        } else {
            ctx.beginPath(); ctx.arc(this.device.x, this.device.y, 9, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(this.device.x - 6, this.device.y); ctx.lineTo(this.device.x + 6, this.device.y);
            ctx.moveTo(this.device.x, this.device.y - 6); ctx.lineTo(this.device.x, this.device.y + 6); ctx.stroke();
        }
        ctx.restore();
    }
}
