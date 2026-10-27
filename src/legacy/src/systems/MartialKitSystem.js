import { CombatSystem } from './CombatSystem.js';
import { isPointInRangePattern } from '../utils/RangePattern.js';
import { TERRAIN } from '../utils/TerrainRules.js';

const RECOVERY = { valkyrie: 5, rogue: 6, beast: 3, lady_sif: 4, white_tiger: 4, tigra: 1, deadpool: 1.2, devil_dinosaur: 6, miles_morales: 5 };

export class MartialKitSystem {
    constructor(hero) { this.hero = hero; this.reset(); }

    reset() {
        this.x = this.hero.x;
        this.y = this.hero.y;
        this.cooldown = RECOVERY[this.hero.id];
        this.trait = null;
        this.remaining = 0;
        this.pair = null;
        this.charge = 0;
        this.idle = 0;
        this.weapon = 0;
        this.weaponShots = 0;
    }

    stationary() {
        return this.hero.x === this.x && this.hero.y === this.y && !(this.hero.stunTimer > 0)
            && this.hero.game.heroes?.includes(this.hero);
    }

    onHighGround() {
        const { gridSize, terrainMap } = this.hero.game;
        return gridSize > 0 && terrainMap?.[Math.floor(this.hero.y / gridSize)]?.[Math.floor(this.hero.x / gridSize)] === TERRAIN.mountain;
    }

    covered(target, stats = this.hero.getEffectiveStats()) {
        return target?.isAlive && !target.hasReachedEnd && (!target.stealth || stats.canSeeStealth)
            && isPointInRangePattern(this.hero, target, stats.range, this.hero.rangePattern, stats.rangeGeometryScale);
    }

    update(dt) {
        if (!this.stationary()) { this.reset(); return; }
        this.remaining = Math.max(0, this.remaining - dt);
        this.idle += dt;
        if (this.remaining === 0) this.trait = null;
        if (this.hero.id === 'valkyrie' && !this.onHighGround()) this.cooldown = 5;
        else this.cooldown = Math.max(0, this.cooldown - dt);
        if (this.hero.id === 'deadpool' && this.weapon === 1 && this.idle >= 2.5) {
            this.weapon = 0; this.weaponShots = 0; this.cooldown = 1.2;
        }
        if (['devil_dinosaur', 'miles_morales'].includes(this.hero.id) && this.idle >= 2.5) this.charge = 0;
        if (this.pair && (this.idle >= 2.5 || !this.pair.every(enemy => this.covered(enemy)) || distance(...this.pair) > 80)) {
            this.pair = null; this.charge = 0;
        }
    }

    damageMultiplier(target) {
        if (this.hero.id === 'deadpool') return this.weapon === 1 && this.stationary() && this.covered(target) ? 1.5 : 1;
        if (this.hero.id === 'devil_dinosaur') return this.stampedeReady(target) ? 1.65 : 1;
        if (this.hero.id === 'white_tiger') return this.ownedMark(target) ? 1.8 : 1;
        if (this.hero.id === 'tigra') return this.stationary() && this.covered(target)
            && target.debuffs?.some(effect => ['slow', 'web'].includes(effect.type) && effect.duration > 0 && effect.power > 0) ? 1.35 : 1;
        return this.hero.id === 'valkyrie' && this.stationary() && this.onHighGround()
            && this.cooldown === 0 && this.covered(target) ? 1.75 : 1;
    }

    criticalMultiplier(target) {
        const elite = target?.isBoss || target?.isMiniBoss || target?.isFinalBoss
            || target?.config?.isBoss || target?.config?.isMiniBoss || target?.config?.isFinalBoss || (target?.threat || 0) >= 4;
        return this.hero.id === 'lady_sif' && this.stationary() && this.cooldown === 0
            && elite && target.armor > 0 && this.covered(target)
            && target.debuffs?.some(effect => effect.type === 'armorBreak' && effect.duration > 0 && effect.power > 0) ? 2.5 : 0;
    }

    ownedMark(target) {
        if (this.hero.id !== 'white_tiger' || !this.stationary() || this.cooldown > 0 || !this.covered(target)) return null;
        // Shared marks can have a stronger ally contribution; never spend those.
        return target.debuffs?.find(effect => effect.type === 'mark' && effect.source === this.hero
            && effect.duration > 0 && effect.duration <= 2 && effect.power === 0.08) || null;
    }

    suppressesNativeEffect(effect, target) {
        return effect.type === 'mark' && Boolean(this.ownedMark(target));
    }

    applyStats(stats) {
        if (!this.stationary() || this.remaining <= 0) return;
        if (this.trait === 'runner') stats.fireRate *= 1.15;
        if (this.trait === 'flying') stats.range *= 1.15;
    }

    getProjectileProfile() {
        return this.stationary() && this.remaining > 0 && this.trait === 'armor' ? { armorPenetration: 0.2 } : {};
    }

    onAttack(target, stats) {
        if (!this.stationary() || !this.covered(target, stats)) return;
        if (this.hero.id === 'deadpool' && this.canAttack()) {
            this.idle = 0;
            this.weaponShots++;
            if (this.weaponShots >= (this.weapon === 0 ? 3 : 2)) {
                this.weaponShots = 0;
                if (this.weapon === 1) this.cooldown = 1.2;
                this.weapon = 1 - this.weapon;
                this.hero.recordAbility();
            }
        }
        if (this.hero.id === 'devil_dinosaur') this.stampede(target, stats);
        if (this.hero.id === 'miles_morales') this.venomStrike(target, stats);
        if (this.hero.id === 'lady_sif' && this.criticalMultiplier(target) > 0) {
            this.cooldown = 4; this.hero.recordAbility();
        }
        const mark = this.ownedMark(target);
        if (mark) {
            target.debuffs.splice(target.debuffs.indexOf(mark), 1);
            this.cooldown = 4; this.hero.recordAbility();
            this.hero.game.vfx?.addBeam(this.hero, target, { color: '#f8fafc', width: 5, duration: 0.25 });
        }
        if (this.hero.id === 'valkyrie' && this.damageMultiplier(target) > 1) {
            this.cooldown = 5;
            // Visual charge only: the occupied tile and legal placement never change.
            this.hero.game.vfx?.addBeam(this.hero, target, { color: '#facc15', width: 6, duration: 0.25 });
            this.hero.recordAbility();
        }
        if (this.hero.id === 'rogue' && this.cooldown === 0) {
            if (target.isBoss || target.isMiniBoss || target.isFinalBoss || target.config?.isBoss
                || target.config?.isMiniBoss || target.config?.isFinalBoss) return;
            const trait = target.armor > 0 ? 'armor' : target.archetype === 'runner' ? 'runner' : target.flying ? 'flying' : null;
            if (!trait) return;
            this.trait = trait; this.remaining = 3; this.cooldown = 6;
            this.hero.recordAbility();
        }
        if (this.hero.id === 'beast') this.acrobatics(target, stats);
    }

    acrobatics(target, stats) {
        this.idle = 0;
        const other = (this.hero.game.enemies || []).filter(enemy => enemy !== target && this.covered(enemy, stats)
            && distance(enemy, target) <= 80).sort((a, b) => distance(a, target) - distance(b, target))[0];
        if (!other) { this.pair = null; this.charge = 0; return; }
        const samePair = this.pair?.includes(target) && this.pair.includes(other);
        const prepared = samePair && this.charge === 2 && this.cooldown === 0;
        this.pair = [target, other];
        if (!prepared) { this.charge = samePair ? Math.min(2, this.charge + 1) : 1; return; }
        this.charge = 0; this.cooldown = 3;
        CombatSystem.applyDamage({ damage: stats.damage * 0.65, attackerType: this.hero.category }, other,
            this.hero, this.hero.game.resourceManager, 1);
        if (other.isAlive) other.applyStatus?.({ type: 'slow', power: 0.35, duration: 1.5 }, this.hero);
        this.hero.game.vfx?.addBeam(target, other, { color: '#60a5fa', width: 4, duration: 0.25 });
        this.hero.recordAbility();
    }

    canAttack() {
        return this.hero.id !== 'deadpool' || this.cooldown === 0;
    }

    group(target, stats, radius, groundOnly = false) {
        if (!this.covered(target, stats) || (groundOnly && target.flying)) return [];
        return [target, ...(this.hero.game.enemies || []).filter(enemy => enemy !== target && this.covered(enemy, stats)
            && (!groundOnly || !enemy.flying) && distance(enemy, target) <= radius)
            .sort((a, b) => distance(a, target) - distance(b, target))];
    }

    stampedeReady(target) {
        return this.stationary() && this.cooldown === 0 && this.charge === 2
            && this.group(target, this.hero.getEffectiveStats(), 58, true).length >= 3;
    }

    stampede(target, stats) {
        this.idle = 0;
        const victims = this.group(target, stats, 58, true).slice(0, 5);
        if (victims.length < 3) { this.charge = 0; return; }
        if (this.charge < 2 || this.cooldown > 0) { this.charge = Math.min(2, this.charge + 1); return; }
        this.charge = 0; this.cooldown = 6;
        for (const enemy of victims) {
            if (enemy !== target) CombatSystem.applyDamage({ damage: stats.damage * 0.35, attackerType: this.hero.category }, enemy, this.hero, this.hero.game.resourceManager, 1);
            if (enemy.isAlive) enemy.applyStatus?.({ type: 'stun', duration: 0.3, power: 1 }, this.hero);
        }
        this.hero.game.vfx?.addRing(target.x, target.y, { color: '#ef4444', radius: 58, duration: 0.3 });
        this.hero.recordAbility();
    }

    venomStrike(target, stats) {
        this.idle = 0;
        if (!target.debuffs?.some(effect => effect.type === 'web' && effect.duration > 0 && effect.stacks > 0)) { this.charge = 0; return; }
        if (this.charge < 3 || this.cooldown > 0) { this.charge = Math.min(3, this.charge + 1); return; }
        this.charge = 0; this.cooldown = 5;
        for (const enemy of this.group(target, stats, 65).slice(0, 3)) {
            CombatSystem.applyDamage({ damage: stats.damage * 0.45, attackerType: this.hero.category }, enemy, this.hero, this.hero.game.resourceManager, 1);
            if (enemy.isAlive) {
                enemy.applyStatus?.({ type: 'stun', duration: 0.2, power: 1 }, this.hero);
                enemy.applyStatus?.({ type: 'reveal', duration: 2, power: 1 }, this.hero);
            }
        }
        this.hero.game.vfx?.addRing(target.x, target.y, { color: '#ffe45e', radius: 65, duration: 0.3 });
        this.hero.recordAbility();
    }

    getDisplayState() {
        if (this.hero.id === 'deadpool') return { label: this.cooldown > 0 ? `Recarga ${this.cooldown.toFixed(1)}s`
            : `${this.weapon === 0 ? 'Pistolas' : 'Katanas'} ${this.weaponShots}/${this.weapon === 0 ? 3 : 2}`,
        progress: this.cooldown > 0 ? 1 - this.cooldown / 1.2 : this.weaponShots / (this.weapon === 0 ? 3 : 2), ready: this.canAttack() };
        if (['devil_dinosaur', 'miles_morales'].includes(this.hero.id)) {
            const max = this.hero.id === 'devil_dinosaur' ? 2 : 3;
            return { label: `${max === 2 ? 'Estampida' : 'Bioelectricidad'} ${this.charge}/${max} | ${this.cooldown.toFixed(1)}s`,
                progress: this.charge / max, ready: this.charge === max && this.cooldown === 0 && this.stationary() };
        }
        if (this.hero.id === 'tigra') return { label: 'Caza: +35% contra slow/red', progress: null, ready: this.stationary() };
        if (['lady_sif', 'white_tiger'].includes(this.hero.id)) return {
            label: `${this.hero.id === 'lady_sif' ? 'Critico: elite con ruptura' : 'Amuleto: requiere marca propia'} | ${this.cooldown.toFixed(1)}s`,
            progress: 1 - this.cooldown / 4, ready: this.stationary() && this.cooldown === 0
        };
        if (this.hero.id === 'beast') return { label: `Acrobacia ${this.charge}/2 | ${this.cooldown.toFixed(1)}s`,
            progress: this.charge / 2, ready: this.charge === 2 && this.cooldown === 0 && this.stationary() };
        const labels = { armor: 'Perforacion +20%', runner: 'Cadencia +15%', flying: 'Alcance +15%' };
        const active = this.stationary() && this.remaining > 0 && this.trait;
        const label = this.hero.id === 'valkyrie' ? (this.onHighGround() ? 'Carga de altura' : 'Requiere montana/techo')
            : active ? `${labels[this.trait]} ${this.remaining.toFixed(1)}s` : 'Absorcion';
        return { label: `${label} | ${this.cooldown.toFixed(1)}s`, progress: 1 - this.cooldown / RECOVERY[this.hero.id],
            ready: this.cooldown === 0 && this.stationary() && (this.hero.id !== 'valkyrie' || this.onHighGround()) };
    }
}

function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
