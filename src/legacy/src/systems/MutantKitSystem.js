import { CombatSystem } from './CombatSystem.js';
import { getLineEndpoint, getLineTargets } from '../utils/LineTargeting.js';
import { applyCooldownReductions } from '../utils/AbilityModifiers.js';

const MUTANT_CONTROLS = {
    cyclops: {
        label: 'Visor optico', defaultMode: 'focus',
        options: [{ id: 'focus', label: 'Penetrante' }, { id: 'ricochet', label: 'Rebote' }]
    },
    storm: {
        label: 'Clima', defaultMode: 'blizzard',
        options: [{ id: 'blizzard', label: 'Ventisca' }, { id: 'lightning', label: 'Tormenta' }]
    },
    ant_man: {
        label: 'Particulas Pym', defaultMode: 'tiny',
        options: [{ id: 'tiny', label: 'Hormiga' }, { id: 'giant', label: 'Gigante' }]
    },
    winter_soldier: {
        label: 'Municion', defaultMode: 'piercing',
        options: [{ id: 'piercing', label: 'Perforante' }, { id: 'shock', label: 'Electrica' }, { id: 'explosive', label: 'Explosiva' }]
    }
};

export class MutantKitSystem {
    constructor(hero) {
        this.hero = hero;
        this.mode = MUTANT_CONTROLS[hero.id]?.defaultMode || null;
        this.attackCount = 0;
        this.resource = 0;
        this.cooldownRemaining = hero.id === 'ant_man' ? 4 : hero.id === 'storm' ? 9 : hero.id === 'jean_grey' ? 12 : 0;
        this.pymCharge = 0;
        this.jumpTimer = 0;
        this.jumpOrigin = null;
        this.weatherZone = null;
        this.regenerationTimer = 28;
        this.pursuit = null;
        this.jumpPosition = null;
        this.phoenixOrigin = { x: hero.x, y: hero.y };
        this.phoenixWave = null;
        this.phoenixExhaustion = 0;
        this.opticOrigin = { x: hero.x, y: hero.y };
        this.opticDirection = null;
        this.opticCharge = 0;
        this.opticIdle = 0;
    }

    update(dt, enemies, stats) {
        this.checkOpticPosition();
        this.opticIdle += dt;
        if (this.opticIdle >= 3) { this.opticCharge = 0; this.opticDirection = null; }
        this.checkPhoenixPosition();
        this.cooldownRemaining = Math.max(0, this.cooldownRemaining - dt);
        this.phoenixExhaustion = Math.max(0, this.phoenixExhaustion - dt);
        if (this.hero.id === 'wolverine') this.updateWolverine(dt, enemies, stats);
        if (this.hero.id === 'jean_grey') this.updatePhoenix(dt, enemies, stats);
        if (this.hero.id === 'storm') this.updateWeather(dt, enemies, stats);
        if (this.hero.id === 'scarlet_witch') this.updateHexTime(enemies, stats);
    }

    onAttack(target, stats) {
        this.attackCount++;
        if (this.hero.id === 'winter_soldier' && this.attackCount % 3 === 0) this.hero.recordAbility();
        if (this.hero.id === 'wolverine') {
            const same = this.pursuit?.target === target && this.pursuit.idle < 3;
            if (this.pursuit && !same) this.resource *= 0.5;
            this.resource = Math.min(100, this.resource + (same ? 14 : 7));
            const origin = this.jumpOrigin || this.hero;
            this.pursuit = { target, idle: 0, x: origin.x, y: origin.y };
        }
        if (this.hero.id === 'jean_grey' && !this.phoenixWave && this.phoenixExhaustion === 0) {
            const phoenix = this.hero.game.progression?.getHeroEvolution?.(this.hero.id)?.id === 'phoenix';
            this.resource = Math.min(100, this.resource + (phoenix ? 14 : 9));
        }
        if (this.hero.id === 'cyclops') {
            this.checkOpticPosition();
            const angle = Math.atan2(target.y - this.hero.y, target.x - this.hero.x);
            if (this.opticDirection !== null && Math.cos(angle - this.opticDirection) < Math.cos(Math.PI / 18)) this.opticCharge = 0;
            if (!this.opticCharge) this.opticDirection = angle;
            this.opticIdle = 0;
            this.opticCharge++;
            if (this.opticCharge >= (this.mode === 'focus' ? 3 : 2)) {
                this.opticCharge = 0; this.fireOpticLine(target, stats);
            }
        }
        if (this.hero.id === 'ant_man') {
            if (this.mode === 'tiny') this.pymCharge = Math.min(3, this.pymCharge + 1);
            else if (this.pymCharge === 3 && this.cooldownRemaining === 0) this.giantImpact(target, stats);
        }
    }

    onKill() {
        if (this.hero.id === 'wolverine') this.resource = Math.min(100, this.resource + 18);
        if (this.hero.id === 'jean_grey' && !this.phoenixWave && this.phoenixExhaustion === 0) {
            const phoenix = this.hero.game.progression?.getHeroEvolution?.(this.hero.id)?.id === 'phoenix';
            this.resource = Math.min(100, this.resource + (phoenix ? 24 : 16));
        }
    }

    applyStatModifiers(stats) {
        if (this.hero.id === 'wolverine') {
            stats.fireRate *= 1 + this.resource * 0.002;
            stats.damage *= 1 + this.resource * 0.0018;
        }
        if (this.hero.id === 'jean_grey') {
            stats.damage *= 1 + this.resource * 0.002;
            if (this.phoenixExhaustion > 0) stats.damage *= 0.75;
        }
        if (this.hero.id === 'cyclops') {
            if (this.mode === 'focus') stats.damage *= 1.24;
            else stats.fireRate *= 1.16;
        }
        if (this.hero.id === 'storm') {
            if (this.mode === 'blizzard') stats.range *= 1.14;
            else stats.damage *= 1.18;
        }
        if (this.hero.id === 'ant_man') {
            if (this.mode === 'tiny') {
                stats.fireRate *= 1.5;
                stats.range *= 1.12;
                stats.damage *= 0.78;
            } else {
                stats.damage *= 1.55;
                stats.range *= 0.88;
                stats.fireRate *= 0.72;
            }
        }
        if (this.hero.id === 'winter_soldier' && this.mode === 'shock') stats.fireRate *= 1.12;
        return stats;
    }

    getAttackEffects() {
        if (this.hero.id === 'jean_grey') return [{ type: 'slow', duration: 1.8, power: 0.34, chance: 0.7 }];
        if (this.hero.id === 'scarlet_witch') return [{ type: 'mark', duration: 4, power: 0.2, chance: 1 }];
        if (this.hero.id === 'winter_soldier' && this.mode === 'shock' && this.isSoldierFinisher()) {
            return [{ type: 'stun', duration: 0.6, power: 1, chance: 1 }];
        }
        return [];
    }

    isSoldierFinisher() {
        return this.hero.id === 'winter_soldier' && this.attackCount % 3 === 2;
    }

    getAttackDamageMultiplier() {
        if (this.hero.id !== 'winter_soldier') return 1;
        return this.isSoldierFinisher() ? 1.6 : 0.85;
    }

    getProjectileProfile() {
        if (this.hero.id === 'cyclops') {
            return this.mode === 'focus'
                ? { armorPenetration: 0.62 }
                : { chainCount: 3, chainRange: 120, chainFactor: 0.68 };
        }
        if (this.hero.id === 'storm' && this.mode === 'lightning') return { chainCount: 3, chainRange: 130, chainFactor: 0.66 };
        if (this.hero.id === 'scarlet_witch') return { chainCount: 2, chainRange: 140, chainFactor: 0.55 };
        if (this.hero.id === 'ant_man' && this.mode === 'giant') return { splashRadius: 70, splashFactor: 0.58, armorPenetration: 0.2 };
        if (this.hero.id === 'winter_soldier') {
            if (this.mode === 'piercing') return { armorPenetration: this.isSoldierFinisher() ? 0.85 : 0.65 };
            if (this.mode === 'explosive') return { splashRadius: this.isSoldierFinisher() ? 90 : 64, splashFactor: 0.56 };
        }
        return {};
    }

    getProjectileColor() {
        if (this.hero.id === 'wolverine') return '#f4d03f';
        if (this.hero.id === 'jean_grey') return '#ff8cc8';
        if (this.hero.id === 'cyclops') return '#ff3535';
        if (this.hero.id === 'storm') return this.mode === 'blizzard' ? '#9de9ff' : '#f6f1a4';
        if (this.hero.id === 'domino') return '#d8c8ff';
        if (this.hero.id === 'scarlet_witch') return '#ff3b73';
        if (this.hero.id === 'ant_man') return this.mode === 'tiny' ? '#8de7ff' : '#ef3340';
        if (this.hero.id === 'winter_soldier') return { piercing: '#e9f0f7', shock: '#69dcff', explosive: '#ff9b42' }[this.mode];
        return null;
    }

    getProjectileVisualStyle() {
        if (this.hero.id === 'wolverine') return 'blade';
        if (this.hero.id === 'jean_grey' || this.hero.id === 'scarlet_witch') return 'mystic';
        if (this.hero.id === 'cyclops') return 'optic';
        if (this.hero.id === 'storm' && this.mode === 'lightning') return 'lightning';
        if (this.hero.id === 'ant_man') return 'pym';
        return null;
    }

    getDisplayState() {
        if (this.hero.id === 'wolverine') return meter(`Frenesi ${Math.round(this.resource)}/100`, this.resource, 55);
        if (this.hero.id === 'jean_grey') return {
            label: this.phoenixWave ? 'Phoenix: preparando onda' : this.phoenixExhaustion > 0
                ? `Agotamiento ${this.phoenixExhaustion.toFixed(1)}s | -25% dano`
                : `Phoenix ${Math.round(this.resource)}/100 | ${this.cooldownRemaining.toFixed(1)}s`,
            progress: this.resource / 100, ready: this.resource === 100 && this.cooldownRemaining === 0 && !this.phoenixWave
        };
        if (this.hero.id === 'cyclops') return staticState(`Visor: ${this.getModeLabel()} | Linea ${this.opticCharge}/${this.mode === 'focus' ? 3 : 2}`);
        if (this.hero.id === 'storm') return cooldownState(this.weatherZone
            ? `Zona ${this.weatherZone.mode === 'blizzard' ? 'Ventisca' : 'Tormenta'} ${this.weatherZone.duration.toFixed(1)}s; siguiente ${this.getModeLabel()}`
            : `Clima: ${this.getModeLabel()}`, this.cooldownRemaining, 9);
        if (this.hero.id === 'domino') return staticState('Economia: +15% recompensa');
        if (this.hero.id === 'scarlet_witch') return cooldownState('Alteracion temporal', this.cooldownRemaining, 9);
        if (this.hero.id === 'ant_man') return {
            label: `${this.getModeLabel()} | Pym ${this.pymCharge}/3 | ${this.cooldownRemaining.toFixed(1)}s`,
            progress: this.pymCharge / 3, ready: this.pymCharge === 3 && this.cooldownRemaining === 0
        };
        if (this.hero.id === 'winter_soldier') return {
            label: `Rafaga ${this.attackCount % 3}/2: ${this.getModeLabel()}`,
            progress: (this.attackCount % 3) / 2, ready: this.isSoldierFinisher()
        };
        return null;
    }

    getControlState() {
        const config = MUTANT_CONTROLS[this.hero.id];
        return config ? { ...config, value: this.mode } : null;
    }

    setMode(mode) {
        const config = MUTANT_CONTROLS[this.hero.id];
        if (!config?.options.some((option) => option.id === mode)) return false;
        if (this.hero.id === 'cyclops' && this.mode !== mode) { this.opticCharge = 0; this.opticDirection = null; }
        this.mode = mode;
        return true;
    }

    getMode() {
        return this.mode;
    }

    render(ctx) {
        if (this.phoenixWave) {
            ctx.save(); ctx.strokeStyle = '#ff5a82'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(this.hero.x, this.hero.y, this.phoenixWave.range, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        }
        if (this.weatherZone) {
            ctx.save();
            ctx.strokeStyle = this.weatherZone.mode === 'blizzard' ? 'rgba(157,233,255,.65)' : 'rgba(246,241,164,.7)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.weatherZone.x, this.weatherZone.y, this.weatherZone.radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
        if (this.hero.id === 'jean_grey' && this.resource >= 70) {
            ctx.save();
            ctx.strokeStyle = `rgba(255,90,130,${0.3 + this.resource / 250})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.hero.x, this.hero.y, 24 + this.resource / 12, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
        if (this.hero.id === 'ant_man' && this.mode === 'tiny') {
            ctx.save();
            ctx.fillStyle = '#8de7ff';
            ctx.globalAlpha = 0.7;
            for (let i = 0; i < 3; i++) ctx.fillRect(this.hero.x - 18 + i * 18, this.hero.y + 15 + i % 2 * 4, 2, 2);
            ctx.restore();
        }
    }

    updatePursuit(dt) {
        if (this.hero.id !== 'wolverine') return;
        if (this.jumpOrigin && this.jumpPosition
            && (this.hero.x !== this.jumpPosition.x || this.hero.y !== this.jumpPosition.y)) {
            // A manual move wins over the return from the autonomous leap.
            this.jumpOrigin = null; this.jumpPosition = null; this.jumpTimer = 0;
            this.pursuit = null; this.resource = 0;
        }
        const origin = this.jumpOrigin || this.hero;
        if (this.hero.stunTimer > 0 || !this.hero.game.heroes?.includes(this.hero)
            || (this.pursuit && (origin.x !== this.pursuit.x || origin.y !== this.pursuit.y))) {
            this.pursuit = null; this.resource = 0;
            if (this.jumpOrigin) {
                this.hero.x = this.jumpOrigin.x; this.hero.y = this.jumpOrigin.y;
                this.jumpOrigin = null; this.jumpPosition = null; this.jumpTimer = 0;
            }
            return;
        }
        if (!this.pursuit) return;
        const previousIdle = this.pursuit.idle;
        this.pursuit.idle += dt;
        const decayTime = Math.max(0, this.pursuit.idle - 3) - Math.max(0, previousIdle - 3);
        this.resource = Math.max(0, this.resource - decayTime * 12);
    }

    updateWolverine(dt, enemies, stats) {
        if (this.jumpTimer > 0) {
            this.jumpTimer -= dt;
            if (this.jumpTimer <= 0 && this.jumpOrigin) {
                this.hero.x = this.jumpOrigin.x;
                this.hero.y = this.jumpOrigin.y;
                this.jumpOrigin = null;
                this.jumpPosition = null;
            }
            return;
        }
        const resources = this.hero.game.resourceManager;
        if (this.resource < 55 || this.cooldownRemaining > 0) return;
        const target = this.hero.abilitySystem.getTargetsInRange(enemies, stats.range * 3, stats)
            .sort((a, b) => b.distanceTravelled - a.distanceTravelled)[0];
        if (!target) return;
        this.jumpOrigin = { x: this.hero.x, y: this.hero.y };
        this.hero.x = target.x;
        this.hero.y = target.y - 30;
        this.jumpPosition = { x: this.hero.x, y: this.hero.y };
        CombatSystem.applyDamage({ attackerType: this.hero.category, damage: stats.damage * 1.25 * this.getPowerScale(), armorPenetration: 0.3 }, target, this.hero, resources, 1);
        this.hero.game.vfx?.addBurst(target.x, target.y, { color: '#f4d03f', radius: 38, duration: 0.26 });
        this.hero.game.audio?.play('claws');
        this.hero.recordAbility();
        this.resource -= 55;
        this.jumpTimer = 0.8;
        this.cooldownRemaining = this.getCooldown(7);
    }

    checkPhoenixPosition() {
        if (this.hero.id !== 'jean_grey') return;
        if (!(this.hero.stunTimer > 0) && this.hero.game.heroes.includes(this.hero)
            && this.hero.x === this.phoenixOrigin.x && this.hero.y === this.phoenixOrigin.y) return;
        this.phoenixOrigin = { x: this.hero.x, y: this.hero.y };
        this.resource = 0; this.phoenixWave = null; this.phoenixExhaustion = 0; this.cooldownRemaining = 12;
    }

    canAttack() { return this.hero.id !== 'jean_grey' || !this.phoenixWave; }

    updatePhoenix(dt, enemies, stats) {
        if (this.hero.stunTimer > 0 || !this.hero.game.heroes.includes(this.hero)) return;
        if (this.phoenixWave) {
            const wave = this.phoenixWave;
            wave.remaining = Math.max(0, wave.remaining - dt);
            if (wave.remaining > 0) return;
            this.phoenixWave = null;
            this.phoenixExhaustion = 2;
            const targets = enemies.filter(enemy => enemy.isAlive && !enemy.hasReachedEnd && distance(enemy, this.hero) <= wave.range)
                .sort((a, b) => distance(a, this.hero) - distance(b, this.hero)).slice(0, 6);
            for (const enemy of targets) {
                CombatSystem.applyDamage({ attackerType: this.hero.category, damage: wave.damage,
                    armorPenetration: wave.penetration, secondaryEntity: true }, enemy, this.hero, this.hero.game.resourceManager, 1);
                if (enemy.isAlive) enemy.applyStatus({ type: 'knockback', power: enemy.isBoss || enemy.config.isMiniBoss ? 20 : 48 }, this.hero);
            }
            this.hero.game.vfx?.addRing(this.hero.x, this.hero.y, { color: '#ff5a82', radius: wave.range, duration: 0.55 });
            this.hero.game.audio?.play('phoenix');
            return;
        }
        if (this.resource < 100 || this.cooldownRemaining > 0) return;
        const targets = enemies.filter((enemy) => enemy.isAlive && !enemy.hasReachedEnd && distance(enemy, this.hero) <= stats.range * 1.2);
        if (!targets.length) return;
        const phoenix = this.hero.game.progression?.getHeroEvolution?.(this.hero.id)?.id === 'phoenix';
        this.phoenixWave = { remaining: 0.6, range: stats.range * 1.2,
            damage: stats.damage * (phoenix ? 1.25 : 0.95) * this.getPowerScale(), penetration: phoenix ? 0.5 : 0.35 };
        this.hero.recordAbility();
        this.resource = 0;
        this.cooldownRemaining = 12;
    }

    updateWeather(dt, enemies, stats) {
        this.checkWeather();
        if (this.hero.stunTimer > 0 || !this.hero.game.heroes?.includes(this.hero)) return;
        if (this.weatherZone) {
            const zone = this.weatherZone;
            zone.tick += Math.min(dt, zone.duration);
            zone.duration = Math.max(0, zone.duration - dt);
            if (zone.mode === 'lightning') {
                while (zone.tick + 1e-9 >= 0.8) {
                    zone.tick -= 0.8;
                    enemies.filter(enemy => enemy.isAlive && !enemy.hasReachedEnd && distance(enemy, zone) <= zone.radius)
                        .sort((a, b) => b.distanceTravelled - a.distanceTravelled).slice(0, 4)
                        .forEach(enemy => CombatSystem.applyDamage({ attackerType: this.hero.category, damage: zone.damage }, enemy, this.hero, this.hero.game.resourceManager, 1));
                }
            } else {
                for (const enemy of enemies) {
                    if (!enemy.isAlive || enemy.hasReachedEnd || zone.duration <= 0 || zone.touched.has(enemy) || distance(enemy, zone) > zone.radius) continue;
                    zone.touched.add(enemy);
                    enemy.applyFieldSlow?.(0.55, zone.duration, this.hero, () => this.weatherZone === zone && zone.duration > 0
                        && this.weatherValid(zone) && !enemy.hasReachedEnd && distance(enemy, zone) <= zone.radius);
                }
            }
            if (zone.duration <= 0) this.weatherZone = null;
        }
        if (this.weatherZone || this.cooldownRemaining > 0) return;
        const target = this.hero.abilitySystem.getTargetsInRange(enemies, stats.range, stats)
            .filter(enemy => !enemy.hasReachedEnd)
            .sort((a, b) => b.distanceTravelled - a.distanceTravelled)[0];
        if (!target) return;
        this.weatherZone = { x: target.x, y: target.y, radius: 72, duration: 4.2, tick: 0,
            mode: this.mode, damage: stats.damage * 0.42 * this.getPowerScale(), originX: this.hero.x, originY: this.hero.y, touched: new Set() };
        this.cooldownRemaining = 9;
        this.hero.game.audio?.play('weather');
        this.hero.recordAbility();
    }

    weatherValid(zone) {
        return !(this.hero.stunTimer > 0) && this.hero.game.heroes?.includes(this.hero)
            && this.hero.x === zone.originX && this.hero.y === zone.originY;
    }

    checkWeather() {
        if (this.weatherZone && !this.weatherValid(this.weatherZone)) this.weatherZone = null;
    }

    updateHexTime(enemies, stats) {
        if (this.cooldownRemaining > 0) return;
        const targets = enemies.filter((enemy) => enemy.isAlive && distance(enemy, this.hero) <= stats.range * 1.25);
        if (!targets.length) return;
        targets.forEach((enemy) => enemy.applyStatus?.({ type: 'slow', duration: 3.2, power: 0.58 }, this.hero));
        this.hero.game.vfx?.addRing(this.hero.x, this.hero.y, { color: '#ff3b73', radius: stats.range * 1.25, duration: 0.45 });
        this.hero.game.audio?.play('hex');
        this.hero.recordAbility();
        this.cooldownRemaining = this.getCooldown(9);
    }

    checkOpticPosition() {
        if (this.hero.id !== 'cyclops') return;
        if (this.hero.x !== this.opticOrigin.x || this.hero.y !== this.opticOrigin.y
            || this.hero.stunTimer > 0 || !this.hero.game.heroes.includes(this.hero)) {
            this.opticCharge = 0; this.opticDirection = null; this.opticIdle = 0;
            this.opticOrigin = { x: this.hero.x, y: this.hero.y };
        }
    }

    fireOpticLine(target, stats) {
        const length = stats.range * 1.3;
        const victims = getLineTargets(this.hero, target, (this.hero.game.enemies || []).filter(e => !e.hasReachedEnd), length, this.mode === 'focus' ? 24 : 38)
            .sort((a, b) => distance(this.hero, a) - distance(this.hero, b)).slice(0, 4);
        victims.forEach((enemy) => CombatSystem.applyDamage({ attackerType: this.hero.category, secondaryEntity: true, damage: stats.damage * (this.mode === 'focus' ? 0.86 : 0.55) * this.getPowerScale(), armorPenetration: this.mode === 'focus' ? 0.6 : 0.25 }, enemy, this.hero, this.hero.game.resourceManager, 1));
        this.hero.game.vfx?.addBeam(this.hero, getLineEndpoint(this.hero, target, length), { color: '#ff3535', width: this.mode === 'focus' ? 8 : 5, duration: 0.2 });
        this.hero.game.audio?.play('optic');
        this.hero.recordAbility();
    }

    giantImpact(target, stats) {
        const candidates = this.hero.abilitySystem.getTargetsInRange(this.hero.game.enemies || [], stats.range, stats);
        if (!candidates.includes(target)) return;
        const victims = [target, ...candidates.filter(enemy => enemy !== target && distance(enemy, target) <= 68)
            .sort((a, b) => b.distanceTravelled - a.distanceTravelled).slice(0, 4)];
        this.pymCharge = 0;
        this.cooldownRemaining = 4;
        victims.forEach((enemy) => {
            CombatSystem.applyDamage({ attackerType: this.hero.category, damage: stats.damage * 0.5 * this.getPowerScale(), armorPenetration: 0.2 }, enemy, this.hero, this.hero.game.resourceManager, 1);
            if (enemy.isAlive) enemy.applyStatus?.({ type: 'knockback', duration: 0, power: enemy.isBoss ? 15 : 32 }, this.hero);
        });
        this.hero.game.vfx?.addRing(target.x, target.y, { color: '#ef3340', radius: 72, duration: 0.3 });
        this.hero.game.audio?.play('pym');
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
        const config = MUTANT_CONTROLS[this.hero.id];
        return config?.options.find((option) => option.id === this.mode)?.label || '';
    }
}

function meter(label, value, readyAt) {
    return { label, progress: Math.max(0, Math.min(1, value / 100)), ready: value >= readyAt };
}
function staticState(label) { return { label, progress: null, ready: true }; }
function cooldownState(label, remaining, total) { return { label: remaining <= 0 ? `${label} lista` : `${label} ${remaining.toFixed(1)} s`, progress: remaining <= 0 ? 1 : 1 - remaining / total, ready: remaining <= 0 }; }
function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

export { MUTANT_CONTROLS };
