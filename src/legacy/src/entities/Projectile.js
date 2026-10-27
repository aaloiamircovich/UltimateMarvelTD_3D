import { CombatSystem } from '../systems/CombatSystem.js';

export class Projectile {
    constructor(x, y, target, config = {}) {
        this.reset(x, y, target, config);
    }

    reset(x, y, target, config = {}) {
        this.x = x;
        this.y = y;
        this.target = target;
        this.attacker = config.attacker || null;
        this.impactItems = this.attacker?.items ? this.attacker.items.slice(0, 1).map(item => ({
            effects: { ...item.effects }, flags: [...(item.flags || [])]
        })) : null;
        this.damage = config.damage || 10;
        this.attackerType = config.attackerType || 'Urbano';
        this.speed = config.projectileSpeed || 420;
        const effects = config.effects || [];
        const statusDamage = effects.some(effect => effect.damageBasis === 'attackDamage')
            ? this.attacker?.getEffectiveStats?.()?.damage ?? this.attacker?.damage : undefined;
        this.effects = effects.map(effect => effect.damageBasis === 'attackDamage'
            && effect.attackDamageSnapshot === undefined && Number.isFinite(statusDamage)
            ? { ...effect, attackDamageSnapshot: statusDamage } : { ...effect });
        this.color = config.color || '#ffd166';
        this.radius = config.radius || 5;
        this.splashRadius = config.splashRadius || 0;
        this.beaconRadius = config.beaconRadius || 0;
        this.interceptBounce = Boolean(config.interceptBounce);
        this.secondaryEntity = Boolean(config.secondaryEntity);
        this.energyToken = config.energyToken || null;
        this.splashFactor = config.splashFactor ?? 0.5;
        this.chainCount = config.chainCount || 0;
        this.chainRange = config.chainRange || 100;
        this.chainFactor = config.chainFactor ?? 0.65;
        this.propagationCount = config.propagationCount || 0;
        this.propagationRadius = config.propagationRadius || 90;
        this.propagationFactor = config.propagationFactor ?? 0.35;
        this.armorPenetration = config.armorPenetration || 0;
        this.returning = Boolean(config.returning);
        this.visualStyle = config.visualStyle || 'energy';
        this.phase = 'outbound';
        this.isActive = true;
        return this;
    }

    deactivate() {
        this.isActive = false;
        this.target = null;
        this.attacker = null;
        this.impactItems = null;
        this.effects = [];
        this.energyToken = null;
    }

    update(dt) {
        if (!this.isActive || !this.target) {
            this.isActive = false;
            return;
        }

        if (this.phase === 'outbound' && (!this.target.isAlive || this.target.hasReachedEnd)) {
            this.isActive = false;
            return;
        }

        const destination = this.phase === 'returning' ? this.attacker : this.target;
        if (!destination) {
            this.isActive = false;
            return;
        }

        const dx = destination.x - this.x;
        const dy = destination.y - this.y;
        const distance = Math.hypot(dx, dy);

        if (distance < 15 || distance === 0) {
            if (this.phase === 'returning') {
                this.isActive = false;
                return;
            }

            CombatSystem.applyImpact(this, this.target, this.attacker, this.attacker?.game?.resourceManager);
            if (this.returning && this.attacker) {
                this.phase = 'returning';
            } else {
                this.isActive = false;
            }
            return;
        }

        this.x += (dx / distance) * this.speed * dt;
        this.y += (dy / distance) * this.speed * dt;
    }

    render(ctx) {
        if (!this.isActive) return;

        ctx.save();
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 10;
        if (this.visualStyle === 'shield') {
            ctx.fillStyle = '#1d5fa7';
            ctx.strokeStyle = '#f4f7ff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#e63946';
            ctx.beginPath();
            ctx.arc(this.x, this.y, Math.max(2, this.radius - 1), 0, Math.PI * 2);
            ctx.fill();
        } else if (this.visualStyle === 'lightning') {
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(this.x - 7, this.y - 6);
            ctx.lineTo(this.x + 1, this.y - 1);
            ctx.lineTo(this.x - 2, this.y + 7);
            ctx.lineTo(this.x + 8, this.y + 1);
            ctx.stroke();
        } else if (this.visualStyle === 'mystic') {
            ctx.strokeStyle = '#f5a623';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 3, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.visualStyle === 'arrow') {
            const targetAngle = this.target ? Math.atan2(this.target.y - this.y, this.target.x - this.x) : 0;
            ctx.translate(this.x, this.y);
            ctx.rotate(targetAngle);
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(-8, 0);
            ctx.lineTo(8, 0);
            ctx.lineTo(3, -4);
            ctx.moveTo(8, 0);
            ctx.lineTo(3, 4);
            ctx.stroke();
        } else if (this.visualStyle === 'density') {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y - this.radius - 2);
            ctx.lineTo(this.x + this.radius + 2, this.y);
            ctx.lineTo(this.x, this.y + this.radius + 2);
            ctx.lineTo(this.x - this.radius - 2, this.y);
            ctx.closePath();
            ctx.fill();
        } else if (this.visualStyle === 'blaster') {
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(this.x - 7, this.y);
            ctx.lineTo(this.x + 7, this.y);
            ctx.stroke();
        } else if (this.visualStyle === 'cosmic') {
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 4, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.visualStyle === 'crescent') {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 3, -Math.PI * 0.7, Math.PI * 0.7);
            ctx.arc(this.x + 4, this.y, this.radius + 1, Math.PI * 0.7, -Math.PI * 0.7, true);
            ctx.fill();
        } else if (this.visualStyle === 'hellfire') {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y - this.radius - 7);
            ctx.quadraticCurveTo(this.x + this.radius + 6, this.y, this.x, this.y + this.radius + 4);
            ctx.quadraticCurveTo(this.x - this.radius - 6, this.y, this.x, this.y - this.radius - 7);
            ctx.fill();
        } else if (this.visualStyle === 'ring') {
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.ellipse(this.x, this.y, this.radius + 4, this.radius, 0.45, 0, Math.PI * 2);
            ctx.stroke();
        } else if (this.visualStyle === 'blade') {
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(this.x - 8, this.y + 6);
            ctx.lineTo(this.x + 8, this.y - 6);
            ctx.stroke();
        } else if (this.visualStyle === 'optic') {
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(this.x - 10, this.y);
            ctx.lineTo(this.x + 10, this.y);
            ctx.stroke();
        } else if (this.visualStyle === 'pym') {
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 3, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = '#ef3340';
            ctx.fillRect(this.x - 2, this.y - 2, 4, 4);
        } else {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}
