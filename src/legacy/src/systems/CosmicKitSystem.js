import { Projectile } from '../entities/Projectile.js';
import { CombatSystem } from './CombatSystem.js';
import { getLineEndpoint, getLineTargets } from '../utils/LineTargeting.js';
import { applyCooldownReductions } from '../utils/AbilityModifiers.js';

const COSMIC_CONTROLS = {
    star_lord: {
        label: 'Munición elemental',
        defaultMode: 'plasma',
        options: [
            { id: 'plasma', label: 'Plasma' },
            { id: 'cryo', label: 'Criogénica' },
            { id: 'incendiary', label: 'Incendiaria' }
        ]
    },
    silver_surfer: {
        label: 'Poder Cósmico',
        defaultMode: 'power',
        options: [
            { id: 'power', label: 'Poder' },
            { id: 'control', label: 'Control' },
            { id: 'support', label: 'Resonancia' }
        ]
    }
};

export class CosmicKitSystem {
    constructor(hero) {
        this.hero = hero;
        this.mode = COSMIC_CONTROLS[hero.id]?.defaultMode || null;
        this.attackCount = 0;
        this.resource = 0;
        this.cooldownRemaining = hero.id === 'groot' ? 10 : 0;
        this.flightTimer = 0;
        this.flightOrigin = null;
        this.rootWall = null;
        this.guardianHealTimer = 18;
        this.executionCount = 0;
        this.energyOrigin = { x: hero.x, y: hero.y };
        this.binaryRun = null;
        this.blasterCooldown = 1;
        this.trajectoryOrigin = { x: hero.x, y: hero.y };
        this.trajectoryCharge = 0;
        if (hero.id === 'captain_marvel') this.cooldownRemaining = 9;
    }

    update(dt, enemies, stats) {
        this.checkTrajectoryPosition();
        this.checkEnergyPosition();
        this.cooldownRemaining = Math.max(0, this.cooldownRemaining - dt);
        this.blasterCooldown = Math.max(0, this.blasterCooldown - dt);
        if (this.hero.id === 'captain_marvel') this.updateCaptainMarvel(dt, enemies, stats);
        if (this.hero.id === 'groot') this.updateGroot(dt, enemies, stats);
    }

    onAttack(target, stats, projectileConfig, projectiles) {
        this.attackCount++;
        if (this.hero.id === 'captain_marvel' && this.canAttack()) this.resource = Math.min(100, this.resource + 12);
        if (this.hero.id === 'star_lord') this.fireSecondBlaster(target, projectileConfig, projectiles, stats);
        if (this.hero.id === 'gamora') this.activateGamoraCombo(target, stats);
        if (this.hero.id === 'silver_surfer') {
            this.checkTrajectoryPosition();
            if (++this.trajectoryCharge >= 2) { this.trajectoryCharge = 0; this.fireCosmicTrajectory(target, stats); }
        }
    }

    onKill() {
        if (this.hero.id === 'captain_marvel' && this.canAttack()) this.resource = Math.min(100, this.resource + 24);
    }

    applyStatModifiers(stats) {
        if (this.hero.id === 'captain_marvel') {
            stats.damage *= 1 + this.resource * 0.0035;
        }
        if (this.hero.id === 'silver_surfer') {
            if (this.mode === 'power') stats.damage *= 1.22;
            if (this.mode === 'control') stats.range *= 1.16;
            if (this.mode === 'support') {
                stats.fireRate *= 1.12;
                stats.damage *= 0.92;
            }
        }
        return stats;
    }

    getAttackEffects() {
        if (this.hero.id === 'star_lord' && this.mode === 'cryo') return [{ type: 'slow', duration: 2, power: 0.42, chance: 1 }];
        if (this.hero.id === 'star_lord' && this.mode === 'incendiary') return [{ type: 'burn', duration: 3, power: 0.23, damageBasis: 'attackDamage', chance: 1 }];
        if (this.hero.id === 'silver_surfer' && this.mode === 'control') return [{ type: 'slow', duration: 1.8, power: 0.36, chance: 1 }];
        if (this.hero.id === 'silver_surfer' && this.mode === 'support') return [{ type: 'mark', duration: 2.8, power: 0.12, chance: 1 }];
        return [];
    }

    getProjectileProfile() {
        if (this.hero.id === 'star_lord' && this.mode === 'plasma') return { armorPenetration: 0.28 };
        if (this.hero.id === 'silver_surfer') {
            if (this.mode === 'power') return { splashRadius: 82, splashFactor: 0.62, armorPenetration: 0.3 };
            if (this.mode === 'control') return { chainCount: 2, chainRange: 120, chainFactor: 0.62 };
            return { splashRadius: 54, splashFactor: 0.45 };
        }
        return {};
    }

    getProjectileColor() {
        if (this.hero.id === 'captain_marvel') return '#ffd45f';
        if (this.hero.id === 'star_lord') return { plasma: '#7ce7ff', cryo: '#8ff4ff', incendiary: '#ff7b45' }[this.mode];
        if (this.hero.id === 'groot') return '#85d46a';
        if (this.hero.id === 'gamora') return '#7dff8a';
        if (this.hero.id === 'silver_surfer') return { power: '#fff3b0', control: '#8de8ff', support: '#ff8bd1' }[this.mode];
        return null;
    }

    getProjectileVisualStyle() {
        if (this.hero.id === 'star_lord') return 'blaster';
        if (this.hero.id === 'silver_surfer') return 'cosmic';
        return null;
    }

    getDisplayState() {
        if (this.hero.id === 'captain_marvel') return {
            label: this.binaryRun ? 'Pasada binaria: trayectoria fijada'
                : `Binaria ${Math.round(this.resource)}/60 | ${this.cooldownRemaining.toFixed(1)}s`,
            progress: Math.min(1, this.resource / 60), ready: this.resource >= 60 && this.cooldownRemaining === 0 && !this.binaryRun
        };
        if (this.hero.id === 'star_lord') return staticState(`Blasters: ${this.getModeLabel()} | secundario ${this.blasterCooldown.toFixed(1)}s`);
        if (this.hero.id === 'groot') {
            const ready = this.cooldownRemaining <= 0;
            return { label: ready ? 'Muro de raíces listo' : `Raíces ${this.cooldownRemaining.toFixed(1)} s`, progress: ready ? 1 : 1 - this.cooldownRemaining / 10, ready };
        }
        if (this.hero.id === 'gamora') return staticState(`Remates ${this.executionCount} | umbral 25% | combo x2`);
        if (this.hero.id === 'silver_surfer') return staticState(`Poder Cósmico: ${this.getModeLabel()}`);
        return null;
    }

    getControlState() {
        const config = COSMIC_CONTROLS[this.hero.id];
        return config ? { ...config, value: this.mode } : null;
    }

    setMode(mode) {
        const config = COSMIC_CONTROLS[this.hero.id];
        if (!config?.options.some((option) => option.id === mode)) return false;
        if (this.hero.id === 'silver_surfer' && this.mode !== mode) this.trajectoryCharge = 0;
        this.mode = mode;
        return true;
    }

    getMode() {
        return this.mode;
    }

    render(ctx) {
        if (this.binaryRun?.windup > 0) {
            ctx.save(); ctx.strokeStyle = '#ffd45f'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(this.hero.x, this.hero.y);
            ctx.lineTo(this.binaryRun.endpoint.x, this.binaryRun.endpoint.y); ctx.stroke(); ctx.restore();
        }
        if (this.rootWall) {
            ctx.save();
            ctx.strokeStyle = '#78c85a';
            ctx.lineWidth = 7;
            ctx.globalAlpha = Math.min(1, this.rootWall.duration);
            ctx.beginPath();
            ctx.moveTo(this.rootWall.x - 24, this.rootWall.y - 18);
            ctx.quadraticCurveTo(this.rootWall.x, this.rootWall.y + 20, this.rootWall.x + 24, this.rootWall.y - 18);
            ctx.stroke();
            ctx.restore();
        }
        if (this.hero.id === 'captain_marvel' && this.flightTimer > 0) {
            ctx.save();
            ctx.fillStyle = 'rgba(255, 212, 95, 0.28)';
            ctx.beginPath();
            ctx.arc(this.hero.x, this.hero.y + 18, 22 + this.flightTimer * 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    checkEnergyPosition() {
        if (!['captain_marvel', 'star_lord'].includes(this.hero.id)) return;
        if (!(this.hero.stunTimer > 0) && this.hero.game.heroes.includes(this.hero)
            && this.hero.x === this.energyOrigin.x && this.hero.y === this.energyOrigin.y) return;
        this.energyOrigin = { x: this.hero.x, y: this.hero.y };
        this.resource = 0; this.binaryRun = null; this.flightTimer = 0; this.flightOrigin = null;
        this.blasterCooldown = 1;
        if (this.hero.id === 'captain_marvel') this.cooldownRemaining = 9;
    }

    canAttack() { return this.hero.id !== 'captain_marvel' || !this.binaryRun; }

    visualOffset() {
        if (!this.binaryRun || this.binaryRun.windup > 0 || this.hero.game.reduceMotion
            || this.hero.game.progression?.state?.settings?.reduceMotion) return { x: 0, y: 0 };
        const progress = 1 - this.flightTimer / 0.9;
        const factor = 1 - Math.abs(progress * 2 - 1);
        return { x: (this.binaryRun.destination.x - this.hero.x) * factor,
            y: (this.binaryRun.destination.y - this.hero.y) * factor };
    }

    updateCaptainMarvel(dt, enemies, stats) {
        if (this.hero.stunTimer > 0 || !this.hero.game.heroes.includes(this.hero)) return;
        if (this.binaryRun) {
            const run = this.binaryRun;
            if (run.windup > 0) {
                run.windup = Math.max(0, run.windup - dt);
                if (run.windup > 0) return;
                const victims = getLineTargets(this.hero, run.endpoint, enemies.filter(enemy => !enemy.hasReachedEnd), run.length, 26)
                    .sort((a, b) => distance(a, this.hero) - distance(b, this.hero)).slice(0, 6);
                for (const enemy of victims) CombatSystem.applyDamage({ attackerType: this.hero.category,
                    damage: run.damage, armorPenetration: 0.35, secondaryEntity: true }, enemy, this.hero, this.hero.game.resourceManager, 1);
                this.hero.game.vfx?.addBeam(this.hero, run.endpoint, { color: '#ffd45f', width: 13, duration: 0.3 });
                this.hero.game.audio?.play('binary'); this.flightTimer = 0.9;
            } else {
                this.flightTimer = Math.max(0, this.flightTimer - dt);
                if (this.flightTimer === 0) { this.binaryRun = null; this.flightOrigin = null; }
            }
            return;
        }
        if (this.resource < 60 || this.cooldownRemaining > 0) return;
        const length = stats.range * 2.2;
        const target = this.hero.abilitySystem.getTargetsInRange(enemies, length, stats)
            .filter(enemy => !enemy.hasReachedEnd)
            .sort((a, b) => b.distanceTravelled - a.distanceTravelled)[0];
        if (!target) return;
        this.flightOrigin = { x: this.hero.x, y: this.hero.y };
        const endpoint = { x: target.x, y: target.y - 34 };
        const beamEndpoint = getLineEndpoint(this.hero, target, length);
        this.binaryRun = { endpoint: beamEndpoint, destination: endpoint, length, windup: 0.45,
            damage: stats.damage * 0.85 * this.getPowerScale() };
        this.cooldownRemaining = 9;
        this.resource -= 60;
        this.hero.recordAbility();
    }

    fireSecondBlaster(primaryTarget, projectileConfig, projectiles, stats = this.hero.getEffectiveStats()) {
        if (this.blasterCooldown > 0 || this.hero.stunTimer > 0 || !this.hero.game.heroes.includes(this.hero)) return;
        const target = this.hero.abilitySystem.getTargetsInRange(this.hero.game.enemies || [], stats.range, stats)
            .filter((enemy) => enemy !== primaryTarget && !enemy.hasReachedEnd)
            .sort((a, b) => b.distanceTravelled - a.distanceTravelled)[0];
        if (!target) return;
        const complement = this.mode === 'plasma' ? 'cryo' : this.mode === 'cryo' ? 'incendiary' : 'plasma';
        const effects = complement === 'cryo' ? [{ type: 'slow', duration: 1.2, power: 0.42, chance: 1 }]
            : complement === 'incendiary' ? [{ type: 'burn', duration: 3, power: stats.damage * 0.23,
                damageBasis: 'flat', secondaryEntity: true, chance: 1 }] : [];
        const config = { attacker: this.hero, attackerType: this.hero.category, secondaryEntity: true,
            damage: stats.damage * 0.68 * this.getPowerScale(), effects, radius: 4, visualStyle: 'blaster',
            armorPenetration: complement === 'plasma' ? 0.28 : 0,
            color: { plasma: '#7ce7ff', cryo: '#8ff4ff', incendiary: '#ff7b45' }[complement] };
        if (this.hero.game.spawnProjectile) this.hero.game.spawnProjectile(this.hero.x + 8, this.hero.y, target, config);
        else projectiles.push(new Projectile(this.hero.x + 8, this.hero.y, target, config));
        this.hero.game.audio?.play('blaster');
        this.blasterCooldown = 1;
        this.hero.recordAbility();
    }

    updateGroot(dt, enemies, stats) {
        this.checkRoots();
        if (this.hero.stunTimer > 0 || !this.hero.game.heroes?.includes(this.hero)) return;
        if (this.rootWall) {
            this.rootWall.duration -= dt;
            if (this.rootWall.duration <= 0) this.rootWall = null;
        }
        if (!this.rootWall && this.cooldownRemaining <= 0) {
            const target = this.hero.abilitySystem.getTargetsInRange(enemies, stats.range * 1.35, stats)
                .filter(enemy => !enemy.flying && !enemy.hasReachedEnd)
                .sort((a, b) => b.distanceTravelled - a.distanceTravelled)[0];
            if (target) {
                this.rootWall = { x: target.x, y: target.y, radius: 48, duration: 3.2, originX: this.hero.x, originY: this.hero.y, touched: new Set() };
                this.cooldownRemaining = 10;
                this.hero.game.vfx?.addRing(target.x, target.y, { color: '#78c85a', radius: 52, duration: 0.5 });
                this.hero.game.audio?.play('roots');
                this.hero.recordAbility();
            }
        }
        const wall = this.rootWall;
        if (!wall) return;
        for (const enemy of enemies) {
            if (wall.touched.has(enemy) || !enemy.isAlive || enemy.flying || enemy.hasReachedEnd || distance(enemy, wall) > wall.radius) continue;
            wall.touched.add(enemy);
            enemy.applyFieldSlow?.(0.68, wall.duration, this.hero, () => this.rootWall === wall
                && wall.duration > 0 && this.rootsValid(wall) && !enemy.flying && !enemy.hasReachedEnd && distance(enemy, wall) <= wall.radius);
        }
    }

    rootsValid(wall) {
        return !(this.hero.stunTimer > 0) && this.hero.game.heroes?.includes(this.hero)
            && this.hero.x === wall.originX && this.hero.y === wall.originY;
    }

    checkRoots() {
        if (this.rootWall && !this.rootsValid(this.rootWall)) this.rootWall = null;
    }

    activateGamoraCombo(target, stats) {
        if (!this.hero.abilitySystem.getTargetsInRange([target].filter(Boolean), stats.range, stats).length) return;
        const ratio = target.hp / target.maxHp;
        if (ratio <= 0.25 && CombatSystem.executeNonBoss(target, this.hero, this.hero.game.resourceManager).killed) {
            this.executionCount++;
            this.hero.recordAbility();
            this.hero.game.audio?.play('cosmicBlade');
            return;
        }
        const chain = this.hero.abilitySystem.getTargetsInRange(this.hero.game.enemies || [], stats.range, stats)
            .filter((enemy) => enemy !== target && distance(enemy, target) <= 74)
            .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || b.distanceTravelled - a.distanceTravelled)
            .slice(0, 2);
        chain.forEach((enemy) => CombatSystem.applyDamage({ attackerType: this.hero.category, damage: stats.damage * 0.48 * this.getPowerScale(), armorPenetration: 0.25 }, enemy, this.hero, this.hero.game.resourceManager, 1));
        if (chain.length) {
            this.hero.game.vfx?.addBurst(target.x, target.y, { color: '#7dff8a', radius: 32, duration: 0.2 });
            this.hero.recordAbility();
        }
    }

    checkTrajectoryPosition() {
        if (this.hero.id !== 'silver_surfer') return;
        if (this.hero.x !== this.trajectoryOrigin.x || this.hero.y !== this.trajectoryOrigin.y
            || this.hero.stunTimer > 0 || !this.hero.game.heroes.includes(this.hero)) {
            this.trajectoryCharge = 0;
            this.trajectoryOrigin = { x: this.hero.x, y: this.hero.y };
        }
    }

    fireCosmicTrajectory(target, stats) {
        const length = stats.range * 1.25;
        const victims = getLineTargets(this.hero, target, (this.hero.game.enemies || []).filter(e => !e.hasReachedEnd), length, 24)
            .sort((a, b) => distance(this.hero, a) - distance(this.hero, b)).slice(0, 6);
        const factor = this.mode === 'power' ? 0.75 : this.mode === 'control' ? 0.48 : 0.38;
        victims.forEach((enemy) => CombatSystem.applyDamage({ attackerType: this.hero.category, secondaryEntity: true,
            damage: stats.damage * factor * this.getPowerScale() * Math.max(0.35, Math.min(1.2, distance(this.hero, enemy) / stats.range)),
            armorPenetration: 0.4 }, enemy, this.hero, this.hero.game.resourceManager, 1));
        this.hero.game.vfx?.addBeam(this.hero, getLineEndpoint(this.hero, target, length), { color: this.getProjectileColor(), width: 9, duration: 0.22 });
        this.hero.game.audio?.play('cosmic');
        this.hero.recordAbility();
    }

    getPowerScale() {
        const progression = this.hero.game.progression?.getHeroBonuses(this.hero.id);
        const synergy = this.hero.game.teamSynergy?.getAbilityModifiers(this.hero);
        return 1 + Math.min(0.35, Math.max(0, this.hero.level - 1) * 0.035) + (progression?.abilityPower || 0) + (synergy?.abilityPower || 0);
    }

    getCooldown(base) {
        return applyCooldownReductions(this.hero, base);
    }

    getModeLabel() {
        const config = COSMIC_CONTROLS[this.hero.id];
        return config?.options.find((option) => option.id === this.mode)?.label || '';
    }
}

function staticState(label) {
    return { label, progress: null, ready: true };
}

function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

export { COSMIC_CONTROLS };
